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
  const configRoot = path.join(root, 'config');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    env: {
      ...process.env,
      APPDATA: configRoot,
      XDG_CONFIG_HOME: configRoot,
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

function assertModeAtResponseSlot(prompt, pattern) {
  const wordingIndex = prompt.indexOf('Wording:');
  const modeIndex = prompt.search(pattern);
  const clarityIndex = prompt.indexOf('Clarity:');
  assert.ok(wordingIndex >= 0 && wordingIndex < modeIndex);
  assert.ok(modeIndex < clarityIndex);
  assert.doesNotMatch(prompt, /proofline-response-mode|^# (?:Normal|Focus|Caveman) response mode|shared Proofline baseline/m);
}

test('startup inserts normal at the response slot', (t) => {
  const { env } = fixture(t);
  const result = runLoader(env, 'session-a', 'startup');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Proofline/);
  assert.equal((result.stdout.match(/^Clarity:/gm) || []).length, 1);
  assert.equal((result.stdout.match(/^Attention:/gm) || []).length, 1);
  assert.doesNotMatch(result.stdout, /^Compression:|^Content eligibility:/m);
  assert.match(result.stdout, /target language's conventional syntax/);
  assertModeAtResponseSlot(result.stdout, /target language's conventional syntax/);
  assert.doesNotMatch(result.stdout, /normal conversational response style/);
  assert.doesNotMatch(result.stdout, /Replace and ignore previous Proofline focus or caveman/);
  assert.doesNotMatch(result.stdout, /^---|\$proofline|defaultMode|session_id/);
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
    assert.match(result.stdout, /target language's conventional syntax/);
    assertModeAtResponseSlot(result.stdout, /Use line breaks with noun phrases/);
    assert.doesNotMatch(result.stdout, /Use ultra-compressed responses/);
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
  assertModeAtResponseSlot(existing.stdout, /Use ultra-compressed responses/);
  assert.doesNotMatch(existing.stdout, /conventional syntax/);
  assertModeAtResponseSlot(fresh.stdout, /Use line breaks with noun phrases/);
  assert.match(fresh.stdout, /target language's conventional syntax/);
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
  fs.copyFileSync(path.join(repoRoot, 'hooks', 'proofline-prompt.js'), path.join(hooksDir, 'proofline-prompt.js'));
  fs.copyFileSync(path.join(repoRoot, 'hooks', 'proofline-state.js'), path.join(hooksDir, 'proofline-state.js'));
  fs.copyFileSync(path.join(repoRoot, 'skills', 'proofline', 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  const result = runLoader(env, 'session-a', 'startup', path.join(hooksDir, 'load-proofline.js'));
  assert.equal(result.status, 1);
  const logPath = path.join(env.HOME, '.codex', 'log', 'proofline-hook.log');
  const entries = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.match(entries.at(-1).filePath, /proofline[\\/]normal\.md$/);
});

test('a missing baseline fails and records the exact component path', (t) => {
  const { root, env } = fixture(t);
  const tempPlugin = path.join(root, 'plugin');
  const hooksDir = path.join(tempPlugin, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.copyFileSync(loaderPath, path.join(hooksDir, 'load-proofline.js'));
  fs.copyFileSync(path.join(repoRoot, 'hooks', 'proofline-prompt.js'), path.join(hooksDir, 'proofline-prompt.js'));
  fs.copyFileSync(path.join(repoRoot, 'hooks', 'proofline-state.js'), path.join(hooksDir, 'proofline-state.js'));

  const result = runLoader(env, 'session-a', 'startup', path.join(hooksDir, 'load-proofline.js'));
  assert.equal(result.status, 1);

  const logPath = path.join(env.HOME, '.codex', 'log', 'proofline-hook.log');
  const entries = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  const entry = entries.at(-1);
  assert.equal(entry.code, 'ENOENT');
  assert.equal(entry.pluginRoot, tempPlugin);
  assert.match(entry.skillPath, /proofline[\\/]SKILL\.md$/);
  assert.match(entry.filePath, /proofline[\\/]SKILL\.md$/);
});

test('a missing response slot fails and records the baseline path', (t) => {
  const { root, env } = fixture(t);
  const tempPlugin = path.join(root, 'plugin');
  const hooksDir = path.join(tempPlugin, 'hooks');
  const skillDir = path.join(tempPlugin, 'skills', 'proofline');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(loaderPath, path.join(hooksDir, 'load-proofline.js'));
  fs.copyFileSync(path.join(repoRoot, 'hooks', 'proofline-prompt.js'), path.join(hooksDir, 'proofline-prompt.js'));
  fs.copyFileSync(path.join(repoRoot, 'hooks', 'proofline-state.js'), path.join(hooksDir, 'proofline-state.js'));
  const baseline = fs.readFileSync(path.join(repoRoot, 'skills', 'proofline', 'SKILL.md'), 'utf8')
    .replace('<!-- proofline-response-mode -->', '');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), baseline, 'utf8');
  fs.copyFileSync(path.join(repoRoot, 'skills', 'proofline', 'normal.md'), path.join(skillDir, 'normal.md'));

  const result = runLoader(env, 'session-a', 'startup', path.join(hooksDir, 'load-proofline.js'));
  assert.equal(result.status, 1);
  const logPath = path.join(env.HOME, '.codex', 'log', 'proofline-hook.log');
  const entry = JSON.parse(fs.readFileSync(logPath, 'utf8').trim());
  assert.equal(entry.code, 'INVALID_MODE_SLOT');
  assert.match(entry.filePath, /proofline[\\/]SKILL\.md$/);
});
