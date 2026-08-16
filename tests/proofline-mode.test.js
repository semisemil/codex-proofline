const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const hookPath = path.join(repoRoot, 'hooks', 'proofline-mode.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-mode-'));
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

function runHook(env, prompt, sessionId = 'session-a') {
  return spawnSync(process.execPath, [hookPath], {
    encoding: 'utf8',
    env,
    input: JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      session_id: sessionId,
      turn_id: 'turn-1',
      prompt,
    }),
  });
}

function output(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function statePath(env, sessionId = 'session-a') {
  return path.join(env.PLUGIN_DATA, 'proofline-mode', `${sessionId}.json`);
}

test('ordinary prompts and namespaced skill calls emit zero stdout bytes and keep state unchanged', (t) => {
  const { env } = fixture(t);
  const ordinary = runHook(env, 'Please review this file.');
  assert.equal(ordinary.status, 0, ordinary.stderr);
  assert.equal(Buffer.byteLength(ordinary.stdout), 0);
  assert.equal(fs.existsSync(statePath(env)), false);

  const skill = runHook(env, '$proofline:implementation-spec\nWrite a Spec.');
  assert.equal(skill.status, 0, skill.stderr);
  assert.equal(Buffer.byteLength(skill.stdout), 0);
  assert.equal(fs.existsSync(statePath(env)), false);
});

test('status and default queries report canonical modes without changing state', (t) => {
  const { env } = fixture(t);
  let response = output(runHook(env, '$proofline'));
  assert.match(response.systemMessage, /현재 모드 normal, 기본 모드 normal/);
  assert.equal(fs.existsSync(statePath(env)), false);

  output(runHook(env, '$proofline focus'));
  const before = fs.readFileSync(statePath(env), 'utf8');

  response = output(runHook(env, '$proofline default'));
  assert.match(response.systemMessage, /기본 모드 normal/);
  assert.equal(fs.readFileSync(statePath(env), 'utf8'), before);
});

test('mode changes are ASCII case-insensitive and replace prior mode instructions', (t) => {
  const { env } = fixture(t);
  const response = output(runHook(env, '\n  $proofline FoCuS  '));
  assert.match(response.systemMessage, /focus/);
  assert.match(response.hookSpecificOutput.additionalContext, /Replace any previous Proofline response-mode instructions/);
  assert.match(response.hookSpecificOutput.additionalContext, /# Focus response mode/);
  assert.doesNotMatch(response.hookSpecificOutput.additionalContext, /# Normal response mode|# Caveman response mode/);
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath(env), 'utf8')), { mode: 'focus' });
});

test('a valid command is applied before the remaining task', (t) => {
  const { env } = fixture(t);
  const response = output(runHook(env, '$proofline caveman\nDiagnose the failing test.'));
  assert.match(response.hookSpecificOutput.additionalContext, /# Caveman response mode/);
  assert.match(response.hookSpecificOutput.additionalContext, /Continue the remaining user request/);
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath(env), 'utf8')), { mode: 'caveman' });
});

test('invalid modes, missing shapes, and extra arguments preserve the current mode and continue work', (t) => {
  const { env } = fixture(t);
  output(runHook(env, '$proofline focus'));
  const invalidPrompts = [
    '$proofline verbose\nKeep reviewing.',
    '$proofline focus extra\nKeep reviewing.',
    '$proofline default focus extra\nKeep reviewing.',
  ];

  for (const prompt of invalidPrompts) {
    const response = output(runHook(env, prompt));
    assert.match(response.systemMessage, /잘못된 명령/);
    assert.doesNotMatch(response.systemMessage, /\r|\n/);
    assert.match(response.hookSpecificOutput.additionalContext, /Continue the remaining user request/);
    assert.deepEqual(JSON.parse(fs.readFileSync(statePath(env), 'utf8')), { mode: 'focus' });
  }
});

test('default changes persist first and immediately apply to the current session', (t) => {
  const { env } = fixture(t);
  const response = output(runHook(env, '$proofline default CAVEMAN'));
  assert.match(response.systemMessage, /기본 모드와 현재 모드를 caveman/);
  assert.match(response.hookSpecificOutput.additionalContext, /# Caveman response mode/);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(env.APPDATA, 'proofline', 'config.json'), 'utf8')),
    { defaultMode: 'caveman' },
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath(env), 'utf8')), { mode: 'caveman' });

  output(runHook(env, '$proofline focus', 'session-b'));
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath(env, 'session-b'), 'utf8')), { mode: 'focus' });
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath(env), 'utf8')), { mode: 'caveman' });
});

for (const [label, sessionId] of [
  ['empty', ''],
  ['oversized', 'a'.repeat(176)],
]) {
  test(`${label} session IDs apply a default change immediately without session state`, (t) => {
    const { env } = fixture(t);
    const changed = output(runHook(env, '$proofline default focus', sessionId));
    assert.match(changed.systemMessage, /기본 모드와 현재 모드를 focus로 변경/);
    assert.match(changed.hookSpecificOutput.additionalContext, /# Focus response mode/);
    assert.equal(fs.existsSync(path.join(env.PLUGIN_DATA, 'proofline-mode')), false);

    const queried = output(runHook(env, '$proofline', sessionId));
    assert.match(queried.systemMessage, /현재 모드 focus, 기본 모드 focus/);
    assert.equal(fs.existsSync(path.join(env.PLUGIN_DATA, 'proofline-mode')), false);
  });
}

test('default write failure changes neither mode', (t) => {
  const { root, env } = fixture(t);
  output(runHook(env, '$proofline focus'));
  const blockedAppData = path.join(root, 'blocked-appdata');
  fs.writeFileSync(blockedAppData, 'file', 'utf8');
  const failedEnv = { ...env, APPDATA: blockedAppData };
  const response = output(runHook(failedEnv, '$proofline default caveman'));
  assert.match(response.systemMessage, /기본 모드 저장 실패/);
  assert.deepEqual(JSON.parse(fs.readFileSync(statePath(env), 'utf8')), { mode: 'focus' });
});

test('a current-session write failure preserves a successfully saved default and reports partial failure', (t) => {
  const { root, env } = fixture(t);
  const blockedPluginData = path.join(root, 'blocked-plugin-data');
  fs.writeFileSync(blockedPluginData, 'file', 'utf8');
  const failedEnv = { ...env, PLUGIN_DATA: blockedPluginData };
  const response = output(runHook(failedEnv, '$proofline default focus'));
  assert.match(response.systemMessage, /현재 모드 변경 실패/);
  assert.match(response.hookSpecificOutput.additionalContext, /Do not replace/);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(env.APPDATA, 'proofline', 'config.json'), 'utf8')),
    { defaultMode: 'focus' },
  );
});
