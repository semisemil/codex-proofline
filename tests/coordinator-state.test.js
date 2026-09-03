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
const { closeBatch, completeBoundariesAtomically } = require(script);

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

function runBatch({ cwd, spec }, ...nodeIds) {
  return spawnSync(process.execPath, [
    script, 'close-batch', '--cwd', cwd, '--spec', spec, '--nodes', nodeIds.join(','),
  ], { cwd, encoding: 'utf8', windowsHide: true });
}

function statusOf(filePath) {
  return JSON.parse(
    fs.readFileSync(filePath, 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status;
}

function batchFixture(t, secondFails = false) {
  const state = fixture(t);
  for (const [id, scope] of [
    ['SLICE-01.01', 'src/backend'],
    ['SLICE-01.02', 'src/frontend'],
  ]) {
    const slicePath = path.join(state.spec, 'slices', `${id}.md`);
    fs.writeFileSync(
      slicePath,
      fs.readFileSync(slicePath, 'utf8').replace(`"${scope}"`, `"${scope}/"`),
    );
  }
  const success = JSON.stringify([process.execPath, '-e', 'process.exit(0)']);
  const conditional = [
    "const fs=require('node:fs');",
    "if(fs.readFileSync('src/frontend/item.txt','utf8').includes('fixed')) process.exit(0);",
    "process.stdout.write('DIAGNOSTIC-HEAD\\n'+'x'.repeat(5000)+'\\nDIAGNOSTIC-TAIL\\n');",
    'process.exit(4);',
  ].join('');
  gate(state.spec, 'SLICE-01.01', false, success, ['src/backend/item.txt']);
  gate(
    state.spec,
    'SLICE-01.02',
    false,
    JSON.stringify([process.execPath, '-e', conditional]),
    ['src/frontend/item.txt'],
  );
  fs.writeFileSync(path.join(state.cwd, 'src', 'backend', 'item.txt'), 'backend fixed\n');
  fs.writeFileSync(
    path.join(state.cwd, 'src', 'frontend', 'item.txt'),
    secondFails ? 'frontend pending\n' : 'frontend fixed\n',
  );
  git(state.cwd, 'add', '--', 'src/backend/item.txt', 'src/frontend/item.txt');
  return state;
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

test('close-batch completes one ready sibling Leaf cohort atomically', (t) => {
  const state = batchFixture(t);
  const ids = ['SLICE-01.01', 'SLICE-01.02'];
  const result = runBatch(state, ...ids);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.action, 'continue');
  assert.deepEqual(output.completed, ids);
  assert.deepEqual([...new Set(output.gates.map((gateResult) => gateResult.node))], ids);
  for (const id of ids) {
    assert.equal(statusOf(path.join(state.spec, 'slices', `${id}.md`)), 'completed');
  }
});

test('close-batch leaves every status pending on Gate failure and rechecks after Repair', (t) => {
  const state = batchFixture(t, true);
  const ids = ['SLICE-01.01', 'SLICE-01.02'];
  const first = runBatch(state, ...ids);
  assert.equal(first.status, 1, first.stderr);
  const failed = JSON.parse(first.stdout);
  assert.equal(failed.action, 'repair');
  assert.deepEqual(failed.completed, []);
  assert.deepEqual(failed.failures, [{ node: 'SLICE-01.02', reasons: ['gate-failed'] }]);
  const diagnostic = failed.gates.find((item) => item.node === 'SLICE-01.02').diagnostic;
  assert.ok(diagnostic.length <= 4096, diagnostic.length);
  assert.match(diagnostic, /^DIAGNOSTIC-HEAD/);
  assert.match(diagnostic, /output omitted/);
  assert.match(diagnostic, /DIAGNOSTIC-TAIL$/);
  for (const id of ids) {
    assert.equal(statusOf(path.join(state.spec, 'slices', `${id}.md`)), 'pending');
  }
  const firstEvidence = normalizedText(path.join(state.spec, 'gates', 'SLICE-01.01.md'));

  fs.writeFileSync(path.join(state.cwd, 'src', 'frontend', 'item.txt'), 'frontend fixed\n');
  git(state.cwd, 'add', '--', 'src/frontend/item.txt');
  const repaired = runBatch(state, ...ids);
  assert.equal(repaired.status, 0, repaired.stderr);
  for (const id of ids) {
    assert.equal(statusOf(path.join(state.spec, 'slices', `${id}.md`)), 'completed');
  }
  assert.notEqual(
    normalizedText(path.join(state.spec, 'gates', 'SLICE-01.01.md')),
    firstEvidence,
  );
});

test('close-batch rejects duplicate, non-Leaf, non-sibling, and non-ready input', (t) => {
  const duplicate = batchFixture(t);
  let result = runBatch(duplicate, 'SLICE-01.01', 'SLICE-01.01');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be distinct/);

  const nonLeaf = batchFixture(t);
  result = runBatch(nonLeaf, 'SLICE-01', 'SLICE-01.01');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires Leaf Nodes/);

  const nonSibling = batchFixture(t);
  fs.writeFileSync(
    path.join(nonSibling.spec, 'SPEC.md'),
    fs.readFileSync(path.join(nonSibling.spec, 'SPEC.md'), 'utf8')
      .replace('- [SLICE-01](slices/SLICE-01.md)', [
        '- [SLICE-01](slices/SLICE-01.md)',
        '- [SLICE-02](slices/SLICE-02.md)',
      ].join('\n')),
  );
  node(nonSibling.spec, 'SLICE-02', 'SPEC-0001', ['src/second']);
  fs.mkdirSync(path.join(nonSibling.cwd, 'src', 'second'), { recursive: true });
  fs.writeFileSync(path.join(nonSibling.cwd, 'src', 'second', 'item.txt'), 'second\n');
  git(nonSibling.cwd, 'add', '--', 'src/second/item.txt');
  result = runBatch(nonSibling, 'SLICE-01.01', 'SLICE-02');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /share one direct parent/);

  const blocked = batchFixture(t);
  const blockedPath = path.join(blocked.spec, 'slices', 'SLICE-01.02.md');
  fs.writeFileSync(
    blockedPath,
    fs.readFileSync(blockedPath, 'utf8')
      .replace('"blocked_by": []', '"blocked_by": [\n    "SLICE-01.01"\n  ]'),
  );
  result = runBatch(blocked, 'SLICE-01.01', 'SLICE-01.02');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not ready: SLICE-01\.02/);
});

test('atomic Leaf status completion rolls back an earlier write when a later write fails', (t) => {
  const state = batchFixture(t);
  const ids = ['SLICE-01.01', 'SLICE-01.02'];
  const originals = ids.map((id) => fs.readFileSync(
    path.join(state.spec, 'slices', `${id}.md`), 'utf8',
  ));
  let writes = 0;
  assert.throws(() => completeBoundariesAtomically(state.spec, ids, (...args) => {
    writes += 1;
    if (writes === 2) {
      fs.writeFileSync(args[0], args[1].slice(0, 16), args[2]);
      const error = new Error('forced status write failure');
      error.code = 'EACCES';
      throw error;
    }
    fs.writeFileSync(...args);
  }), /forced status write failure/);
  ids.forEach((id, index) => {
    assert.equal(
      fs.readFileSync(path.join(state.spec, 'slices', `${id}.md`), 'utf8'),
      originals[index],
    );
  });
});

test('close-batch rejects a changed product snapshot before completing statuses', (t) => {
  const state = batchFixture(t);
  const ids = ['SLICE-01.01', 'SLICE-01.02'];
  let fingerprintCalls = 0;
  const result = closeBatch({
    action: 'close-batch', cwd: state.cwd, spec: state.spec, nodes: ids,
  }, {
    productFingerprint: () => `sha256:${String(++fingerprintCalls).padStart(64, '0')}`,
    runGateFiles: () => ({
      executions: ids.map((id) => ({
        filePath: path.join(state.spec, 'gates', `${id}.md`),
        id: 'G1', passed: true, skipped: false,
      })),
      status: { allMet: true },
    }),
  });
  assert.equal(result.action, 'environment_blocked');
  assert.match(result.error, /product snapshot changed during close-batch/);
  for (const id of ids) {
    assert.equal(statusOf(path.join(state.spec, 'slices', `${id}.md`)), 'pending');
  }
});

test('close-batch rolls statuses back when the product changes after status completion', (t) => {
  const state = batchFixture(t);
  const ids = ['SLICE-01.01', 'SLICE-01.02'];
  const stable = `sha256:${'a'.repeat(64)}`;
  const changed = `sha256:${'b'.repeat(64)}`;
  const fingerprints = [stable, stable, stable, changed];
  const result = closeBatch({
    action: 'close-batch', cwd: state.cwd, spec: state.spec, nodes: ids,
  }, {
    productFingerprint: () => fingerprints.shift(),
  });
  assert.equal(result.action, 'environment_blocked');
  assert.match(result.error, /product snapshot changed during close-batch/);
  for (const id of ids) {
    assert.equal(statusOf(path.join(state.spec, 'slices', `${id}.md`)), 'pending');
  }
});

test('close-batch revalidates an overlapping completed Leaf and its completed Branch', (t) => {
  const state = fixture(t);
  fs.rmSync(path.join(state.spec, 'slices', 'SLICE-01.02.md'));
  fs.rmSync(path.join(state.spec, 'gates', 'SLICE-01.02.md'));
  const specPath = path.join(state.spec, 'SPEC.md');
  fs.writeFileSync(
    specPath,
    fs.readFileSync(specPath, 'utf8').replace(
      '- [SLICE-01](slices/SLICE-01.md)',
      '- [SLICE-01](slices/SLICE-01.md)\n- [SLICE-02](slices/SLICE-02.md)',
    ),
  );
  const firstBranch = path.join(state.spec, 'slices', 'SLICE-01.md');
  const first = path.join(state.spec, 'slices', 'SLICE-01.01.md');
  fs.writeFileSync(
    first,
    fs.readFileSync(first, 'utf8').replace('"src/backend"', '"src/shared/"'),
  );
  node(state.spec, 'SLICE-02', 'SPEC-0001', []);
  const secondBranch = path.join(state.spec, 'slices', 'SLICE-02.md');
  fs.writeFileSync(
    secondBranch,
    fs.readFileSync(secondBranch, 'utf8')
      .replace('"run_after": []', '"run_after": [\n    "SLICE-01"\n  ]'),
  );
  node(state.spec, 'SLICE-02.01', 'SLICE-02', ['src/shared/']);
  const second = path.join(state.spec, 'slices', 'SLICE-02.01.md');
  fs.mkdirSync(path.join(state.cwd, 'src', 'shared'), { recursive: true });
  const shared = path.join(state.cwd, 'src', 'shared', 'item.txt');
  fs.writeFileSync(shared, 'first valid\n');
  const predecessorCheck = JSON.stringify([
    process.execPath, '-e',
    "const fs=require('node:fs');process.exit(fs.readFileSync('src/shared/item.txt','utf8').includes('invalid')?4:0)",
  ]);
  const pass = JSON.stringify([process.execPath, '-e', 'process.exit(0)']);
  gate(state.spec, 'SLICE-01.01', false, pass);
  gate(state.spec, 'SLICE-01', false, predecessorCheck, ['src/shared/item.txt']);
  gate(state.spec, 'SLICE-02.01', false, pass);
  git(state.cwd, 'add', '--', 'src/shared/item.txt');

  let result = runBatch(state, 'SLICE-01.01');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusOf(first), 'completed');
  result = runAction(state, 'close', 'SLICE-01', '--mode', 'subslice');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusOf(firstBranch), 'completed');

  fs.writeFileSync(shared, 'invalid successor\n');
  git(state.cwd, 'add', '--', 'src/shared/item.txt');
  result = runBatch(state, 'SLICE-02.01');
  assert.equal(result.status, 1, result.stderr);
  let output = JSON.parse(result.stdout);
  assert.deepEqual(output.revalidated, ['SLICE-01.01', 'SLICE-01']);
  assert.deepEqual(output.failures, [{ node: 'SLICE-01', reasons: ['gate-failed'] }]);
  assert.equal(statusOf(first), 'completed');
  assert.equal(statusOf(firstBranch), 'completed');
  assert.equal(statusOf(second), 'pending');

  fs.writeFileSync(shared, 'valid successor\n');
  git(state.cwd, 'add', '--', 'src/shared/item.txt');
  result = runBatch(state, 'SLICE-02.01');
  assert.equal(result.status, 0, result.stderr);
  output = JSON.parse(result.stdout);
  assert.deepEqual(output.revalidated, ['SLICE-01.01', 'SLICE-01']);
  assert.equal(statusOf(second), 'completed');
});

test('close-batch rejects non-ready and abandoned execution trees', (t) => {
  const notReady = rootOnlyFixture(t);
  const closed = runAction(notReady, 'close', 'SPEC-0001', '--mode', 'root-only');
  assert.equal(closed.status, 0, closed.stderr);
  const specPath = path.join(notReady.spec, 'SPEC.md');
  fs.writeFileSync(
    specPath,
    fs.readFileSync(specPath, 'utf8').replace('"status": "ready"', '"status": "completed"'),
  );
  let result = runBatch(notReady, 'SLICE-01');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires Spec status ready/);

  const abandoned = batchFixture(t);
  const gateFile = path.join(abandoned.spec, 'gates', 'SLICE-01.01.md');
  fs.writeFileSync(
    gateFile,
    `${fs.readFileSync(gateFile, 'utf8')}ABANDON: G1 stopped\n`,
  );
  result = runBatch(abandoned, 'SLICE-01.01', 'SLICE-01.02');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /ABANDON stopped execution/);
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

test('review-pass commits a reviewed root-only range without completing the Spec', (t) => {
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
  assert.equal(output.state, 'reviewed');
  assert.equal(output.fingerprint, undefined);
  assert.deepEqual(output.paths, ['product.txt']);
  assert.match(output.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(output.gates, { checked: 1, unmet: [] });
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'ready');
});

test('single Root Slice finalization reuses its exact review without completing the Spec', (t) => {
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
  assert.equal(output.state, 'reviewed');
  assert.equal(output.commit, state.commit);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'ready');
  assert.match(fs.readFileSync(path.join(state.spec, 'gates', 'SPEC-0001.md'), 'utf8'), /- \[x\] G1/);
});

test('multiple Root Slices receive one range review and remain ready until apply', (t) => {
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
  assert.equal(JSON.parse(passed.stdout).state, 'reviewed');
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.spec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'ready');
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

test('capture describes a direct Branch owner from the same validated tree', (t) => {
  const state = fixture(t);
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const output = JSON.parse(captured.stdout);
  assert.equal(output.action, 'dispatch');
  assert.equal(output.dispatch.root_only, false);
  assert.equal(output.dispatch.direct_root_count, 1);
  assert.deepEqual(output.dispatch.targets, [{
    id: 'SLICE-01',
    owner: 'slice-coordinator',
    status: 'pending',
    boundary: '.proofline/specs/SPEC-0001/slices/SLICE-01.md',
    gate: '.proofline/specs/SPEC-0001/gates/SLICE-01.md',
    mode: 'root-slice',
    finalization: 'single-root',
    runnable: true,
    review_ready: false,
  }]);
});

test('capture fails fast for non-runnable lifecycle and recovery states', (t) => {
  const draft = rootOnlyFixture(t);
  const draftSpec = path.join(draft.spec, 'SPEC.md');
  fs.writeFileSync(
    draftSpec,
    fs.readFileSync(draftSpec, 'utf8').replace('"status": "ready"', '"status": "draft"'),
  );
  let captured = runAction(draft, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 2);
  assert.match(captured.stderr, /status must be ready or completed/);

  const abandoned = rootOnlyFixture(t);
  fs.appendFileSync(path.join(abandoned.spec, 'gates', 'SPEC-0001.md'), 'ABANDON: G1 unavailable\n');
  captured = runAction(abandoned, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 1, captured.stderr);
  let output = JSON.parse(captured.stdout);
  assert.equal(output.action, 'stopped');
  assert.match(output.reason, /ABANDON/);

  const reviewReady = rootOnlyFixture(t);
  git(reviewReady.cwd, 'restore', '--staged', '--worktree', '--', 'product.txt');
  const reviewGate = path.join(reviewReady.spec, 'gates', 'SPEC-0001.md');
  fs.writeFileSync(
    reviewGate,
    fs.readFileSync(reviewGate, 'utf8')
      .replace('- [ ] G1', '- [x] G1')
      .replace('EVIDENCE: pending', 'EVIDENCE: verified by fixture'),
  );
  captured = runAction(reviewReady, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 1, captured.stderr);
  output = JSON.parse(captured.stdout);
  assert.equal(output.action, 'review_recovery_required');
  assert.equal(output.dispatch, null);

  const completed = rootOnlyFixture(t);
  const completedGate = path.join(completed.spec, 'gates', 'SPEC-0001.md');
  fs.writeFileSync(
    completedGate,
    fs.readFileSync(completedGate, 'utf8')
      .replace('- [ ] G1', '- [x] G1')
      .replace('EVIDENCE: pending', 'EVIDENCE: verified by fixture'),
  );
  const completedSpec = path.join(completed.spec, 'SPEC.md');
  fs.writeFileSync(
    completedSpec,
    fs.readFileSync(completedSpec, 'utf8').replace('"status": "ready"', '"status": "completed"'),
  );
  captured = runAction(completed, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 1, captured.stderr);
  output = JSON.parse(captured.stdout);
  assert.equal(output.action, 'terminal');
  assert.equal(output.dispatch, null);

  const finalization = finalizationFixture(t, 2);
  captured = runAction(finalization, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 1, captured.stderr);
  output = JSON.parse(captured.stdout);
  assert.equal(output.action, 'finalization_recovery_required');
  assert.equal(output.dispatch, null);
});

test('capture and apply-reviewed transport one reviewed range as uncommitted changes', (t) => {
  const state = reviewedApplicationFixture(t);
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.sourceSpec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'ready');
  assert.equal(fs.existsSync(path.join(state.sourceSpec, 'reviewer.md')), false);
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);
  assert.equal(destination.action, 'dispatch');
  assert.deepEqual(destination.overlap, []);
  assert.equal(destination.dispatch.control_fingerprint, destination.control_fingerprint);
  assert.equal(destination.dispatch.root_only, true);
  assert.equal(destination.dispatch.direct_root_count, 0);
  assert.deepEqual(destination.dispatch.targets, [{
    id: 'SPEC-0001',
    owner: 'root-implementer',
    status: 'ready',
    boundary: '.proofline/specs/SPEC-0001/SPEC.md',
    gate: '.proofline/specs/SPEC-0001/gates/SPEC-0001.md',
    mode: 'root-only',
    finalization: 'root-only',
    runnable: true,
    review_ready: false,
  }]);

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
  assert.equal(JSON.parse(
    fs.readFileSync(path.join(state.sourceSpec, 'SPEC.md'), 'utf8').match(/^---\n([\s\S]*?)\n---/)[1],
  ).status, 'ready');
});

test('apply-reviewed rejects incomplete source control without mutating the destination', (t) => {
  const state = reviewedApplicationFixture(t);
  const captured = runAction(state, 'capture', 'SPEC-0001');
  assert.equal(captured.status, 0, captured.stderr);
  const destination = JSON.parse(captured.stdout);
  const sourceGate = path.join(state.sourceSpec, 'gates', 'SPEC-0001.md');
  fs.writeFileSync(
    sourceGate,
    fs.readFileSync(sourceGate, 'utf8').replace('- [x] G1', '- [ ] G1'),
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
  assert.match(applied.stderr, /reviewed source control state is incomplete: root Gate is unmet/);
  assert.equal(fs.readFileSync(path.join(state.cwd, 'product.txt'), 'utf8'), 'before\n');
  assert.doesNotMatch(
    fs.readFileSync(path.join(state.spec, 'gates', 'SPEC-0001.md'), 'utf8'),
    /- \[x\] G1/,
  );
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
  assert.equal(destination.dispatch, null);
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
