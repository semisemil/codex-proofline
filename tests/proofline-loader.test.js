const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const loaderPath = path.join(repoRoot, 'hooks', 'load-proofline.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-loader-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    env: {
      ...process.env,
      APPDATA: path.join(root, 'appdata'),
      PLUGIN_DATA: path.join(root, 'plugin-data'),
      HOME: path.join(root, 'home'),
      USERPROFILE: path.join(root, 'home'),
    },
  };
}

function runLoader(env, sessionId, source, script = loaderPath) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env,
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: sessionId,
      source,
    }),
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value), 'utf8');
}

test('startup selects normal by default and injects only the baseline plus one mode', (t) => {
  const { env } = fixture(t);
  const result = runLoader(env, 'session-a', 'startup');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Proofline/);
  assert.equal((result.stdout.match(/# Normal response mode/g) || []).length, 1);
  assert.doesNotMatch(result.stdout, /^---|# Focus response mode|# Caveman response mode|\$proofline|defaultMode|session_id/);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(env.PLUGIN_DATA, 'proofline-mode', 'session-a.json'), 'utf8')),
    { mode: 'normal' },
  );
});

test('startup, clear, and compact preserve the stored mode for one session', (t) => {
  const { env } = fixture(t);
  const statePath = path.join(env.PLUGIN_DATA, 'proofline-mode', 'session-a.json');
  writeJson(statePath, { mode: 'focus' });

  for (const source of ['startup', 'clear', 'compact']) {
    const result = runLoader(env, 'session-a', source);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# Focus response mode/);
    assert.doesNotMatch(result.stdout, /# Normal response mode|# Caveman response mode/);
    assert.deepEqual(JSON.parse(fs.readFileSync(statePath, 'utf8')), { mode: 'focus' });
  }
});

test('new session IDs initialize from the latest default without changing existing sessions', (t) => {
  const { env } = fixture(t);
  writeJson(path.join(env.PLUGIN_DATA, 'proofline-mode', 'session-a.json'), { mode: 'caveman' });
  writeJson(path.join(env.APPDATA, 'proofline', 'config.json'), { defaultMode: 'focus' });

  const existing = runLoader(env, 'session-a', 'startup');
  const fresh = runLoader(env, 'session-b', 'startup');
  assert.equal(existing.status, 0, existing.stderr);
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.match(existing.stdout, /# Caveman response mode/);
  assert.match(fresh.stdout, /# Focus response mode/);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(env.PLUGIN_DATA, 'proofline-mode', 'session-a.json'), 'utf8')),
    { mode: 'caveman' },
  );
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(env.PLUGIN_DATA, 'proofline-mode', 'session-b.json'), 'utf8')),
    { mode: 'focus' },
  );
});

test('resume produces no injection and creates no session state', (t) => {
  const { env } = fixture(t);
  const result = runLoader(env, 'session-a', 'resume');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(Buffer.byteLength(result.stdout), 0);
  assert.equal(fs.existsSync(path.join(env.PLUGIN_DATA, 'proofline-mode', 'session-a.json')), false);
});

test('a missing selected mode fails and records the exact component path', (t) => {
  const { root, env } = fixture(t);
  const tempPlugin = path.join(root, 'plugin');
  const hooksDir = path.join(tempPlugin, 'hooks');
  const skillDir = path.join(tempPlugin, 'skills', 'proofline');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(loaderPath, path.join(hooksDir, 'load-proofline.js'));
  fs.copyFileSync(path.join(repoRoot, 'hooks', 'proofline-state.js'), path.join(hooksDir, 'proofline-state.js'));
  fs.copyFileSync(path.join(repoRoot, 'skills', 'proofline', 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  const result = runLoader(env, 'session-a', 'startup', path.join(hooksDir, 'load-proofline.js'));
  assert.equal(result.status, 1);
  const logPath = path.join(env.HOME, '.codex', 'log', 'proofline-hook.log');
  const entries = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.match(entries.at(-1).filePath, /proofline[\\/]normal\.md$/);
});
