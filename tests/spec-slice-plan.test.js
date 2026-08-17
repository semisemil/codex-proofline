const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'skills', 'spec-slice', 'scripts', 'inspect-slice-plan.js');
const { PlanError, inspectSlicePlan } = require(scriptPath);

function writeSlice(root, metadata, name = `${metadata.id}.md`, body = [
  '## Outcome',
  '',
  'Test outcome.',
  '',
  '## Spec section',
  '',
  '[Example](../SPEC.md#example)',
  '',
  '## Concurrency boundary',
  '',
  'No shared resources.',
  '',
  '## Slice checks',
  '',
  'Focused tests.',
  '',
  '## Integration checks',
  '',
  'None.',
].join('\n')) {
  fs.writeFileSync(
    path.join(root, name),
    `---\n${JSON.stringify(metadata, null, 2)}\n---\n\n${body}\n`,
    'utf8',
  );
}

function plan(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-slices-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function slice(id, overrides = {}) {
  return {
    schema_version: 2,
    id,
    spec_id: 'SPEC-0001',
    spec_revision: 3,
    title: id,
    status: 'pending',
    blocked_by: [],
    run_after: [],
    ...overrides,
  };
}

test('v2 plan computes stable parallel dispatch and integration order', (t) => {
  const root = plan(t);
  writeSlice(root, slice('SLICE-02'));
  writeSlice(root, slice('SLICE-01'));
  writeSlice(root, slice('SLICE-03', { blocked_by: ['SLICE-01'] }));

  const result = inspectSlicePlan(root);

  assert.equal(result.plan_mode, 'v2');
  assert.equal(result.concurrency_limit, 2);
  assert.deepEqual(result.runnable, ['SLICE-01', 'SLICE-02']);
  assert.deepEqual(result.dispatch, ['SLICE-01', 'SLICE-02']);
  assert.deepEqual(result.integration_order, ['SLICE-01', 'SLICE-02', 'SLICE-03']);
});

test('completed dependencies unlock blocked_by and run_after targets', (t) => {
  const root = plan(t);
  writeSlice(root, slice('SLICE-01', { status: 'completed' }));
  writeSlice(root, slice('SLICE-02', { blocked_by: ['SLICE-01'] }));
  writeSlice(root, slice('SLICE-03', { run_after: ['SLICE-01'] }));

  const result = inspectSlicePlan(root);

  assert.deepEqual(result.runnable, ['SLICE-02', 'SLICE-03']);
  assert.deepEqual(result.dispatch, ['SLICE-02', 'SLICE-03']);
});

test('v1 and mixed plans remain sequential without migration', (t) => {
  const legacyRoot = plan(t);
  const legacy = slice('SLICE-01', { schema_version: 1 });
  delete legacy.run_after;
  writeSlice(legacyRoot, legacy);
  writeSlice(legacyRoot, { ...legacy, id: 'SLICE-02', title: 'SLICE-02' });

  const legacyResult = inspectSlicePlan(legacyRoot);
  assert.equal(legacyResult.plan_mode, 'legacy-sequential');
  assert.equal(legacyResult.concurrency_limit, 1);
  assert.deepEqual(legacyResult.dispatch, ['SLICE-01']);

  const mixedRoot = plan(t);
  writeSlice(mixedRoot, legacy);
  writeSlice(mixedRoot, slice('SLICE-02'));

  const mixedResult = inspectSlicePlan(mixedRoot);
  assert.equal(mixedResult.plan_mode, 'mixed-sequential');
  assert.equal(mixedResult.concurrency_limit, 1);
});

test('malformed v2 and invalid references stop deterministically', (t) => {
  const missingRoot = plan(t);
  const missing = slice('SLICE-01');
  delete missing.run_after;
  writeSlice(missingRoot, missing);
  assert.throws(() => inspectSlicePlan(missingRoot), PlanError);

  for (const [label, title] of [['missing', undefined], ['empty', '  '], ['non-string', 42]]) {
    const titleRoot = plan(t);
    const malformed = slice('SLICE-01', { title });
    if (label === 'missing') delete malformed.title;
    writeSlice(titleRoot, malformed);
    assert.throws(
      () => inspectSlicePlan(titleRoot),
      /title must be a non-empty string/,
      `${label} title must fail`,
    );
  }

  const bodyRoot = plan(t);
  writeSlice(bodyRoot, slice('SLICE-01'), 'SLICE-01.md', '## Outcome\n\nOnly an outcome.');
  assert.throws(() => inspectSlicePlan(bodyRoot), /Spec section section is required/);

  const fencedBodyRoot = plan(t);
  const fencedBody = [
    '## Outcome', '', 'Outcome.', '',
    '## Spec section', '', '```md', '[Example](../SPEC.md#example)', '```', '',
    '## Concurrency boundary', '', 'None.', '',
    '## Slice checks', '', 'None.', '',
    '## Integration checks', '', 'None.',
  ].join('\n');
  writeSlice(fencedBodyRoot, slice('SLICE-01'), 'SLICE-01.md', fencedBody);
  assert.throws(() => inspectSlicePlan(fencedBodyRoot), /Spec section (?:section is required|must link)/);

  const unknownRoot = plan(t);
  writeSlice(unknownRoot, slice('SLICE-01', { blocked_by: ['SLICE-99'] }));
  assert.throws(() => inspectSlicePlan(unknownRoot), /unknown Slice ID SLICE-99/);

  const selfRoot = plan(t);
  writeSlice(selfRoot, slice('SLICE-01', { run_after: ['SLICE-01'] }));
  assert.throws(() => inspectSlicePlan(selfRoot), /self-reference/);

  const cycleRoot = plan(t);
  writeSlice(cycleRoot, slice('SLICE-01', { run_after: ['SLICE-02'] }));
  writeSlice(cycleRoot, slice('SLICE-02', { blocked_by: ['SLICE-01'] }));
  assert.throws(() => inspectSlicePlan(cycleRoot), /contains a cycle/);

  const impossibleStateRoot = plan(t);
  writeSlice(impossibleStateRoot, slice('SLICE-01'));
  writeSlice(impossibleStateRoot, slice('SLICE-02', {
    status: 'completed',
    blocked_by: ['SLICE-01'],
  }));
  assert.throws(
    () => inspectSlicePlan(impossibleStateRoot),
    /completed Slice has incomplete dependencies: SLICE-01/,
  );
});

test('CLI emits the inspected plan as JSON', (t) => {
  const root = plan(t);
  writeSlice(root, slice('SLICE-01'));

  const result = spawnSync(process.execPath, [scriptPath, root], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).plan_mode, 'v2');
});
