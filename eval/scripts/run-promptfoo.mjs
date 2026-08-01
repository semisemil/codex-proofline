import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import './check-node.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const evalDir = resolve(scriptDir, '..');
const repositoryDir = resolve(evalDir, '..');
const suiteDir = join(evalDir, 'proofline-baseline-quality');
const runtimeDir = join(evalDir, '.runtime');
const runtimeBundle = join(runtimeDir, 'bundle');
const runtimeWorkspaces = join(runtimeDir, 'workspaces');
const runtimeNodeShim = join(runtimeDir, 'node-shim');
const nodeAuditLog = join(runtimeDir, 'node-invocations.jsonl');
const fixtureRoot = join(suiteDir, 'fixtures');
const runtimeFixtures = join(runtimeBundle, 'fixtures');
const sourcePluginManifest = join(repositoryDir, '.codex-plugin', 'plugin.json');
const sourceHooks = join(repositoryDir, 'hooks');
const sourceSkills = join(repositoryDir, 'skills');
const runtimeMarketplace = join(runtimeBundle, 'marketplace');
const runtimePlugin = join(runtimeMarketplace, 'plugins', 'proofline');
const marketplaceName = 'proofline-eval';
const treatmentHookTrust = [
  {
    key: `proofline@${marketplaceName}:hooks/hooks.json:session_start:0:0`,
    hash: 'sha256:075fded01cfb00aa1ca7a72b8c73423f4bbb8e603b529f4e074b8d9f192cea1c',
  },
  {
    key: `proofline@${marketplaceName}:hooks/hooks.json:session_start:1:0`,
    hash: 'sha256:08d615f9ebbdf0e412c32e1b5b1a22be2a75e976334d2c4a06a0ec4ce8d31dcd',
  },
];
const sourceCodexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
const codexCliScript = join(
  evalDir,
  'node_modules',
  '@openai',
  'codex',
  'bin',
  'codex.js',
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureInsideEval(path) {
  const normalized = resolve(path);
  const fromEval = relative(evalDir, normalized);
  if (fromEval.startsWith('..') || isAbsolute(fromEval)) {
    throw new Error(`평가 폴더 밖의 경로는 정리할 수 없습니다: ${normalized}`);
  }
  return normalized;
}

function listFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      files.push(...listFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function collectStringValues(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStringValues(entry, output));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStringValues(entry, output));
  }
  return output;
}

function prepareWorkspace() {
  for (const requiredPath of [
    fixtureRoot,
    sourcePluginManifest,
    sourceHooks,
    sourceSkills,
  ]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`필요한 평가 입력이 없습니다: ${requiredPath}`);
    }
  }

  mkdirSync(runtimeDir, { recursive: true });
  const safeBundle = ensureInsideEval(runtimeBundle);
  const safeWorkspaces = ensureInsideEval(runtimeWorkspaces);
  const safeNodeShim = ensureInsideEval(runtimeNodeShim);
  rmSync(safeBundle, { recursive: true, force: true });
  rmSync(safeWorkspaces, { recursive: true, force: true });
  rmSync(safeNodeShim, { recursive: true, force: true });
  rmSync(ensureInsideEval(nodeAuditLog), { force: true });
  mkdirSync(safeBundle, { recursive: true });
  mkdirSync(safeNodeShim, { recursive: true });
  const shimScript = join(safeNodeShim, 'node-shim.cjs');
  writeFileSync(
    shimScript,
    `const { appendFileSync } = require('node:fs');\nconst { spawnSync } = require('node:child_process');\nconst args = process.argv.slice(2);\nconst result = spawnSync(${JSON.stringify(process.execPath)}, args, { stdio: 'inherit' });\nappendFileSync(${JSON.stringify(nodeAuditLog)}, JSON.stringify({ args, exitCode: result.status, signal: result.signal }) + '\\n', 'utf8');\nif (result.error) throw result.error;\nprocess.exit(result.status ?? 1);\n`,
    'utf8',
  );
  if (process.platform === 'win32') {
    writeFileSync(
      join(safeNodeShim, 'node.cmd'),
      `@"${process.execPath}" "${shimScript}" %*\r\n`,
      'utf8',
    );
  } else {
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
    const unixShim = join(safeNodeShim, 'node');
    writeFileSync(
      unixShim,
      `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(shimScript)} "$@"\n`,
      'utf8',
    );
    chmodSync(unixShim, 0o755);
  }
  cpSync(fixtureRoot, runtimeFixtures, { recursive: true });
  mkdirSync(join(runtimePlugin, '.codex-plugin'), { recursive: true });
  copyFileSync(
    sourcePluginManifest,
    join(runtimePlugin, '.codex-plugin', 'plugin.json'),
  );
  cpSync(sourceHooks, join(runtimePlugin, 'hooks'), { recursive: true });
  cpSync(sourceSkills, join(runtimePlugin, 'skills'), { recursive: true });
  mkdirSync(join(runtimeMarketplace, '.agents', 'plugins'), { recursive: true });
  writeFileSync(
    join(runtimeMarketplace, '.agents', 'plugins', 'marketplace.json'),
    `${JSON.stringify({
      name: marketplaceName,
      interface: { displayName: 'Proofline evaluation' },
      plugins: [{
        name: 'proofline',
        source: { source: 'local', path: './plugins/proofline' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Productivity',
      }],
    }, null, 2)}\n`,
    'utf8',
  );

  const manifestFiles = [
    ...listFiles(fixtureRoot),
    sourcePluginManifest,
    ...listFiles(sourceHooks),
    ...listFiles(sourceSkills),
  ];
  const manifest = {
    createdAt: new Date().toISOString(),
    files: manifestFiles
      .map((path) => ({
        path: relative(repositoryDir, path).replaceAll('\\', '/'),
        sha256: sha256(path),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
  writeFileSync(
    join(runtimeDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return manifest;
}

function createIsolatedCodexHome(condition) {
  const isolatedHome = mkdtempSync(
    ensureInsideEval(join(runtimeDir, `codex-${condition}-`)),
  );

  writeFileSync(
    join(isolatedHome, 'package.json'),
    '{"private":true,"type":"commonjs"}\n',
    'utf8',
  );

  if (process.platform === 'win32') {
    writeFileSync(
      join(isolatedHome, 'config.toml'),
      '[windows]\nsandbox = "unelevated"\n',
      'utf8',
    );
  }

  if (!process.env.OPENAI_API_KEY && !process.env.CODEX_API_KEY) {
    const sourceAuth = join(sourceCodexHome, 'auth.json');
    if (!existsSync(sourceAuth)) {
      rmSync(isolatedHome, { recursive: true, force: true });
      throw new Error(
        [
          'Codex 로그인 정보를 찾지 못했습니다.',
          '먼저 Codex CLI에 로그인하거나 OPENAI_API_KEY를 설정해 주세요.',
        ].join('\n'),
      );
    }
    copyFileSync(sourceAuth, join(isolatedHome, 'auth.json'));
    chmodSync(join(isolatedHome, 'auth.json'), 0o600);
  }
  return isolatedHome;
}

async function installTreatmentPlugin(codexHome) {
  if (!existsSync(codexCliScript)) {
    throw new Error(`Codex CLI를 찾을 수 없습니다: ${codexCliScript}`);
  }
  const env = { ...process.env, CODEX_HOME: codexHome };
  for (const args of [
    ['plugin', 'marketplace', 'add', runtimeMarketplace, '--json'],
    ['plugin', 'add', `proofline@${marketplaceName}`, '--json'],
  ]) {
    const exitCode = await run(codexCliScript, args, env);
    if (exitCode !== 0) {
      throw new Error(`평가용 Proofline 플러그인 설치에 실패했습니다: codex ${args.join(' ')}`);
    }
  }
  const configPath = join(codexHome, 'config.toml');
  const currentConfig = readFileSync(configPath, 'utf8').trimEnd();
  const trustConfig = treatmentHookTrust
    .map(({ key, hash }) => `[hooks.state.${JSON.stringify(key)}]\ntrusted_hash = ${JSON.stringify(hash)}`)
    .join('\n\n');
  writeFileSync(configPath, `${currentConfig}\n\n${trustConfig}\n`, 'utf8');
}

function assertConditionIsolation(controlHome, treatmentHome) {
  const plugin = JSON.parse(readFileSync(sourcePluginManifest, 'utf8'));
  const controlConfig = readFileSync(join(controlHome, 'config.toml'), 'utf8');
  const treatmentConfig = readFileSync(join(treatmentHome, 'config.toml'), 'utf8');
  const installedPlugin = join(
    treatmentHome,
    'plugins',
    'cache',
    marketplaceName,
    'proofline',
    plugin.version,
  );

  if (/proofline/i.test(controlConfig)) {
    throw new Error('미적용 조건의 Codex 설정에 Proofline 항목이 들어갔습니다.');
  }
  if (!treatmentConfig.includes(`proofline@${marketplaceName}`)) {
    throw new Error('적용 조건에서 평가용 Proofline 플러그인이 활성화되지 않았습니다.');
  }
  for (const { key, hash } of treatmentHookTrust) {
    if (!treatmentConfig.includes(key) || !treatmentConfig.includes(hash)) {
      throw new Error('적용 조건의 Proofline hook 신뢰 상태가 고정 입력과 일치하지 않습니다.');
    }
  }
  for (const relativePath of [
    join('.codex-plugin', 'plugin.json'),
    join('hooks', 'hooks.json'),
    join('hooks', 'load-baseline.js'),
    join('skills', 'proofline-baseline-quality', 'SKILL.md'),
  ]) {
    const frozenPath = join(runtimePlugin, relativePath);
    const installedPath = join(installedPlugin, relativePath);
    if (!existsSync(installedPath) || sha256(frozenPath) !== sha256(installedPath)) {
      throw new Error(`설치된 Proofline 플러그인이 고정 입력과 일치하지 않습니다: ${relativePath}`);
    }
  }

  writeFileSync(
    join(runtimeDir, 'conditions.json'),
    `${JSON.stringify({
      control: {
        prooflineInstalled: false,
        sessionStartHook: false,
      },
      treatment: {
        prooflineInstalled: true,
        pluginVersion: plugin.version,
        pluginManifestSha256: sha256(sourcePluginManifest),
        hooksSha256: sha256(join(sourceHooks, 'hooks.json')),
        baselineSkillSha256: sha256(join(sourceSkills, 'proofline-baseline-quality', 'SKILL.md')),
        sessionStartHook: true,
        hookTrust: 'persisted trust for frozen hooks plus automation bypass',
      },
    }, null, 2)}\n`,
    'utf8',
  );
  return installedPlugin;
}

function promptfooExecutable() {
  const executable = join(
    evalDir,
    'node_modules',
    'promptfoo',
    'dist',
    'src',
    'entrypoint.js',
  );
  if (!existsSync(executable)) {
    fail('Promptfoo가 아직 설치되지 않았습니다. eval 폴더에서 npm install을 먼저 실행해 주세요.');
  }
  return executable;
}

function run(executable, args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [executable, ...args], {
      cwd: suiteDir,
      env,
      shell: false,
      stdio: 'inherit',
    });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Promptfoo가 ${signal} 신호로 종료되었습니다.`));
      } else {
        resolvePromise(code ?? 1);
      }
    });
  });
}

function runCapture(executable, args, env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [executable, ...args], {
      cwd: suiteDir,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Codex 진단이 ${signal} 신호로 종료됐습니다.`));
      } else if (code !== 0) {
        rejectPromise(new Error(`Codex 진단에 실패했습니다.\n${stderr.trim()}`));
      } else {
        resolvePromise(stdout);
      }
    });
  });
}

async function assertModelVisibleConditions(controlHome, treatmentHome, installedPlugin) {
  const promptInput = async (codexHome, treatment) => runCapture(
    codexCliScript,
    [
      ...(treatment ? ['--dangerously-bypass-hook-trust'] : []),
      'debug',
      'prompt-input',
      'PROOFLINE_EVAL_INTEGRITY',
    ],
    {
      ...process.env,
      CODEX_HOME: codexHome,
      HOME: codexHome,
      USERPROFILE: codexHome,
    },
  );
  const [control, treatment] = await Promise.all([
    promptInput(controlHome, false),
    promptInput(treatmentHome, true),
  ]);
  const normalize = (value) => value.replaceAll('\\', '/').toLowerCase();
  const controlPrompt = normalize(collectStringValues(JSON.parse(control)).join('\n'));
  const treatmentPrompt = normalize(collectStringValues(JSON.parse(treatment)).join('\n'));
  const installedSkill = normalize(join(
    installedPlugin,
    'skills',
    'proofline-baseline-quality',
    'SKILL.md',
  ));
  const hostProofline = normalize(join(sourceCodexHome, 'plugins', 'cache', 'proofline'));

  if (
    controlPrompt.includes(installedSkill) ||
    controlPrompt.includes(hostProofline)
  ) {
    throw new Error('미적용 조건의 모델 입력에 Proofline 플러그인 스킬이 노출됐습니다.');
  }
  if (treatmentPrompt.includes(hostProofline)) {
    throw new Error('적용 조건이 격리 설치본 대신 사용자 Proofline 플러그인을 참조합니다.');
  }
  return {
    control: { hostProoflineVisible: false },
    treatment: { hostProoflineVisible: false },
  };
}

function normalizeEvaluationExitCode(exitCode, output) {
  if (exitCode === 0 || !output || !existsSync(output)) {
    return exitCode;
  }

  const report = JSON.parse(readFileSync(output, 'utf8'));
  const stats = report.results?.stats ?? report.stats;
  if (stats?.errors !== 0) {
    return exitCode;
  }

  console.log(
    [
      '평가 실행이 오류 없이 끝났습니다.',
      '핵심 기준 실패는 실행 오류와 구분되므로, 성능은 사례별 결과표로 판정하세요.',
    ].join('\n'),
  );
  return 0;
}

function assertResultIsolation(output) {
  if (!existsSync(output)) return;
  const report = JSON.parse(readFileSync(output, 'utf8'));
  const rows = report.results?.results ?? [];
  const promptsByTest = new Map();
  const turnsByTest = new Map();
  const conditionsByTest = new Map();
  const normalize = (value) => value.replaceAll('\\', '/').toLowerCase();
  const forbiddenRoots = [
    join(sourceCodexHome, 'plugins', 'cache', 'proofline'),
    join(sourceCodexHome, 'memories'),
  ].map(normalize);

  for (const row of rows) {
    const prompt = row.prompt?.raw ?? row.prompt;
    if (typeof prompt === 'string') {
      const previous = promptsByTest.get(row.testIdx);
      if (previous !== undefined && previous !== prompt) {
        throw new Error(`조건별 사용자 프롬프트가 일치하지 않습니다: testIdx ${row.testIdx}`);
      }
      promptsByTest.set(row.testIdx, prompt);
    }
    let raw = row.response?.raw ?? '';
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch {}
    }
    const turnInputs = Array.isArray(raw?.turns)
      ? raw.turns.map((turn) => turn.input)
      : null;
    if (turnInputs) {
      const serialized = JSON.stringify(turnInputs);
      const previous = turnsByTest.get(row.testIdx);
      if (previous !== undefined && previous !== serialized) {
        throw new Error(`조건별 멀티턴 사용자 입력이 일치하지 않습니다: testIdx ${row.testIdx}`);
      }
      turnsByTest.set(row.testIdx, serialized);
    }
    const condition = row.response?.metadata?.condition;
    if (typeof condition === 'string') {
      if (!conditionsByTest.has(row.testIdx)) conditionsByTest.set(row.testIdx, new Set());
      conditionsByTest.get(row.testIdx).add(condition);
    }
    const evidence = normalize(collectStringValues(raw).join('\n'));
    if (forbiddenRoots.some((root) => evidence.includes(root))) {
      throw new Error(`평가 세션이 사용자 Proofline 또는 memory 경로를 읽었습니다: testIdx ${row.testIdx}, promptIdx ${row.promptIdx}`);
    }
  }
  for (const [testIdx, conditions] of conditionsByTest) {
    if (conditions.size !== 2 || !conditions.has('control') || !conditions.has('treatment')) {
      throw new Error(`평가 조건 쌍이 완전하지 않습니다: testIdx ${testIdx}`);
    }
    if (!turnsByTest.has(testIdx)) {
      throw new Error(`실행된 사용자 턴 기록을 찾지 못했습니다: testIdx ${testIdx}`);
    }
  }
}

function inspectSessionHome(codexHome) {
  const sessionsRoot = join(codexHome, 'sessions');
  if (!existsSync(sessionsRoot)) return { sessions: 0, originators: [], text: '' };
  const sessionFiles = listFiles(sessionsRoot).filter((path) => path.endsWith('.jsonl'));
  const originators = new Set();
  const textParts = [];
  for (const path of sessionFiles) {
    const source = readFileSync(path, 'utf8');
    textParts.push(source);
    for (const line of source.split(/\r?\n/)) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'session_meta' && entry.payload?.originator) {
          originators.add(entry.payload.originator);
        }
      } catch {}
    }
  }
  return {
    sessions: sessionFiles.length,
    originators: [...originators].sort(),
    text: textParts.join('\n'),
  };
}

function inspectHookAudit(installedPlugin) {
  if (!existsSync(nodeAuditLog)) return { starts: 0, exits: [] };
  const hookPath = join(installedPlugin, 'hooks', 'load-baseline.js')
    .replaceAll('\\', '/')
    .toLowerCase();
  const records = readFileSync(nodeAuditLog, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.args.some(
      (arg) => arg.replaceAll('\\', '/').toLowerCase() === hookPath,
    ));
  return {
    starts: records.length,
    exits: records.map((entry) => entry.exitCode),
  };
}

function assertSessionIsolation(controlHome, treatmentHome, installedPlugin, output) {
  if (!existsSync(output)) return;
  const report = JSON.parse(readFileSync(output, 'utf8'));
  const rows = report.results?.results ?? [];
  const normalize = (value) => value.replaceAll('\\', '/').toLowerCase();
  const forbidden = {
    hostProofline: normalize(join(sourceCodexHome, 'plugins', 'cache', 'proofline')),
    hostMemory: normalize(join(sourceCodexHome, 'memories')),
  };
  const installedPluginRoot = normalize(installedPlugin);
  const checks = [
    ['control', controlHome, rows.some((row) => row.response?.metadata?.condition === 'control')],
    ['treatment', treatmentHome, rows.some((row) => row.response?.metadata?.condition === 'treatment')],
  ].map(([condition, codexHome, expected]) => {
    const inspected = inspectSessionHome(codexHome);
    const hookAudit = condition === 'treatment'
      ? inspectHookAudit(installedPlugin)
      : { starts: 0, exits: [] };
    const text = normalize(inspected.text);
    const forbiddenHits = Object.entries(forbidden)
      .filter(([, path]) => text.includes(path))
      .map(([name]) => name);
    const installedPluginReferenced = text.includes(installedPluginRoot);
    if (expected && inspected.sessions === 0) {
      throw new Error(`${condition} 조건의 Codex 세션 기록을 찾지 못했습니다.`);
    }
    if (forbiddenHits.length > 0) {
      throw new Error(
        `${condition} 조건의 모델 입력에 사용자 상태가 노출됐습니다: ${forbiddenHits.join(', ')}; originator=${inspected.originators.join(',') || 'unknown'}`,
      );
    }
    if (condition === 'control' && installedPluginReferenced) {
      throw new Error('미적용 조건의 모델 입력에 평가용 Proofline 플러그인이 노출됐습니다.');
    }
    if (condition === 'control' && hookAudit.starts > 0) {
      throw new Error('미적용 조건에서 Proofline SessionStart baseline hook이 실행됐습니다.');
    }
    if (
      condition === 'treatment' &&
      expected &&
      (
        hookAudit.starts === 0 ||
        hookAudit.exits.length !== hookAudit.starts ||
        hookAudit.exits.some((code) => code !== 0)
      )
    ) {
      throw new Error('적용 조건의 Proofline SessionStart baseline hook이 성공적으로 끝나지 않았습니다.');
    }
    return {
      condition,
      sessions: inspected.sessions,
      originators: inspected.originators,
      hostProoflineVisible: false,
      hostMemoryVisible: false,
      installedPluginReferenced,
      baselineHookRuns: hookAudit.starts,
      baselineHookSuccessful: hookAudit.starts > 0 && hookAudit.exits.every((code) => code === 0),
    };
  });
  writeFileSync(
    join(runtimeDir, 'session-integrity.json'),
    `${JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2)}\n`,
    'utf8',
  );
  return checks;
}

function attachEvaluationMetadata(output, sessionChecks, modelInputChecks) {
  const report = JSON.parse(readFileSync(output, 'utf8'));
  const conditions = JSON.parse(readFileSync(join(runtimeDir, 'conditions.json'), 'utf8'));
  report.metadata = {
    ...report.metadata,
    prooflineComparison: {
      architecture: 'one-identical-prompt-two-isolated-providers',
      userPromptTemplateSha256: sha256(join(suiteDir, 'prompts', 'task.txt')),
      conditions,
      sessionChecks,
      modelInputChecks,
    },
  };
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

const mode = process.argv[2];
const extraArgs = process.argv.slice(3);
if (!['prepare', 'validate', 'smoke', 'full', 'view'].includes(mode)) {
  fail('사용법: node scripts/run-promptfoo.mjs <prepare|validate|smoke|full|view>');
}

try {
  const manifest = prepareWorkspace();
  if (mode === 'prepare') {
    console.log(`평가 작업공간을 준비했습니다. 입력 파일 ${manifest.files.length}개의 해시를 기록했습니다.`);
    process.exit(0);
  }

  const executable = promptfooExecutable();
  const promptfooConfigDir = join(runtimeDir, 'promptfoo');
  const baseEnv = {
    ...process.env,
    PROMPTFOO_CONFIG_DIR: promptfooConfigDir,
    PROMPTFOO_CACHE_PATH: join(promptfooConfigDir, 'cache'),
    PROMPTFOO_LOG_DIR: join(promptfooConfigDir, 'logs'),
    PROMPTFOO_DISABLE_TELEMETRY: '1',
    PROMPTFOO_DISABLE_UPDATE: '1',
    PROMPTFOO_DISABLE_SHARING: '1',
    PROMPTFOO_DISABLE_REMOTE_GENERATION: 'true',
  };
  if (mode === 'view') {
    process.exit(await run(executable, ['view'], baseEnv));
  }

  const controlCodexHome = createIsolatedCodexHome('control');
  const treatmentCodexHome = createIsolatedCodexHome('treatment');
  try {
    await installTreatmentPlugin(treatmentCodexHome);
    const installedPlugin = assertConditionIsolation(controlCodexHome, treatmentCodexHome);
    const modelInputChecks = await assertModelVisibleConditions(
      controlCodexHome,
      treatmentCodexHome,
      installedPlugin,
    );
    const env = {
      ...baseEnv,
      PROOFLINE_CONTROL_CODEX_HOME: controlCodexHome,
      PROOFLINE_TREATMENT_CODEX_HOME: treatmentCodexHome,
      PROOFLINE_EVAL_BUNDLE: runtimeBundle,
      PROMPTFOO_CACHE_ENABLED: 'false',
    };
    const configArgs = ['-c', 'promptfooconfig.yaml'];
    let args;
    let output;
    if (mode === 'validate') {
      args = ['validate', ...configArgs, ...extraArgs];
    } else {
      const repeat = mode === 'smoke' ? '1' : '3';
      output = join('results', 'local', `${mode}.json`);
      mkdirSync(join(suiteDir, 'results', 'local'), { recursive: true });
      rmSync(join(suiteDir, output), { force: true });
      args = [
        'eval',
        ...configArgs,
        '--no-cache',
        '--max-concurrency',
        '1',
        '--repeat',
        repeat,
        '-o',
        output,
        ...extraArgs,
      ];
    }
    const exitCode = await run(executable, args, env);
    if (['smoke', 'full'].includes(mode)) {
      const sessionChecks = assertSessionIsolation(
        controlCodexHome,
        treatmentCodexHome,
        installedPlugin,
        join(suiteDir, output),
      );
      assertResultIsolation(join(suiteDir, output));
      attachEvaluationMetadata(join(suiteDir, output), sessionChecks, modelInputChecks);
    }
    process.exitCode = ['smoke', 'full'].includes(mode)
      ? normalizeEvaluationExitCode(exitCode, join(suiteDir, output))
      : exitCode;
  } finally {
    rmSync(controlCodexHome, { recursive: true, force: true });
    rmSync(treatmentCodexHome, { recursive: true, force: true });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
