'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const script = path.resolve(
  __dirname, '..', 'skills', 'start-implementation', 'scripts', 'coordinator-state.js',
);

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: null, windowsHide: true });
  assert.equal(result.status, 0, result.stderr?.toString('utf8'));
  return result.stdout;
}

function document(filePath, metadata, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${JSON.stringify(metadata, null, 2)}\n---\n\n${body}\n`);
}

function gate(root, id, met = true) {
  fs.mkdirSync(path.join(root, 'gates'), { recursive: true });
  fs.writeFileSync(path.join(root, 'gates', `${id}.md`), [
    `# Gates: ${id}`,
    'Scope: SPEC-0001 revision 1',
    '',
    `- [${met ? 'x' : ' '}] G1: fixture result`,
    '  CHECK: fixture-command',
    `  EVIDENCE: ${met ? 'verified by fixture' : 'pending'}`,
    '',
  ].join('\n'));
}

function node(root, id, parentId, writeScope) {
  document(path.join(root, 'slices', `${id}.md`), {
    schema_version: 3,
    id,
    spec_id: 'SPEC-0001',
    spec_revision: 1,
    parent_id: parentId,
    title: id,
    status: 'pending',
    blocked_by: [],
    run_after: [],
    write_scope: writeScope,
  }, [
    '## Outcome', '', 'Fixture outcome.', '',
    '## Spec sections', '', '[Requirement](../SPEC.md#requirement)', '',
    '## Contract', '', 'Fixture contract.', '',
    '## Context', '', 'Fixture context.',
  ].join('\n'));
  gate(root, id);
}

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-coordinator-state-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true, maxRetries: 10 }));
  git(cwd, 'init');
  git(cwd, 'config', 'user.email', 'proofline@example.invalid');
  git(cwd, 'config', 'user.name', 'Proofline Test');

  const spec = path.join(cwd, '.proofline', 'specs', 'SPEC-0001');
  document(path.join(spec, 'SPEC.md'), {
    schema_version: 2,
    id: 'SPEC-0001',
    title: 'Fixture',
    kind: 'feature',
    status: 'ready',
    revision: 1,
    supersedes: [],
    superseded_by: null,
    related_issues: [],
  }, '# Fixture\n\n## Slices\n\n- [SLICE-01](slices/SLICE-01.md)');
  node(spec, 'SLICE-01', 'SPEC-0001', []);
  node(spec, 'SLICE-01.01', 'SLICE-01', ['src/backend']);
  node(spec, 'SLICE-01.02', 'SLICE-01', ['src/frontend']);
  gate(spec, 'SPEC-0001', false);

  fs.mkdirSync(path.join(cwd, 'src', 'backend'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'src', 'frontend'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src', 'backend', 'item.txt'), 'before\n');
  fs.writeFileSync(path.join(cwd, 'src', 'frontend', 'item.txt'), 'before\n');
  git(cwd, 'add', '--', '.');
  git(cwd, 'commit', '-m', 'base');
  return { cwd, spec };
}

function run({ cwd, spec }, nodeId, ...extra) {
  return spawnSync(process.execPath, [
    script, '--cwd', cwd, '--spec', spec, '--node', nodeId, ...extra,
  ], { cwd, encoding: 'utf8', windowsHide: true });
}

function runAction({ cwd, spec }, action, nodeId, ...extra) {
  return spawnSync(process.execPath, [
    script, action, '--cwd', cwd, '--spec', spec, '--node', nodeId, ...extra,
  ], { cwd, encoding: 'utf8', windowsHide: true });
}

function rootOnlyFixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-coordinator-root-only-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true, maxRetries: 10 }));
  git(cwd, 'init');
  git(cwd, 'config', 'user.email', 'proofline@example.invalid');
  git(cwd, 'config', 'user.name', 'Proofline Test');
  const spec = path.join(cwd, '.proofline', 'specs', 'SPEC-0001');
  document(path.join(spec, 'SPEC.md'), {
    schema_version: 2,
    id: 'SPEC-0001',
    title: 'Root only',
    kind: 'feature',
    status: 'ready',
    revision: 1,
    supersedes: [],
    superseded_by: null,
    related_issues: [],
  }, '# Root only');
  fs.mkdirSync(path.join(spec, 'gates'), { recursive: true });
  fs.writeFileSync(path.join(spec, 'gates', 'SPEC-0001.md'), [
    '# Gates: SPEC-0001',
    'Scope: SPEC-0001 revision 1',
    '',
    '- [ ] G1: product exists',
    `  CHECK: ${JSON.stringify([process.execPath, '-e', 'process.exit(0)'])}`,
    '  REQUIRES: ["product.txt"]',
    '  EVIDENCE: pending',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(cwd, 'product.txt'), 'before\n');
  git(cwd, 'add', '--', '.');
  git(cwd, 'commit', '-m', 'base');
  fs.writeFileSync(path.join(cwd, 'product.txt'), 'after\n');
  git(cwd, 'add', '--', 'product.txt');
  return { cwd, spec };
}

test('one callback inspection accepts a leaf inside a combined staged Slice', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.cwd, 'src', 'backend', 'item.txt'), 'backend\n');
  fs.writeFileSync(path.join(state.cwd, 'src', 'frontend', 'item.txt'), 'frontend\n');
  git(state.cwd, 'add', '--', 'src/backend/item.txt', 'src/frontend/item.txt');

  const result = run(state, 'SLICE-01.02');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.deepEqual(output.paths.owned, ['src/frontend/item.txt']);
  assert.deepEqual(output.paths.root, ['src/backend/item.txt', 'src/frontend/item.txt']);
  assert.deepEqual(output.paths.outside_root, []);
  assert.deepEqual(output.gates.unmet, []);
});

test('one callback inspection rejects an owned change left unstaged', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.cwd, 'src', 'frontend', 'item.txt'), 'staged\n');
  git(state.cwd, 'add', '--', 'src/frontend/item.txt');
  fs.writeFileSync(path.join(state.cwd, 'src', 'frontend', 'item.txt'), 'unstaged\n');

  const result = run(state, 'SLICE-01.02');
  assert.equal(result.status, 1, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.paths.owned_unstaged, ['src/frontend/item.txt']);
  assert.ok(output.errors.includes('owned-change-not-staged'));
});

test('review fingerprint remains verifiable after the reviewed commit', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.cwd, 'src', 'backend', 'item.txt'), 'backend\n');
  fs.writeFileSync(path.join(state.cwd, 'src', 'frontend', 'item.txt'), 'frontend\n');
  git(state.cwd, 'add', '--', 'src/backend/item.txt', 'src/frontend/item.txt');
  const diff = git(
    state.cwd, 'diff', '--cached', '--binary', '--no-ext-diff', '--no-renames', '--',
  );
  const fingerprint = `sha256:${crypto.createHash('sha256').update(diff).digest('hex')}`;
  git(state.cwd, 'commit', '-m', 'reviewed');
  const commit = git(state.cwd, 'rev-parse', 'HEAD').toString('utf8').trim();

  const result = run(
    state, 'SLICE-01', '--commit', commit, '--fingerprint', fingerprint,
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.commit, commit);
  assert.equal(output.fingerprint, fingerprint);
});

test('close runs the one root Gate and returns its review snapshot', (t) => {
  const state = rootOnlyFixture(t);
  const result = runAction(state, 'close', 'SPEC-0001', '--mode', 'root-only');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.action, 'review');
  assert.deepEqual(output.review_snapshot.paths, ['product.txt']);
  assert.match(output.review_snapshot.fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal(output.gates.length, 1);
  assert.equal(output.gates[0].passed, true);
});

test('relative Spec paths resolve from --cwd instead of the process directory', (t) => {
  const state = rootOnlyFixture(t);
  const relativeSpec = path.relative(state.cwd, state.spec);
  const result = spawnSync(process.execPath, [
    script,
    'close',
    '--cwd', state.cwd,
    '--spec', relativeSpec,
    '--node', 'SPEC-0001',
    '--mode', 'root-only',
  ], { cwd: repoRoot, encoding: 'utf8', windowsHide: true });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).action, 'review');
});

test('review-pass completes, commits, and verifies a root-only transport once', (t) => {
  const state = rootOnlyFixture(t);
  const closed = runAction(state, 'close', 'SPEC-0001', '--mode', 'root-only');
  assert.equal(closed.status, 0, closed.stderr);
  const fingerprint = JSON.parse(closed.stdout).review_snapshot.fingerprint;
  const passed = runAction(
    state,
    'review-pass',
    'SPEC-0001',
    '--mode', 'root-only',
    '--fingerprint', fingerprint,
    '--message', 'feat: root only',
  );
  assert.equal(passed.status, 0, passed.stderr);
  const output = JSON.parse(passed.stdout);
  assert.equal(output.action, 'callback');
  assert.equal(output.fingerprint, fingerprint);
  assert.deepEqual(output.paths, ['product.txt']);
  assert.match(output.commit, /^[0-9a-f]{40}$/);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'completed');
});
