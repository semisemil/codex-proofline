import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';

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

function normalizeTurns(prompt, context) {
  const configured = context?.vars?.turns;
  if (configured === undefined) return [prompt];
  if (!Array.isArray(configured) || configured.length === 0) {
    throw new Error('vars.turns는 비어 있지 않은 문자열 배열이어야 합니다.');
  }
  if (configured.some((turn) => typeof turn !== 'string' || turn.trim() === '')) {
    throw new Error('vars.turns의 각 항목은 비어 있지 않은 문자열이어야 합니다.');
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
    if (!codexHome || typeof workingDirectory !== 'string') {
      throw new Error('격리된 CODEX_HOME 또는 평가 작업공간을 찾지 못했습니다.');
    }

    ensureProjectTrusted(codexHome, workingDirectory);
    const runtime = codexRuntime();
    const env = codexEnvironment(codexHome, runtime.pathDirs);
    const turns = normalizeTurns(prompt, context);
    const responses = [];
    const items = [];
    const usage = { prompt: 0, cached: 0, completion: 0, reasoning: 0 };
    let threadId;
    for (const input of turns) {
      const result = await runCodexTurn({
        runtime,
        env,
        config: this.config,
        condition,
        workingDirectory,
        input,
        threadId,
      });
      threadId = result.threadId;
      responses.push(result.finalResponse);
      items.push(...result.items);
      addUsage(usage, result.usage);
    }

    return {
      output: responses.at(-1) ?? '',
      prompt: turns.join('\n\n--- 다음 사용자 턴 ---\n\n'),
      raw: { items, turns: responses.map((output, index) => ({ input: turns[index], output })) },
      metadata: {
        condition,
        threadId,
        turnCount: turns.length,
        turnResponses: responses,
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
