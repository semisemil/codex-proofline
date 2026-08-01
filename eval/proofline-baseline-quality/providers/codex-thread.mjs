import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join, resolve } from 'node:path';

import {
  captureArtifactEvidence,
  diffWorkspaceSnapshots,
  snapshotProjectFiles,
  startWorkspaceWriteMonitor,
} from '../lib/workspace-evidence.mjs';

const ENV_NAMES = [
  'PATH',
  'Path',
  'SystemRoot',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
  'TEMP',
  'TMP',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
];

const TARGETS = {
  'win32-x64': ['@openai/codex-win32-x64', 'x86_64-pc-windows-msvc', 'codex.exe'],
  'win32-arm64': ['@openai/codex-win32-arm64', 'aarch64-pc-windows-msvc', 'codex.exe'],
  'darwin-x64': ['@openai/codex-darwin-x64', 'x86_64-apple-darwin', 'codex'],
  'darwin-arm64': ['@openai/codex-darwin-arm64', 'aarch64-apple-darwin', 'codex'],
  'linux-x64': ['@openai/codex-linux-x64', 'x86_64-unknown-linux-musl', 'codex'],
  'linux-arm64': ['@openai/codex-linux-arm64', 'aarch64-unknown-linux-musl', 'codex'],
};

function codexRuntime() {
  const target = TARGETS[`${process.platform}-${process.arch}`];
  if (!target) throw new Error(`지원하지 않는 Codex 실행 환경입니다: ${process.platform}-${process.arch}`);
  const [packageName, targetTriple, executableName] = target;
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve(`${packageName}/package.json`);
  const vendor = join(dirname(packageJson), 'vendor', targetTriple);
  const modernExecutable = join(vendor, 'bin', executableName);
  const legacyExecutable = join(vendor, 'codex', executableName);
  const executable = existsSync(modernExecutable) ? modernExecutable : legacyExecutable;
  if (!existsSync(executable)) throw new Error('Codex CLI 실행 파일을 찾지 못했습니다.');
  const pathDirs = [join(vendor, 'codex-path'), join(vendor, 'path')]
    .filter((path) => existsSync(path));
  return { executable, pathDirs };
}

function codexEnvironment(codexHome, pathDirs) {
  const nodeShimDir = join(import.meta.dirname, '..', '..', '.runtime', 'node-shim');
  const env = Object.fromEntries([
    ...ENV_NAMES
      .filter((name) => process.env[name])
      .map((name) => [name, process.env[name]]),
    ['CODEX_HOME', codexHome],
    ['HOME', codexHome],
    ['USERPROFILE', codexHome],
    ['CODEX_INTERNAL_ORIGINATOR_OVERRIDE', 'proofline_eval'],
  ]);
  const pathKey = process.platform === 'win32' && env.Path ? 'Path' : 'PATH';
  env[pathKey] = [nodeShimDir, ...pathDirs, ...(env[pathKey] ?? '').split(delimiter).filter(Boolean)].join(delimiter);
  if (process.platform === 'win32') {
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'path' && key !== pathKey) delete env[key];
    }
  }
  return env;
}

export function normalizeTurns(prompt, context) {
  const serialized = context?.vars?.conversationTurnsJson;
  if (serialized === undefined) return [prompt];
  if (typeof serialized !== 'string') {
    throw new Error('vars.conversationTurnsJson은 JSON 문자열이어야 합니다.');
  }
  let configured;
  try {
    configured = JSON.parse(serialized);
  } catch {
    throw new Error('vars.conversationTurnsJson을 턴 배열로 복원할 수 없습니다.');
  }
  if (!Array.isArray(configured) || configured.length === 0) {
    throw new Error('복원된 conversationTurns는 비어 있지 않은 문자열 배열이어야 합니다.');
  }
  if (configured.some((turn) => typeof turn !== 'string' || turn.trim() === '')) {
    throw new Error('conversationTurns의 각 항목은 비어 있지 않은 문자열이어야 합니다.');
  }
  return configured;
}

function ensureProjectTrusted(codexHome, workingDirectory) {
  const configPath = join(codexHome, 'config.toml');
  const projectPath = process.platform === 'win32'
    ? workingDirectory.toLowerCase()
    : workingDirectory;
  const header = `[projects.${JSON.stringify(projectPath)}]`;
  const source = readFileSync(configPath, 'utf8').trimEnd();
  if (!source.includes(header)) {
    writeFileSync(configPath, `${source}\n\n${header}\ntrust_level = "trusted"\n`, 'utf8');
  }
}

function addUsage(total, usage) {
  if (!usage) return;
  total.prompt += usage.input_tokens ?? 0;
  total.cached += usage.cached_input_tokens ?? 0;
  total.completion += usage.output_tokens ?? 0;
  total.reasoning += usage.reasoning_output_tokens ?? 0;
}

function configValue(value) {
  return JSON.stringify(value);
}

function runCodexTurn({ runtime, env, config, condition, workingDirectory, input, threadId }) {
  const args = ['exec', '--experimental-json'];
  if (condition === 'treatment') args.push('--dangerously-bypass-hook-trust');
  args.push(
    '--model', config.model,
    '--sandbox', config.sandbox_mode,
    '--cd', workingDirectory,
    '--skip-git-repo-check',
    '--config', `model_reasoning_effort=${configValue(config.model_reasoning_effort)}`,
    '--config', `approval_policy=${configValue(config.approval_policy)}`,
    '--config', `sandbox_workspace_write.network_access=${Boolean(config.network_access_enabled)}`,
    '--config', `web_search=${configValue(config.web_search_mode)}`,
  );
  if (threadId) args.push('resume', threadId);

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(runtime.executable, args, { env, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (signal || code !== 0) {
        rejectPromise(new Error(`Codex CLI 실행 실패 (${signal ?? code}): ${stderr.trim()}`));
        return;
      }
      const events = stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      const started = events.find((event) => event.type === 'thread.started');
      const failed = events.find((event) => event.type === 'turn.failed');
      if (failed) {
        rejectPromise(new Error(failed.error?.message ?? 'Codex 턴이 실패했습니다.'));
        return;
      }
      const items = events
        .filter((event) => event.type === 'item.completed')
        .map((event) => event.item);
      const completed = events.findLast((event) => event.type === 'turn.completed');
      const finalResponse = [...items].reverse()
        .find((item) => item.type === 'agent_message')?.text ?? '';
      resolvePromise({
        threadId: started?.thread_id ?? threadId,
        items,
        finalResponse,
        usage: completed?.usage,
      });
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

export default class CodexThreadProvider {
  constructor(options) {
    this.providerId = options.id;
    this.config = options.config ?? {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const condition = this.config.condition;
    if (!['control', 'treatment'].includes(condition)) {
      throw new Error('provider config.condition은 control 또는 treatment여야 합니다.');
    }
    const codexHome = process.env[
      condition === 'control'
        ? 'PROOFLINE_CONTROL_CODEX_HOME'
        : 'PROOFLINE_TREATMENT_CODEX_HOME'
    ];
    const workingDirectory = context?.vars?.workspaceDir;
    const evidenceRequirements = context?.vars?.evidenceRequirements ?? {};
    if (!codexHome || typeof workingDirectory !== 'string') {
      throw new Error('격리된 CODEX_HOME 또는 평가 작업공간을 찾지 못했습니다.');
    }

    ensureProjectTrusted(codexHome, workingDirectory);
    const runtime = codexRuntime();
    const env = codexEnvironment(codexHome, runtime.pathDirs);
    const turns = normalizeTurns(prompt, context);
    const responses = [];
    const items = [];
    const workspaceSnapshots = [];
    const workspaceWriteEvents = [];
    const workspaceWriteSummary = [];
    const usage = { prompt: 0, cached: 0, completion: 0, reasoning: 0 };
    let threadId;
    for (const [turnIndex, input] of turns.entries()) {
      const before = evidenceRequirements.turnSnapshots
        ? snapshotProjectFiles(workingDirectory)
        : null;
      const writeMonitor = evidenceRequirements.workspaceWriteMonitor
        ? startWorkspaceWriteMonitor(workingDirectory)
        : null;
      let result;
      let turnError;
      try {
        result = await runCodexTurn({
          runtime,
          env,
          config: this.config,
          condition,
          workingDirectory,
          input,
          threadId,
        });
      } catch (error) {
        turnError = error;
      }
      const turnWriteEvents = writeMonitor ? await writeMonitor.stop() : [];
      let snapshotChanged = null;
      if (before) {
        const after = snapshotProjectFiles(workingDirectory);
        const diff = diffWorkspaceSnapshots(before, after);
        snapshotChanged = [...diff.created, ...diff.modified, ...diff.deleted].length > 0;
        workspaceSnapshots.push({
          turn: turnIndex + 1,
          before,
          after,
          diff,
          changed: snapshotChanged,
        });
      }
      if (writeMonitor) {
        const writeEvents = turnWriteEvents.filter((event) => event.eventType !== 'monitor-error');
        const observed = writeEvents.length > 0;
        const reverted = observed && snapshotChanged !== null ? !snapshotChanged : null;
        workspaceWriteEvents.push(
          ...turnWriteEvents.map((event) => ({
            ...event,
            turn: turnIndex + 1,
            observed: event.eventType !== 'monitor-error',
            reverted: event.eventType !== 'monitor-error' ? reverted : null,
          })),
        );
        workspaceWriteSummary.push({
          turn: turnIndex + 1,
          observed,
          reverted,
          writeEventCount: writeEvents.length,
          monitorErrorCount: turnWriteEvents.length - writeEvents.length,
        });
      }
      if (turnError) throw turnError;
      threadId = result.threadId;
      responses.push(result.finalResponse);
      items.push(...result.items);
      addUsage(usage, result.usage);
    }

    let artifact;
    let finalWorkspace;
    if (
      evidenceRequirements.comparison === 'artifact'
      || evidenceRequirements.turnSnapshots
    ) {
      const bundle = process.env.PROOFLINE_EVAL_BUNDLE;
      if (!bundle || typeof evidenceRequirements.case !== 'string') {
        throw new Error('최종 workspace 증거 수집에 필요한 평가 사례 정보를 찾지 못했습니다.');
      }
      const captured = captureArtifactEvidence(
        resolve(bundle, 'fixtures', evidenceRequirements.case),
        workingDirectory,
      );
      if (evidenceRequirements.comparison === 'artifact') artifact = captured;
      if (evidenceRequirements.turnSnapshots) {
        finalWorkspace = {
          diff: captured.diff,
          changed: captured.files.length > 0,
        };
      }
    }

    const raw = {
      items,
      turns: responses.map((output, index) => ({ input: turns[index], output })),
      ...(evidenceRequirements.turnSnapshots ? { workspaceSnapshots } : {}),
      ...(evidenceRequirements.workspaceWriteMonitor
        ? { workspaceWriteEvents, workspaceWriteSummary }
        : {}),
      ...(finalWorkspace ? { finalWorkspace } : {}),
      ...(artifact ? { artifact } : {}),
    };

    return {
      output: responses.at(-1) ?? '',
      prompt: turns.join('\n\n--- 다음 사용자 턴 ---\n\n'),
      raw,
      metadata: {
        condition,
        threadId,
        turnCount: turns.length,
        turnResponses: responses,
        evidence: {
          workspaceSnapshots: workspaceSnapshots.length,
          workspaceWriteEvents: workspaceWriteEvents.length,
          workspaceWriteSummary,
          finalWorkspaceChanged: finalWorkspace?.changed ?? null,
          artifactFiles: artifact?.files.length ?? 0,
        },
      },
      tokenUsage: {
        total: usage.prompt + usage.completion,
        prompt: usage.prompt,
        completion: usage.completion,
        cached: usage.cached,
        completionDetails: { reasoning: usage.reasoning },
      },
    };
  }
}
