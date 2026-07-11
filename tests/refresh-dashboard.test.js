const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const hookPath = path.join(repoRoot, 'hooks', 'refresh-dashboard.js');
const bundledDashboard = path.join(
  repoRoot,
  'skills',
  'proofline-issue-ledger',
  'assets',
  'state-starter',
  'dashboard',
);

// 실제 훅 입력과 같은 JSON을 전달해 프로젝트별 동작을 확인한다.
function runHook(cwd, env = process.env, script = hookPath) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env,
    input: JSON.stringify({ cwd, hook_event_name: 'SessionStart', source: 'startup' }),
  });
}

// 가장 낮은 호출 빈도를 유지하도록 대시보드 훅은 새 대화에서만 실행한다.
test('dashboard hook is registered for startup only', () => {
  const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hooks', 'hooks.json'), 'utf8'));
  const hook = config.hooks.SessionStart.find((entry) =>
    entry.hooks.some((item) => item.command.includes('refresh-dashboard.js')),
  );

  assert.equal(hook.matcher, 'startup');
});

// 오래된 정적 파일만 교체하고 원장과 다른 프로젝트 파일은 보존한다.
test('dashboard hook refreshes an outdated dashboard', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-dashboard-'));
  const prooflineRoot = path.join(projectRoot, '.proofline');
  const dashboard = path.join(prooflineRoot, 'dashboard');
  const issuePath = path.join(prooflineRoot, 'issues', 'PL-0001.md');
  const customPath = path.join(prooflineRoot, 'custom.txt');
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(issuePath), { recursive: true });
  fs.mkdirSync(dashboard, { recursive: true });
  fs.writeFileSync(path.join(dashboard, 'VERSION'), '0\n', 'utf8');
  fs.writeFileSync(path.join(dashboard, 'index.html'), 'old dashboard', 'utf8');
  fs.writeFileSync(issuePath, 'issue remains', 'utf8');
  fs.writeFileSync(customPath, 'custom remains', 'utf8');

  const result = runHook(projectRoot);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(path.join(dashboard, 'VERSION'), 'utf8'),
    fs.readFileSync(path.join(bundledDashboard, 'VERSION'), 'utf8'),
  );
  assert.equal(
    fs.readFileSync(path.join(dashboard, 'index.html'), 'utf8'),
    fs.readFileSync(path.join(bundledDashboard, 'index.html'), 'utf8'),
  );
  assert.equal(fs.readFileSync(issuePath, 'utf8'), 'issue remains');
  assert.equal(fs.readFileSync(customPath, 'utf8'), 'custom remains');
});

// 현재 버전 이상인 대시보드는 사용자의 로컬 파일을 덮어쓰지 않는다.
test('dashboard hook leaves a current dashboard unchanged', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-dashboard-'));
  const dashboard = path.join(projectRoot, '.proofline', 'dashboard');
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  fs.mkdirSync(dashboard, { recursive: true });
  fs.writeFileSync(path.join(dashboard, 'VERSION'), '999\n', 'utf8');
  fs.writeFileSync(path.join(dashboard, 'index.html'), 'keep local dashboard', 'utf8');

  const result = runHook(projectRoot);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dashboard, 'index.html'), 'utf8'), 'keep local dashboard');
});

// Proofline 원장이 없는 프로젝트는 시작 훅만으로 상태 디렉터리가 생기면 안 된다.
test('dashboard hook ignores projects without Proofline state', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-dashboard-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));

  const result = runHook(projectRoot);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(projectRoot, '.proofline')), false);
});

// 패키지 자산 누락은 조용히 넘어가지 않고 진단 로그를 남긴다.
test('dashboard hook reports missing bundled assets', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-dashboard-hook-'));
  const tempHookDir = path.join(tempRoot, 'hooks');
  const projectRoot = path.join(tempRoot, 'project');
  const tempHome = path.join(tempRoot, 'home');
  const copiedHook = path.join(tempHookDir, 'refresh-dashboard.js');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  fs.mkdirSync(path.join(projectRoot, '.proofline'), { recursive: true });
  fs.mkdirSync(tempHookDir, { recursive: true });
  fs.copyFileSync(hookPath, copiedHook);

  const result = runHook(
    projectRoot,
    { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
    copiedHook,
  );
  const logPath = path.join(tempHome, '.codex', 'log', 'proofline-hook.log');
  const entry = JSON.parse(fs.readFileSync(logPath, 'utf8').trim());

  assert.equal(result.status, 1);
  assert.equal(entry.hook, 'refresh-dashboard');
  assert.equal(entry.code, 'ENOENT');
});
