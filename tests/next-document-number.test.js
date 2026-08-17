const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const hookPath = path.join(repoRoot, 'hooks', 'next-document-number.js');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-number-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function touch(root, relativePath) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '', 'utf8');
}

function runHook(root, prompt) {
  return spawnSync(process.execPath, [hookPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: root,
      USERPROFILE: root,
    },
    input: JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      cwd: root,
      prompt,
    }),
  });
}

function context(result) {
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.systemMessage, undefined);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  return parsed.hookSpecificOutput.additionalContext;
}

test('unrelated prompts and non-invocation mentions emit zero stdout bytes', (t) => {
  const root = fixture(t);
  for (const prompt of [
    'Register an issue.',
    'Please use $proofline:issue-ledger for this.',
    'Compare $proofline:development-plan and another skill.',
  ]) {
    const result = runHook(root, prompt);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(Buffer.byteLength(result.stdout), 0);
  }
});

test('issue-ledger receives the next issue number from issue filenames', (t) => {
  const root = fixture(t);
  touch(root, '.proofline/issues/PL-0002.json');
  touch(root, '.proofline/issues/PL-0012-old.md');
  touch(root, '.proofline/issues/not-an-issue.json');

  assert.equal(
    context(runHook(root, '$proofline:issue-ledger\nRegister this work.')),
    'Next issue number: PL-0013',
  );
});

test('implementation-spec receives the next specification number from Spec directories', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.proofline/specs/SPEC-0004-response-modes'), { recursive: true });
  fs.mkdirSync(path.join(root, '.proofline/specs/SPEC-0020-another-spec'), { recursive: true });

  assert.equal(
    context(runHook(root, '  $proofline:implementation-spec   \nWrite a Spec.')),
    'Next specification number: SPEC-0021',
  );
});

test('development-plan receives the next plan number and missing ledgers start at one', (t) => {
  const populated = fixture(t);
  fs.mkdirSync(path.join(populated, '.proofline/plan/PLAN-9999-roadmap'), { recursive: true });
  assert.equal(
    context(runHook(populated, '$proofline:development-plan\nWrite a Plan.')),
    'Next plan number: PLAN-10000',
  );

  const empty = fixture(t);
  assert.equal(
    context(runHook(empty, '$proofline:development-plan')),
    'Next plan number: PLAN-0001',
  );
});

test('figure-it-out receives candidate Plan and Spec numbers', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.proofline/plan/PLAN-0003-roadmap'), { recursive: true });
  fs.mkdirSync(path.join(root, '.proofline/specs/SPEC-0011-settings'), { recursive: true });

  assert.equal(
    context(runHook(root, '$proofline:figure-it-out\nTake this change through implementation.')),
    'Next plan number: PLAN-0004\nNext specification number: SPEC-0012',
  );
});

test('a numbering read failure is logged and leaves the skill able to fall back', (t) => {
  const root = fixture(t);
  touch(root, '.proofline/issues');
  const result = runHook(root, '$proofline:issue-ledger');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(Buffer.byteLength(result.stdout), 0);

  const logPath = path.join(root, '.codex', 'log', 'proofline-hook.log');
  const entry = JSON.parse(fs.readFileSync(logPath, 'utf8').trim());
  assert.equal(entry.hook, 'next-document-number');
  assert.equal(entry.event, 'UserPromptSubmit');
  assert.match(entry.filePath, /\.proofline[\\/]issues$/);
});
