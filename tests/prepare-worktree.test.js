'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { controlManifest } = require('../skills/start-implementation/scripts/control-state.js');

const script = path.resolve(__dirname, '..', 'skills', 'start-implementation', 'scripts', 'prepare-worktree.js');

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function writeSpec(root, id = 'SPEC-0001') {
  const spec = path.join(root, '.proofline', 'specs', id);
  fs.mkdirSync(path.join(spec, 'gates'), { recursive: true });
  fs.writeFileSync(path.join(spec, 'SPEC.md'), [
    '---',
    JSON.stringify({
      schema_version: 2, id, title: 'Fixture', kind: 'feature', status: 'ready', revision: 1,
      supersedes: [], superseded_by: null, related_issues: [],
    }, null, 2),
    '---', '', '# Fixture', '',
  ].join('\n'));
  fs.writeFileSync(path.join(spec, 'gates', `${id}.md`), [
    `# Gates: ${id}`,
    `Scope: ${id} revision 1`,
    '',
    '- [ ] G1: product exists',
    `  CHECK: ${JSON.stringify([process.execPath, '-e', 'process.exit(0)'])}`,
    '  EVIDENCE: pending',
    '',
  ].join('\n'));
  return spec;
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-prepare-worktree-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10 }));
  const checkout = path.join(root, 'checkout');
  const worktree = path.join(root, 'worktree');
  const fakeHome = path.join(root, 'home');
  fs.mkdirSync(checkout);
  fs.mkdirSync(fakeHome);
  git(checkout, 'init');
  git(checkout, 'config', 'user.email', 'proofline@example.invalid');
  git(checkout, 'config', 'user.name', 'Proofline Test');
  fs.writeFileSync(path.join(checkout, 'product.txt'), 'base\n');
  git(checkout, 'add', '--', 'product.txt');
  git(checkout, 'commit', '-m', 'base');
  const spec = writeSpec(checkout);
  writeSpec(checkout, 'SPEC-9999');
  fs.appendFileSync(path.join(checkout, '.git', 'info', 'exclude'), '\n.proofline/\n');
  const base = git(checkout, 'rev-parse', 'HEAD');
  git(checkout, 'worktree', 'add', '--detach', worktree, base);
  return { root, checkout, worktree, fakeHome, spec, base };
}

test('preflight copies only the active ignored Spec and does not mutate global Git config', (t) => {
  const state = fixture(t);
  const fingerprint = controlManifest(state.spec).full_fingerprint;
  const env = { ...process.env, HOME: state.fakeHome, USERPROFILE: state.fakeHome };
  const result = spawnSync(process.execPath, [
    script,
    '--cwd', state.worktree,
    '--source', state.checkout,
    '--spec', '.proofline/specs/SPEC-0001',
    '--base', state.base,
    '--control-fingerprint', fingerprint,
  ], { cwd: state.worktree, env, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).action, 'ready');
  assert.equal(fs.existsSync(path.join(state.worktree, '.proofline', 'specs', 'SPEC-0001', 'SPEC.md')), true);
  assert.equal(fs.existsSync(path.join(state.worktree, '.proofline', 'specs', 'SPEC-9999')), false);
  assert.equal(fs.existsSync(path.join(state.fakeHome, '.gitconfig')), false);
});

test('preflight reports source drift once without creating the destination Spec', (t) => {
  const state = fixture(t);
  const fingerprint = controlManifest(state.spec).full_fingerprint;
  fs.appendFileSync(path.join(state.spec, 'SPEC.md'), 'changed\n');
  const result = spawnSync(process.execPath, [
    script,
    '--cwd', state.worktree,
    '--source', state.checkout,
    '--spec', '.proofline/specs/SPEC-0001',
    '--base', state.base,
    '--control-fingerprint', fingerprint,
  ], { cwd: state.worktree, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 2);
  const output = JSON.parse(result.stdout);
  assert.equal(output.action, 'environment_blocked');
  assert.match(output.error, /source Spec changed/);
  assert.equal(fs.existsSync(path.join(state.worktree, '.proofline')), false);
});

test('preflight classifies an invalid execution tree before creating control state', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.spec, 'SPEC.md'), '# malformed\n');
  const result = spawnSync(process.execPath, [
    script,
    '--cwd', state.worktree,
    '--source', state.checkout,
    '--spec', '.proofline/specs/SPEC-0001',
    '--base', state.base,
    '--control-fingerprint', `sha256:${'0'.repeat(64)}`,
  ], { cwd: state.worktree, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 2, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.action, 'environment_blocked');
  assert.match(output.error, /JSON frontmatter is missing/);
  assert.equal(fs.existsSync(path.join(state.worktree, '.proofline')), false);
});
