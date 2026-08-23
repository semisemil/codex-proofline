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

test('stage rejects a nonempty index without changing it', (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'staged first\n');
  git(cwd, 'add', '--', 'tracked.txt');
  fs.writeFileSync(path.join(cwd, 'added.txt'), 'new\n');

  const result = run(cwd, 'stage', '--cwd', cwd, '--path', 'added.txt');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /index is not empty: tracked\.txt/);
  assert.equal(git(cwd, 'diff', '--cached', '--name-only'), 'tracked.txt\n');
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
