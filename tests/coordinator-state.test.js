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

function normalizedText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
}

function document(filePath, metadata, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${JSON.stringify(metadata, null, 2)}\n---\n\n${body}\n`);
}

function gate(root, id, met = true, check = 'fixture-command', requires = []) {
  fs.mkdirSync(path.join(root, 'gates'), { recursive: true });
  const lines = [
    `# Gates: ${id}`,
    'Scope: SPEC-0001 revision 1',
    '',
    `- [${met ? 'x' : ' '}] G1: fixture result`,
    `  CHECK: ${check}`,
  ];
  if (requires.length > 0) lines.push(`  REQUIRES: ${JSON.stringify(requires)}`);
  lines.push(`  EVIDENCE: ${met ? 'verified by fixture' : 'pending'}`, '');
  fs.writeFileSync(path.join(root, 'gates', `${id}.md`), lines.join('\n'));
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
  gate(spec, 'SPEC-0001', false, JSON.stringify([process.execPath, '-e', 'process.exit(0)']));

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

function finalizationFixture(t, rootCount) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-coordinator-finalize-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true, maxRetries: 10 }));
  git(cwd, 'init');
  git(cwd, 'config', 'user.email', 'proofline@example.invalid');
  git(cwd, 'config', 'user.name', 'Proofline Test');
  git(cwd, 'config', 'core.autocrlf', 'false');
  const spec = path.join(cwd, '.proofline', 'specs', 'SPEC-0001');
  const ids = Array.from({ length: rootCount }, (_, index) => `SLICE-0${index + 1}`);
  document(path.join(spec, 'SPEC.md'), {
    schema_version: 2,
    id: 'SPEC-0001',
    title: 'Finalization fixture',
    kind: 'feature',
    status: 'ready',
    revision: 1,
    supersedes: [],
    superseded_by: null,
    related_issues: [],
  }, `# Finalization fixture\n\n## Slices\n\n${ids.map((id) => `- [${id}](slices/${id}.md)`).join('\n')}`);
  const productPaths = ids.map((id, index) => `src/root-${index + 1}.txt`);
  gate(
    spec,
    'SPEC-0001',
    false,
    JSON.stringify([process.execPath, '-e', 'process.exit(0)']),
    productPaths,
  );

  for (const [index, id] of ids.entries()) {
    const relative = productPaths[index];
    node(spec, id, 'SPEC-0001', [relative]);
    fs.mkdirSync(path.dirname(path.join(cwd, relative)), { recursive: true });
    fs.writeFileSync(path.join(cwd, relative), 'before\n');
  }
  git(cwd, 'add', '--', '.');
  git(cwd, 'commit', '-m', 'base');
  const base = git(cwd, 'rev-parse', 'HEAD').toString('utf8').trim();

  for (const [index, id] of ids.entries()) {
    const slicePath = path.join(spec, 'slices', `${id}.md`);
    fs.writeFileSync(
      slicePath,
      fs.readFileSync(slicePath, 'utf8').replace('"status": "pending"', '"status": "completed"'),
    );
    fs.writeFileSync(path.join(cwd, productPaths[index]), `after ${id}\n`);
  }
  git(cwd, 'add', '--', ...productPaths);
  git(cwd, 'commit', '-m', 'reviewed roots');
  const commit = git(cwd, 'rev-parse', 'HEAD').toString('utf8').trim();
  const diff = git(
    cwd, 'diff', `${base}..${commit}`, '--binary', '--no-ext-diff', '--no-renames', '--',
  );
  const fingerprint = `sha256:${crypto.createHash('sha256').update(diff).digest('hex')}`;
  return { cwd, spec, base, commit, fingerprint, productPaths };
}

function reviewedApplicationFixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-coordinator-apply-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10 }));
  const cwd = path.join(root, 'destination');
  const source = path.join(root, 'source');
  fs.mkdirSync(cwd);
  git(cwd, 'init');
  git(cwd, 'config', 'user.email', 'proofline@example.invalid');
  git(cwd, 'config', 'user.name', 'Proofline Test');
  git(cwd, 'config', 'core.autocrlf', 'false');
  const spec = path.join(cwd, '.proofline', 'specs', 'SPEC-0001');
  document(path.join(spec, 'SPEC.md'), {
    schema_version: 2,
    id: 'SPEC-0001',
    title: 'Apply reviewed',
    kind: 'feature',
    status: 'ready',
    revision: 1,
    supersedes: [],
    superseded_by: null,
    related_issues: [],
  }, '# Apply reviewed');
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
  fs.writeFileSync(path.join(cwd, 'removed.txt'), 'before\n');
  fs.writeFileSync(path.join(cwd, 'unrelated.txt'), 'before\n');
  git(cwd, 'add', '--', '.');
  git(cwd, 'commit', '-m', 'base');
  const base = git(cwd, 'rev-parse', 'HEAD').toString('utf8').trim();
  git(cwd, 'worktree', 'add', '--detach', source, base);
  const sourceSpec = path.join(source, '.proofline', 'specs', 'SPEC-0001');
  fs.writeFileSync(
    path.join(source, 'product.txt'),
    options.crlf ? 'after\r\nsecond\r\n' : 'after\n',
  );
  fs.writeFileSync(path.join(source, 'created.txt'), 'created\n');
  fs.unlinkSync(path.join(source, 'removed.txt'));
  git(source, 'add', '--', 'product.txt', 'created.txt', 'removed.txt');
  const closed = runAction(
    { cwd: source, spec: sourceSpec }, 'close', 'SPEC-0001', '--mode', 'root-only',
  );
  assert.equal(closed.status, 0, closed.stderr);
  const fingerprint = JSON.parse(closed.stdout).review_snapshot.fingerprint;
  const passed = runAction(
    { cwd: source, spec: sourceSpec },
    'review-pass',
    'SPEC-0001',
    '--mode', 'root-only',
    '--fingerprint', fingerprint,
    '--message', 'feat: reviewed product',
  );
  assert.equal(passed.status, 0, passed.stderr);
  const commit = JSON.parse(passed.stdout).commit;
  return { cwd, source, spec, sourceSpec, base, commit, fingerprint };
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
  assert.equal(output.gates[0].evidence, undefined);
  assert.equal(output.review_snapshot.review_command, undefined);
  assert.equal(output.state, undefined);
});

test('close accepts CRLF line terminators in the staged product snapshot', (t) => {
  const state = rootOnlyFixture(t);
  git(state.cwd, 'config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(state.cwd, 'product.txt'), 'after\r\nsecond\r\n');
  git(state.cwd, 'add', '--', 'product.txt');

  const result = runAction(state, 'close', 'SPEC-0001', '--mode', 'root-only');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).action, 'review');
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

test('review-pass completes, commits, and returns transport without a fingerprint', (t) => {
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
  assert.equal(output.fingerprint, undefined);
  assert.deepEqual(output.paths, ['product.txt']);
  assert.match(output.commit, /^[0-9a-f]{40}$/);
  assert.equal(output.state, undefined);
  assert.deepEqual(output.gates, { checked: 1, unmet: [] });
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'completed');
});

test('single Root Slice finalization reuses its exact review and completes the root Gate', (t) => {
  const state = finalizationFixture(t, 1);
  const result = runAction(
    state,
    'finalize',
    'SPEC-0001',
    '--mode', 'single-root',
    '--base', state.base,
    '--fingerprint', state.fingerprint,
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.action, 'callback');
  assert.equal(output.status, 'completed');
  assert.equal(output.commit, state.commit);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'completed');
  assert.match(fs.readFileSync(path.join(state.spec, 'gates', 'SPEC-0001.md'), 'utf8'), /- \[x\] G1/);
});

test('multiple Root Slices receive one range review before the Spec completes', (t) => {
  const state = finalizationFixture(t, 2);
  const prepared = runAction(
    state, 'finalize', 'SPEC-0001', '--mode', 'multi-root', '--base', state.base,
  );
  assert.equal(prepared.status, 0, prepared.stderr);
  const review = JSON.parse(prepared.stdout);
  assert.equal(review.action, 'review');
  assert.equal(review.commit, state.commit);
  assert.deepEqual(review.review_snapshot.paths, state.productPaths);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'ready');

  const passed = runAction(
    state,
    'finalize-review-pass',
    'SPEC-0001',
    '--base', state.base,
    '--commit', review.commit,
    '--fingerprint', review.review_snapshot.fingerprint,
  );
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(JSON.parse(passed.stdout).status, 'completed');
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'completed');
});

test('integrated review pass rejects a changed commit without completing the Spec', (t) => {
  const state = finalizationFixture(t, 2);
  const prepared = runAction(
    state, 'finalize', 'SPEC-0001', '--mode', 'multi-root', '--base', state.base,
  );
  assert.equal(prepared.status, 0, prepared.stderr);
  const review = JSON.parse(prepared.stdout);
  git(state.cwd, 'commit', '--allow-empty', '-m', 'unexpected commit');

  const passed = runAction(
    state,
    'finalize-review-pass',
    'SPEC-0001',
    '--base', state.base,
    '--commit', review.commit,
    '--fingerprint', review.review_snapshot.fingerprint,
  );
  assert.equal(passed.status, 2);
  assert.match(passed.stderr, /Worktree HEAD changed/);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'ready');
});

test('capture and apply-reviewed transport one reviewed range as uncommitted changes', (t) => {
  const state = reviewedApplicationFixture(t);
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);
  assert.equal(destination.action, 'dispatch');
  assert.deepEqual(destination.overlap, []);

  const applied = runAction(
    { ...state, spec: state.sourceSpec },
    'apply-reviewed',
    'SPEC-0001',
    '--source', state.source,
    '--base', state.base,
    '--commit', state.commit,
    '--destination-fingerprint', destination.destination_fingerprint,
    '--control-fingerprint', destination.control_fingerprint,
  );
  assert.equal(applied.status, 0, applied.stderr);
  const output = JSON.parse(applied.stdout);
  assert.equal(output.action, 'complete');
  assert.equal(output.head, state.base);
  assert.equal(output.commit, state.commit);
  assert.equal(output.fingerprint, state.fingerprint);
  assert.deepEqual(output.paths, ['created.txt', 'product.txt', 'removed.txt']);
  assert.equal(normalizedText(path.join(state.cwd, 'product.txt')), 'after\n');
  assert.equal(normalizedText(path.join(state.cwd, 'created.txt')), 'created\n');
  assert.equal(fs.existsSync(path.join(state.cwd, 'removed.txt')), false);
  assert.equal(git(state.cwd, 'rev-parse', 'HEAD').toString('utf8').trim(), state.base);
  assert.equal(git(state.cwd, 'diff', '--cached', '--name-only').length, 0);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'completed');
  assert.match(fs.readFileSync(path.join(state.spec, 'gates', 'SPEC-0001.md'), 'utf8'), /- \[x\] G1/);
});

test('apply-reviewed accepts a reviewed CRLF product range without disabling whitespace checks', (t) => {
  const state = reviewedApplicationFixture(t, { crlf: true });
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);

  const applied = runAction(
    { ...state, spec: state.sourceSpec },
    'apply-reviewed',
    'SPEC-0001',
    '--source', state.source,
    '--base', state.base,
    '--commit', state.commit,
    '--destination-fingerprint', destination.destination_fingerprint,
    '--control-fingerprint', destination.control_fingerprint,
  );
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(normalizedText(path.join(state.cwd, 'product.txt')), 'after\nsecond\n');
});

test('apply-reviewed preserves an accepted non-overlapping destination change', (t) => {
  const state = reviewedApplicationFixture(t);
  fs.writeFileSync(path.join(state.cwd, 'unrelated.txt'), 'local\n');
  fs.writeFileSync(path.join(state.cwd, 'local.txt'), 'untracked\n');
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 1, captured.stderr);
  const destination = JSON.parse(captured.stdout);
  assert.equal(destination.action, 'need_confirm');
  assert.deepEqual(destination.overlap, ['local.txt', 'unrelated.txt']);

  const applied = runAction(
    { ...state, spec: state.sourceSpec },
    'apply-reviewed',
    'SPEC-0001',
    '--source', state.source,
    '--base', state.base,
    '--commit', state.commit,
    '--destination-fingerprint', destination.destination_fingerprint,
    '--control-fingerprint', destination.control_fingerprint,
  );
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(normalizedText(path.join(state.cwd, 'product.txt')), 'after\n');
  assert.equal(normalizedText(path.join(state.cwd, 'unrelated.txt')), 'local\n');
  assert.equal(normalizedText(path.join(state.cwd, 'local.txt')), 'untracked\n');
});

test('apply-reviewed stops without mutation on a changed or overlapping destination', (t) => {
  const state = reviewedApplicationFixture(t);
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);
  fs.writeFileSync(path.join(state.cwd, 'product.txt'), 'local\n');

  const changed = runAction(
    { ...state, spec: state.sourceSpec },
    'apply-reviewed',
    'SPEC-0001',
    '--source', state.source,
    '--base', state.base,
    '--commit', state.commit,
    '--destination-fingerprint', destination.destination_fingerprint,
    '--control-fingerprint', destination.control_fingerprint,
  );
  assert.equal(changed.status, 2);
  assert.match(changed.stderr, /destination state changed/);
  assert.equal(fs.readFileSync(path.join(state.cwd, 'product.txt'), 'utf8'), 'local\n');
});

test('apply-reviewed rejects original Spec drift without applying product changes', (t) => {
  const state = reviewedApplicationFixture(t);
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);
  fs.appendFileSync(path.join(state.spec, 'SPEC.md'), '\nUser changed the requirement.\n');

  const applied = runAction(
    { ...state, spec: state.sourceSpec },
    'apply-reviewed',
    'SPEC-0001',
    '--source', state.source,
    '--base', state.base,
    '--commit', state.commit,
    '--destination-fingerprint', destination.destination_fingerprint,
    '--control-fingerprint', destination.control_fingerprint,
  );
  assert.equal(applied.status, 2);
  assert.match(applied.stderr, /original Spec changed/);
  assert.equal(fs.readFileSync(path.join(state.cwd, 'product.txt'), 'utf8'), 'before\n');
  assert.match(fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8'), /User changed the requirement/);
});

test('apply-reviewed rejects Worktree definition drift without changing the destination', (t) => {
  const state = reviewedApplicationFixture(t);
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);
  const sourceGate = path.join(state.sourceSpec, 'gates', 'SPEC-0001.md');
  fs.writeFileSync(
    sourceGate,
    fs.readFileSync(sourceGate, 'utf8').replace('G1: product exists', 'G1: changed definition'),
  );

  const applied = runAction(
    { ...state, spec: state.sourceSpec },
    'apply-reviewed',
    'SPEC-0001',
    '--source', state.source,
    '--base', state.base,
    '--commit', state.commit,
    '--destination-fingerprint', destination.destination_fingerprint,
    '--control-fingerprint', destination.control_fingerprint,
  );
  assert.equal(applied.status, 2);
  assert.match(applied.stderr, /immutable Spec, Slice, or Gate definitions changed/);
  assert.equal(fs.readFileSync(path.join(state.cwd, 'product.txt'), 'utf8'), 'before\n');
  assert.doesNotMatch(
    fs.readFileSync(path.join(state.spec, 'gates', 'SPEC-0001.md'), 'utf8'),
    /changed definition/,
  );
});

test('apply-reviewed rejects a reviewed range outside the frozen root scope', (t) => {
  const state = fixture(t);
  const source = path.join(path.dirname(state.cwd), `${path.basename(state.cwd)}-source`);
  t.after(() => fs.rmSync(source, { recursive: true, force: true, maxRetries: 10 }));
  const base = git(state.cwd, 'rev-parse', 'HEAD').toString('utf8').trim();
  git(state.cwd, 'worktree', 'add', '--detach', source, base);
  fs.writeFileSync(path.join(source, 'outside.txt'), 'outside\n');
  git(source, 'add', '--', 'outside.txt');
  git(source, 'commit', '-m', 'reviewed outside');
  const commit = git(source, 'rev-parse', 'HEAD').toString('utf8').trim();
  const diff = git(
    source,
    'diff',
    `${base}..${commit}`,
    '--binary',
    '--no-ext-diff',
    '--no-renames',
    '--',
    'outside.txt',
  );
  const fingerprint = `sha256:${crypto.createHash('sha256').update(diff).digest('hex')}`;
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);

  const applied = runAction(
    { cwd: state.cwd, spec: path.join(source, '.proofline', 'specs', 'SPEC-0001') },
    'apply-reviewed',
    'SPEC-0001',
    '--source', source,
    '--base', base,
    '--commit', commit,
    '--fingerprint', fingerprint,
    '--destination-fingerprint', destination.destination_fingerprint,
    '--control-fingerprint', destination.control_fingerprint,
  );
  assert.equal(applied.status, 2);
  assert.match(applied.stderr, /reviewed paths outside root scope: outside\.txt/);
  assert.equal(fs.existsSync(path.join(state.cwd, 'outside.txt')), false);
});
