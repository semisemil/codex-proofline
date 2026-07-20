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
import { homedir, tmpdir } from 'node:os';
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
const fixtureRoot = join(suiteDir, 'fixtures');
const runtimeFixtures = join(runtimeBundle, 'fixtures');
const sourceSkill = join(repositoryDir, 'skills', 'proofline-baseline-quality');
const runtimeSkill = join(
  runtimeBundle,
  'skill',
  'proofline-baseline-quality',
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

function prepareWorkspace() {
  for (const requiredPath of [fixtureRoot, sourceSkill]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`필요한 평가 입력이 없습니다: ${requiredPath}`);
    }
  }

  mkdirSync(runtimeDir, { recursive: true });
  const safeBundle = ensureInsideEval(runtimeBundle);
  const safeWorkspaces = ensureInsideEval(runtimeWorkspaces);
  rmSync(safeBundle, { recursive: true, force: true });
  rmSync(safeWorkspaces, { recursive: true, force: true });
  mkdirSync(safeBundle, { recursive: true });
  cpSync(fixtureRoot, runtimeFixtures, { recursive: true });
  mkdirSync(dirname(runtimeSkill), { recursive: true });
  cpSync(sourceSkill, runtimeSkill, { recursive: true });

  const manifestFiles = [
    ...listFiles(fixtureRoot),
    ...listFiles(sourceSkill),
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

function createIsolatedCodexHome() {
  const isolatedHome = mkdtempSync(join(tmpdir(), 'proofline-eval-codex-'));

  if (process.platform === 'win32') {
    writeFileSync(
      join(isolatedHome, 'config.toml'),
      '[windows]\nsandbox = "unelevated"\n',
      'utf8',
    );
  }

  if (!process.env.OPENAI_API_KEY && !process.env.CODEX_API_KEY) {
    const currentCodexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
    const sourceAuth = join(currentCodexHome, 'auth.json');
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

  const isolatedCodexHome = createIsolatedCodexHome();
  try {
    const env = {
      ...baseEnv,
      CODEX_HOME: isolatedCodexHome,
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
    process.exitCode = ['smoke', 'full'].includes(mode)
      ? normalizeEvaluationExitCode(exitCode, join(suiteDir, output))
      : exitCode;
  } finally {
    rmSync(isolatedCodexHome, { recursive: true, force: true });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
