'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const script = path.resolve(__dirname, '..', 'skills', 'start-implementation', 'scripts', 'prepare-review.js');

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-review-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 }));
  git(cwd, 'init');
  git(cwd, 'config', 'user.email', 'proofline@example.invalid');
  git(cwd, 'config', 'user.name', 'Proofline Test');
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'before\n');
  git(cwd, 'add', '--', 'tracked.txt');
  git(cwd, 'commit', '-m', 'base');
  return cwd;
}

function run(cwd, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', windowsHide: true });
}

test('stage, verify, and unstage preserve the reviewed working changes', (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'after\n');
  fs.writeFileSync(path.join(cwd, 'added.txt'), 'new\n');

  const staged = run(cwd, 'stage', '--cwd', cwd, '--path', 'tracked.txt', '--path', 'added.txt');
  assert.equal(staged.status, 0, staged.stderr);
  const evidence = JSON.parse(staged.stdout);
  assert.deepEqual(evidence.paths, ['added.txt', 'tracked.txt']);
  assert.deepEqual(evidence.changes, [
    { path: 'added.txt', added: 1, deleted: 0 },
    { path: 'tracked.txt', added: 1, deleted: 1 },
  ]);
  assert.match(evidence.fingerprint, /^sha256:[0-9a-f]{64}$/);

  const verified = run(cwd, 'verify', '--cwd', cwd, '--fingerprint', evidence.fingerprint);
  assert.equal(verified.status, 0, verified.stderr);
  assert.deepEqual(JSON.parse(verified.stdout), evidence);

  const unstaged = run(
    cwd,
    'unstage', '--cwd', cwd, '--path', 'tracked.txt', '--path', 'added.txt',
  );
  assert.equal(unstaged.status, 0, unstaged.stderr);
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), '');
  assert.match(fs.readFileSync(path.join(cwd, 'tracked.txt'), 'utf8'), /after/);
  assert.equal(fs.existsSync(path.join(cwd, 'added.txt')), true);
});

test('stage adds one Leaf to a shared nonempty Slice index', (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'staged first\n');
  git(cwd, 'add', '--', 'tracked.txt');
  fs.writeFileSync(path.join(cwd, 'added.txt'), 'new\n');

  const result = run(cwd, 'stage', '--cwd', cwd, '--path', 'added.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).paths, ['added.txt', 'tracked.txt']);
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), 'added.txt\ntracked.txt\n');
});

test('diff prints only an unchanged exact staged manifest', (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'review me\n');
  git(cwd, 'add', '--', 'tracked.txt');
  const result = run(cwd, 'diff', '--cwd', cwd, '--path', 'tracked.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /-before/);
  assert.match(result.stdout, /\+review me/);
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), 'tracked.txt\n');
});

test('snapshot fingerprints the shared Slice index without restaging it', (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'leaf one\n');
  fs.writeFileSync(path.join(cwd, 'added.txt'), 'leaf two\n');
  git(cwd, 'add', '--', 'tracked.txt');
  git(cwd, 'add', '--', 'added.txt');

  const result = run(
    cwd,
    'snapshot', '--cwd', cwd, '--path', 'tracked.txt', '--path', 'added.txt',
  );
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.deepEqual(evidence.paths, ['added.txt', 'tracked.txt']);
  assert.deepEqual(evidence.changes, [
    { path: 'added.txt', added: 1, deleted: 0 },
    { path: 'tracked.txt', added: 1, deleted: 1 },
  ]);
  assert.match(evidence.fingerprint, /^sha256:[0-9a-f]{64}$/);

  const mismatch = run(cwd, 'snapshot', '--cwd', cwd, '--path', 'tracked.txt');
  assert.equal(mismatch.status, 2);
  assert.match(mismatch.stderr, /staged paths differ/);
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), 'added.txt\ntracked.txt\n');
});

test('verify detects a staged change after review preparation', (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'reviewed\n');
  const staged = run(cwd, 'stage', '--cwd', cwd, '--path', 'tracked.txt');
  const evidence = JSON.parse(staged.stdout);

  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'changed again\n');
  git(cwd, 'add', '--', 'tracked.txt');
  const result = run(cwd, 'verify', '--cwd', cwd, '--fingerprint', evidence.fingerprint);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /staged fingerprint changed/);
});

test('snapshot-range and verify-range bind an integrated committed diff', (t) => {
  const cwd = fixture(t);
  const base = git(cwd, 'rev-parse', 'HEAD').trim();
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'integrated\n');
  fs.writeFileSync(path.join(cwd, 'added.txt'), 'added\n');
  git(cwd, 'add', '--', 'tracked.txt', 'added.txt');
  git(cwd, 'commit', '-m', 'integrate reviewed slices');

  const snapshotted = run(cwd, 'snapshot-range', '--cwd', cwd, '--base', base);
  assert.equal(snapshotted.status, 0, snapshotted.stderr);
  const evidence = JSON.parse(snapshotted.stdout);
  assert.equal(evidence.base, base);
  assert.equal(evidence.head, git(cwd, 'rev-parse', 'HEAD').trim());
  assert.deepEqual(evidence.paths, ['added.txt', 'tracked.txt']);
  assert.deepEqual(evidence.review_command, [
    'git', 'diff', `${base}..${evidence.head}`, '--unified=3', '--no-ext-diff', '--no-renames',
    '--', 'added.txt', 'tracked.txt',
  ]);

  const verified = run(
    cwd, 'verify-range', '--cwd', cwd, '--base', base,
    '--fingerprint', evidence.fingerprint,
  );
  assert.equal(verified.status, 0, verified.stderr);
  assert.deepEqual(JSON.parse(verified.stdout), evidence);

  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'changed after review\n');
  git(cwd, 'add', '--', 'tracked.txt');
  git(cwd, 'commit', '-m', 'change after review');
  const stale = run(
    cwd, 'verify-range', '--cwd', cwd, '--base', base,
    '--fingerprint', evidence.fingerprint,
  );
  assert.equal(stale.status, 2);
  assert.match(stale.stderr, /range fingerprint changed/);
});

test('diff-range prints only the exact integrated manifest', (t) => {
  const cwd = fixture(t);
  const base = git(cwd, 'rev-parse', 'HEAD').trim();
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'integrated\n');
  fs.writeFileSync(path.join(cwd, 'added.txt'), 'added\n');
  git(cwd, 'add', '--', 'tracked.txt', 'added.txt');
  git(cwd, 'commit', '-m', 'integrate reviewed roots');

  const reviewed = run(
    cwd,
    'diff-range', '--cwd', cwd, '--base', base,
    '--path', 'tracked.txt', '--path', 'added.txt',
  );
  assert.equal(reviewed.status, 0, reviewed.stderr);
  assert.match(reviewed.stdout, /-before/);
  assert.match(reviewed.stdout, /\+integrated/);
  assert.match(reviewed.stdout, /\+added/);

  const incomplete = run(
    cwd, 'diff-range', '--cwd', cwd, '--base', base, '--path', 'tracked.txt',
  );
  assert.equal(incomplete.status, 2);
  assert.match(incomplete.stderr, /range paths differ/);
});

test('stage accepts CRLF terminators but still rejects real trailing whitespace', (t) => {
  const cwd = fixture(t);
  git(cwd, 'config', 'core.autocrlf', 'false');

  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'after\r\nsecond\r\n');
  const accepted = run(cwd, 'stage', '--cwd', cwd, '--path', 'tracked.txt');
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.deepEqual(JSON.parse(accepted.stdout).paths, ['tracked.txt']);
  git(cwd, 'restore', '--staged', '--', 'tracked.txt');

  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'after \r\nsecond\r\n');
  const rejected = run(cwd, 'stage', '--cwd', cwd, '--path', 'tracked.txt');
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /trailing whitespace/);
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), '');
});
