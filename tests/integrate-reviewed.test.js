'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const script = path.resolve(
  __dirname, '..', 'skills', 'start-implementation', 'scripts', 'integrate-reviewed.js',
);

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test('reviewed Root commits integrate in order without global safe.directory changes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-integrate-reviewed-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10 }));
  const repository = path.join(root, 'repository');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  const integration = path.join(root, 'integration');
  const fakeHome = path.join(root, 'home');
  fs.mkdirSync(repository);
  fs.mkdirSync(fakeHome);
  git(repository, 'init');
  git(repository, 'config', 'user.email', 'proofline@example.invalid');
  git(repository, 'config', 'user.name', 'Proofline Test');
  fs.writeFileSync(path.join(repository, 'base.txt'), 'base\n');
  git(repository, 'add', '--', 'base.txt');
  git(repository, 'commit', '-m', 'base');
  const base = git(repository, 'rev-parse', 'HEAD');
  for (const destination of [first, second, integration]) {
    git(repository, 'worktree', 'add', '--detach', destination, base);
  }

  fs.writeFileSync(path.join(first, 'first.txt'), 'first\n');
  git(first, 'add', '--', 'first.txt');
  git(first, 'commit', '-m', 'first reviewed Root');
  const firstCommit = git(first, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(second, 'second.txt'), 'second\n');
  git(second, 'add', '--', 'second.txt');
  git(second, 'commit', '-m', 'second reviewed Root');
  const secondCommit = git(second, 'rev-parse', 'HEAD');

  const result = spawnSync(process.execPath, [
    script,
    '--cwd', integration,
    '--head', base,
    '--commit', firstCommit,
    '--commit', secondCommit,
  ], {
    cwd: integration,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.action, 'integrated');
  assert.deepEqual(output.commits, [firstCommit, secondCommit]);
  assert.equal(
    fs.readFileSync(path.join(integration, 'first.txt'), 'utf8').replaceAll('\r\n', '\n'),
    'first\n',
  );
  assert.equal(
    fs.readFileSync(path.join(integration, 'second.txt'), 'utf8').replaceAll('\r\n', '\n'),
    'second\n',
  );
  assert.equal(git(integration, 'status', '--porcelain'), '');
  assert.equal(fs.existsSync(path.join(fakeHome, '.gitconfig')), false);
});
