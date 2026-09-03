'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ControlStateError } = require('../skills/start-implementation/scripts/control-state.js');
const { sync } = require('../skills/start-implementation/scripts/sync-control-state.js');

function writeDocument(filePath, metadata, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${JSON.stringify(metadata, null, 2)}\n---\n\n${body}\n`);
}

function writeGate(spec, id) {
  fs.mkdirSync(path.join(spec, 'gates'), { recursive: true });
  fs.writeFileSync(path.join(spec, 'gates', `${id}.md`), [
    `# Gates: ${id}`,
    'Scope: SPEC-0001 revision 1',
    '',
    '- [ ] G1: fixture result',
    '  CHECK: NONE',
    '  EVIDENCE: pending',
    '',
  ].join('\n'));
}

function writeLeaf(spec, id, scope) {
  writeDocument(path.join(spec, 'slices', `${id}.md`), {
    schema_version: 3,
    id,
    spec_id: 'SPEC-0001',
    spec_revision: 1,
    parent_id: 'SPEC-0001',
    title: id,
    status: 'pending',
    blocked_by: [],
    run_after: [],
    write_scope: [scope],
  }, [
    '## Outcome', '', 'Fixture outcome.', '',
    '## Spec sections', '', '[Requirement](../SPEC.md#requirement)', '',
    '## Contract', '', 'Fixture contract.', '',
    '## Context', '', 'Fixture context.',
  ].join('\n'));
  writeGate(spec, id);
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-control-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10 }));
  const destination = path.join(root, 'destination');
  const spec = path.join(destination, '.proofline', 'specs', 'SPEC-0001');
  writeDocument(path.join(spec, 'SPEC.md'), {
    schema_version: 2,
    id: 'SPEC-0001',
    title: 'Control merge',
    kind: 'feature',
    status: 'ready',
    revision: 1,
    supersedes: [],
    superseded_by: null,
    related_issues: [],
  }, '# Control merge\n\n## Slices\n\n- [SLICE-01](slices/SLICE-01.md)\n- [SLICE-02](slices/SLICE-02.md)');
  writeLeaf(spec, 'SLICE-01', 'src/one');
  writeLeaf(spec, 'SLICE-02', 'src/two');
  writeGate(spec, 'SPEC-0001');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.cpSync(destination, first, { recursive: true });
  fs.cpSync(destination, second, { recursive: true });
  return { destination, spec, first, second };
}

function complete(workspace, id, evidence) {
  const spec = path.join(workspace, '.proofline', 'specs', 'SPEC-0001');
  const nodePath = path.join(spec, 'slices', `${id}.md`);
  fs.writeFileSync(nodePath, fs.readFileSync(nodePath, 'utf8').replace(
    '"status": "pending"',
    '"status": "completed"',
  ));
  const gatePath = path.join(spec, 'gates', `${id}.md`);
  fs.writeFileSync(gatePath, fs.readFileSync(gatePath, 'utf8')
    .replace('- [ ] G1', '- [x] G1')
    .replace('EVIDENCE: pending', `EVIDENCE: ${evidence}`));
}

test('multi-root control sync unions terminal state without regressing earlier results', (t) => {
  const state = fixture(t);
  complete(state.first, 'SLICE-01', 'first root');
  complete(state.second, 'SLICE-02', 'second root');
  const relative = '.proofline/specs/SPEC-0001';

  sync({ cwd: state.destination, source: state.first, spec: relative });
  sync({ cwd: state.destination, source: state.second, spec: relative });

  for (const [id, evidence] of [['SLICE-01', 'first root'], ['SLICE-02', 'second root']]) {
    assert.match(fs.readFileSync(path.join(state.spec, 'slices', `${id}.md`), 'utf8'), /"status": "completed"/);
    const gate = fs.readFileSync(path.join(state.spec, 'gates', `${id}.md`), 'utf8');
    assert.match(gate, /- \[x\] G1/);
    assert.match(gate, new RegExp(`EVIDENCE: ${evidence}`));
  }
});

test('control sync rejects immutable definition drift before writing destination state', (t) => {
  const state = fixture(t);
  complete(state.first, 'SLICE-01', 'first root');
  const sourceGate = path.join(
    state.first, '.proofline', 'specs', 'SPEC-0001', 'gates', 'SLICE-01.md',
  );
  fs.writeFileSync(
    sourceGate,
    fs.readFileSync(sourceGate, 'utf8').replace('G1: fixture result', 'G1: changed definition'),
  );
  const before = fs.readFileSync(path.join(state.spec, 'gates', 'SLICE-01.md'), 'utf8');

  assert.throws(
    () => sync({
      cwd: state.destination,
      source: state.first,
      spec: '.proofline/specs/SPEC-0001',
    }),
    ControlStateError,
  );
  assert.equal(fs.readFileSync(path.join(state.spec, 'gates', 'SLICE-01.md'), 'utf8'), before);
});
