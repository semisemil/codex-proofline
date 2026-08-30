const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(
  repoRoot,
  'skills',
  'spec-slice',
  'scripts',
  'inspect-execution-tree.js',
);
const templatePath = path.join(
  repoRoot,
  'skills',
  'spec-slice',
  'assets',
  'templates',
  'slice.md',
);
const {
  ExecutionTreeError,
  inspectExecutionTree,
  main,
  stripFencedCode,
} = require(scriptPath);

const SPEC_ID = 'SPEC-0001';
const SPEC_REVISION = 3;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-execution-tree-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeDocument(filePath, metadata, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\n${JSON.stringify(metadata, null, 2)}\n---\n\n${body}\n`,
    'utf8',
  );
}

function sliceLink(id, fileName = `${id}.md`, overrides = {}) {
  return {
    label: id,
    target: `slices/${fileName}`,
    ...overrides,
  };
}

function specBody(links = []) {
  const entries = links.length > 0
    ? links.map((link) => `- [${link.label}](${link.target})`)
    : ['No child Nodes.'];
  return [
    '# Fixture Spec',
    '',
    '## Slices',
    '',
    ...entries,
  ].join('\n');
}

function writeSpec(root, options = {}) {
  const metadata = {
    schema_version: 2,
    id: SPEC_ID,
    title: 'Fixture Spec',
    kind: 'feature',
    status: options.status || 'ready',
    revision: options.revision || SPEC_REVISION,
    supersedes: [],
    superseded_by: null,
    related_issues: [],
    ...(options.metadata || {}),
  };
  writeDocument(
    path.join(root, 'SPEC.md'),
    metadata,
    options.body === undefined ? specBody(options.links || []) : options.body,
  );
}

function expectedParent(id) {
  const separator = id.lastIndexOf('.');
  return separator < 0 ? SPEC_ID : id.slice(0, separator);
}

function nodeMetadata(id, overrides = {}) {
  return {
    schema_version: 3,
    id,
    spec_id: SPEC_ID,
    spec_revision: SPEC_REVISION,
    parent_id: expectedParent(id),
    title: id,
    status: 'pending',
    blocked_by: [],
    run_after: [],
    write_scope: [`src/${id}.js`],
    ...overrides,
  };
}

function nodeBody(overrides = {}) {
  const sections = {
    Outcome: 'Observable fixture outcome.',
    'Spec sections': '[Requirement](../SPEC.md#requirements)',
    Contract: 'Own only this fixture result.',
    Context: 'Fixture context.',
    ...overrides,
  };
  return [
    '## Outcome',
    '',
    sections.Outcome,
    '',
    '## Spec sections',
    '',
    sections['Spec sections'],
    '',
    '## Contract',
    '',
    sections.Contract,
    '',
    '## Context',
    '',
    sections.Context,
  ].join('\n');
}

function writeNode(root, metadata, options = {}) {
  const fileName = options.fileName || `${metadata.id}.md`;
  writeDocument(
    path.join(root, 'slices', fileName),
    metadata,
    options.body === undefined ? nodeBody() : options.body,
  );
  return fileName;
}

function writeGate(root, id, state = 'unmet', binding = {}) {
  const checked = state === 'met' || state === 'checked-pending';
  const evidence = state === 'met' ? 'verified by fixture' : 'pending';
  const headingId = binding.headingId ?? id;
  const specId = binding.specId ?? SPEC_ID;
  const specRevision = binding.specRevision ?? SPEC_REVISION;
  const lines = [
    `# Gates: ${headingId}`,
    `Scope: ${specId} revision ${specRevision}`,
  ];
  lines.push('', `- [${checked ? 'x' : ' '}] G1: ${id} outcome`);
  const check = binding.check || 'proofline-inspector-test-command';
  lines.push(`  CHECK: ${Array.isArray(check) ? JSON.stringify(check) : check}`);
  if (binding.requires) lines.push(`  REQUIRES: ${JSON.stringify(binding.requires)}`);
  lines.push(`  EVIDENCE: ${evidence}`);
  if (state === 'abandoned') {
    lines.push('', 'ABANDON: G1 fixture cannot finish');
  }
  const directory = path.join(root, 'gates');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${id}.md`), `${lines.join('\n')}\n`, 'utf8');
}

function writeGateSet(root, ids, states = {}) {
  for (const id of ids) writeGate(root, id, states[id] || 'unmet');
}

function expectTreeError(root, pattern) {
  assert.throws(
    () => inspectExecutionTree(root),
    (error) => {
      assert.ok(error instanceof ExecutionTreeError);
      assert.match(error.message, pattern);
      return true;
    },
  );
}

function expectTreeCliError(root, pattern) {
  const result = spawnSync(process.execPath, [scriptPath, root], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, pattern);
}

test('v3 template is exact and forbidden persisted fields are rejected', (t) => {
  const actual = fs.readFileSync(templatePath, 'utf8').replace(/\r\n/g, '\n').trim();
  const expected = `---
{
  "schema_version": 3,
  "id": {{slice_id_json}},
  "spec_id": {{spec_id_json}},
  "spec_revision": {{spec_revision}},
  "parent_id": {{parent_id_json}},
  "title": {{title_json}},
  "status": "pending",
  "blocked_by": {{blocked_by_json}},
  "run_after": {{run_after_json}},
  "write_scope": {{write_scope_json}}
}
---

## Outcome

{{outcome}}

## Spec sections

{{spec_sections}}

## Contract

{{contract}}

## Context

{{context}}`;
  assert.equal(actual, expected);
  for (const field of ['type', 'mode', 'acceptance_refs']) {
    assert.doesNotMatch(actual, new RegExp(`"${field}"`));
    const root = fixture(t);
    writeSpec(root, { links: [sliceLink('SLICE-01')] });
    writeNode(root, nodeMetadata('SLICE-01', { [field]: field === 'acceptance_refs' ? [] : 'leaf' }));
    expectTreeError(root, new RegExp(`extra ${field}`));
  }
  assert.equal(typeof main, 'function');
  assert.equal(typeof stripFencedCode, 'function');
});

test('root-only tree exposes only the root dispatch candidate while ready with an unmet Gate', (t) => {
  const root = fixture(t);
  writeSpec(root);
  writeGate(root, SPEC_ID, 'checked-pending');

  let result = inspectExecutionTree(root);
  assert.deepEqual(result.nodes, []);
  assert.equal(result.root_gate_all_met, false, 'checked with pending evidence is still unmet');
  assert.deepEqual(result.runnable_leaves, [SPEC_ID]);
  assert.deepEqual(result.dispatch_candidates, [SPEC_ID]);
  assert.deepEqual(result.runnable_slices, []);
  assert.equal('dispatch' in result, false);

  writeGate(root, SPEC_ID, 'met');
  result = inspectExecutionTree(root);
  assert.equal(result.root_gate_all_met, true);
  assert.deepEqual(result.runnable_leaves, []);
  assert.deepEqual(result.dispatch_candidates, []);
  assert.deepEqual(result.runnable_slices, []);

  writeSpec(root, { status: 'completed' });
  result = inspectExecutionTree(root);
  assert.equal(result.spec_status, 'completed');
  assert.deepEqual(result.dispatch_candidates, []);
  assert.deepEqual(result.runnable_slices, []);

  writeGate(root, SPEC_ID, 'unmet');
  expectTreeError(root, /completed Spec requires the root Gate to be all met/);

  writeSpec(root, { status: 'draft' });
  expectTreeError(root, /status must be ready or completed/);
});

test('root Gate binding rejects a checked and met Gate from an older Spec revision', (t) => {
  const root = fixture(t);
  writeSpec(root, { revision: SPEC_REVISION + 1 });
  writeGate(root, SPEC_ID, 'met', { specRevision: SPEC_REVISION });

  const pattern = /SPEC-0001\.md: Gate Scope must be "Scope: SPEC-0001 revision 4"/;
  expectTreeError(root, pattern);
  expectTreeCliError(root, pattern);
});

test('Node Gate binding rejects owner ID and Spec scope mismatches', (t) => {
  const wrongId = fixture(t);
  writeSpec(wrongId, { links: [sliceLink('SLICE-01')] });
  writeNode(wrongId, nodeMetadata('SLICE-01'));
  writeGate(wrongId, SPEC_ID);
  writeGate(wrongId, 'SLICE-01', 'met', { headingId: 'SLICE-02' });

  const idPattern = /SLICE-01\.md: Gate heading must be "# Gates: SLICE-01"/;
  expectTreeError(wrongId, idPattern);
  expectTreeCliError(wrongId, idPattern);

  const wrongSpec = fixture(t);
  writeSpec(wrongSpec, { links: [sliceLink('SLICE-01')] });
  writeNode(wrongSpec, nodeMetadata('SLICE-01'));
  writeGate(wrongSpec, SPEC_ID);
  writeGate(wrongSpec, 'SLICE-01', 'met', { specId: 'SPEC-9999' });

  const scopePattern = /SLICE-01\.md: Gate Scope must be "Scope: SPEC-0001 revision 3"/;
  expectTreeError(wrongSpec, scopePattern);
  expectTreeCliError(wrongSpec, scopePattern);
});

test('Node Gate REQUIRES stays inside its descendant Leaf write scope', (t) => {
  const valid = fixture(t);
  writeSpec(valid, { links: [sliceLink('SLICE-01')] });
  writeNode(valid, nodeMetadata('SLICE-01', { write_scope: [] }));
  writeNode(valid, nodeMetadata('SLICE-01.01', { write_scope: ['src/feature/'] }));
  writeGate(valid, SPEC_ID);
  writeGate(valid, 'SLICE-01', 'unmet', { requires: ['src/feature/test.js'] });
  writeGate(valid, 'SLICE-01.01', 'unmet', { requires: ['src/feature/unit.test.js'] });
  assert.equal(inspectExecutionTree(valid).spec_id, SPEC_ID);

  const invalid = fixture(t);
  writeSpec(invalid, { links: [sliceLink('SLICE-01')] });
  writeNode(invalid, nodeMetadata('SLICE-01', { write_scope: ['src/feature/'] }));
  writeGate(invalid, SPEC_ID);
  writeGate(invalid, 'SLICE-01', 'unmet', { requires: ['tests/unowned.test.js'] });
  expectTreeError(invalid, /REQUIRES path is outside Node write_scope/);
});

test('REQUIRES rejects directories and duplicate Gate ownership during planning', (t) => {
  const project = fixture(t);
  const root = path.join(project, '.proofline', 'specs', SPEC_ID);
  fs.mkdirSync(path.join(project, 'frontend', 'src', 'client'), { recursive: true });
  writeSpec(root);
  writeGate(root, SPEC_ID, 'unmet', { requires: ['frontend/src/client'] });
  expectTreeError(root, /REQUIRES must name a file, not directory/);

  fs.rmSync(path.join(project, 'frontend'), { recursive: true, force: true });
  writeSpec(root, { links: [sliceLink('SLICE-01')] });
  writeNode(root, nodeMetadata('SLICE-01', { write_scope: ['tests/required.test.js'] }));
  writeGate(root, SPEC_ID, 'unmet', { requires: ['tests/required.test.js'] });
  writeGate(root, 'SLICE-01', 'unmet', { requires: ['tests/required.test.js'] });
  expectTreeError(root, /duplicates REQUIRES tests\/required\.test\.js/);
});

test('three-level tree exposes every safe Leaf as a deterministic dispatch candidate', (t) => {
  const root = fixture(t);
  const ids = [
    'SLICE-01',
    'SLICE-01.01',
    'SLICE-01.01.01',
    'SLICE-01.01.02',
    'SLICE-01.01.03',
  ];
  writeSpec(root, { links: [sliceLink('SLICE-01', 'top-node.md')] });
  writeNode(root, nodeMetadata('SLICE-01', { write_scope: [] }), { fileName: 'top-node.md' });
  writeNode(root, nodeMetadata('SLICE-01.01', { write_scope: [] }), { fileName: 'middle-node.md' });
  writeNode(root, nodeMetadata('SLICE-01.01.01', { write_scope: ['src/one.js'] }));
  writeNode(root, nodeMetadata('SLICE-01.01.02', { write_scope: ['src/two.js'] }));
  writeNode(root, nodeMetadata('SLICE-01.01.03', { write_scope: ['src/three.js'] }));
  writeGateSet(root, [SPEC_ID, ...ids]);

  const result = inspectExecutionTree(root);
  assert.deepEqual(result.runnable_leaves, [
    'SLICE-01.01.01',
    'SLICE-01.01.02',
    'SLICE-01.01.03',
  ]);
  assert.deepEqual(result.dispatch_candidates, [
    'SLICE-01.01.01',
    'SLICE-01.01.02',
    'SLICE-01.01.03',
  ]);
  assert.deepEqual(result.runnable_slices, ['SLICE-01']);
  assert.equal('dispatch' in result, false);
  assert.equal(result.nodes.find((node) => node.id === 'SLICE-01').position, 'slice');
  assert.equal(result.nodes.find((node) => node.id === 'SLICE-01.01.01').depth, 3);
});

test('direct-Slice dependencies unlock runnable Slices and exclude Blind Review-only work', (t) => {
  const root = fixture(t);
  const first = nodeMetadata('SLICE-01', { write_scope: ['src/first.js'] });
  const second = nodeMetadata('SLICE-02', {
    run_after: [first.id],
    write_scope: ['src/second.js'],
  });
  const reviewOnly = nodeMetadata('SLICE-03', { write_scope: ['src/review-only.js'] });
  writeSpec(root, {
    links: [sliceLink(first.id), sliceLink(second.id), sliceLink(reviewOnly.id)],
  });
  writeNode(root, first);
  writeNode(root, second);
  writeNode(root, reviewOnly);
  writeGateSet(root, [SPEC_ID, first.id, second.id, reviewOnly.id], {
    [reviewOnly.id]: 'met',
  });

  let result = inspectExecutionTree(root);
  assert.deepEqual(result.dispatch_candidates, [first.id]);
  assert.deepEqual(result.runnable_slices, [first.id]);
  assert.deepEqual(result.review_ready, [reviewOnly.id]);

  writeNode(root, { ...first, status: 'completed' });
  writeGate(root, first.id, 'met');
  result = inspectExecutionTree(root);
  assert.deepEqual(result.dispatch_candidates, [second.id]);
  assert.deepEqual(result.runnable_slices, [second.id]);
  assert.deepEqual(result.review_ready, [reviewOnly.id]);
});

test('sibling ordering unlocks Leaves and Branches progress bottom-up into review', (t) => {
  const root = fixture(t);
  const top = nodeMetadata('SLICE-01', { write_scope: [] });
  const branch = nodeMetadata('SLICE-01.01', { write_scope: [] });
  const first = nodeMetadata('SLICE-01.01.01', {
    status: 'completed',
    write_scope: ['src/first.js'],
  });
  const second = nodeMetadata('SLICE-01.01.02', {
    run_after: ['SLICE-01.01.01'],
    write_scope: ['src/second.js'],
  });
  writeSpec(root, { links: [sliceLink('SLICE-01')] });
  writeNode(root, top);
  writeNode(root, branch);
  writeNode(root, first);
  writeNode(root, second);
  writeGateSet(root, [SPEC_ID, top.id, branch.id, first.id, second.id], {
    [first.id]: 'met',
  });

  let result = inspectExecutionTree(root);
  assert.deepEqual(result.runnable_leaves, [second.id]);
  assert.deepEqual(result.completable_branches, []);

  writeNode(root, { ...second, status: 'completed' });
  writeGate(root, second.id, 'met');
  result = inspectExecutionTree(root);
  assert.deepEqual(result.completable_branches, [branch.id]);

  writeGate(root, branch.id, 'met');
  result = inspectExecutionTree(root);
  assert.deepEqual(
    result.completable_branches,
    [branch.id],
    'a deep Branch remains completable so its pending status can finalize',
  );

  writeNode(root, { ...branch, status: 'completed' });
  result = inspectExecutionTree(root);
  assert.deepEqual(
    result.completable_branches,
    [top.id],
    'a direct Branch is completable while its own Gate still needs work',
  );
  assert.deepEqual(result.review_ready, []);

  writeGate(root, top.id, 'met');
  result = inspectExecutionTree(root);
  assert.deepEqual(result.completable_branches, []);
  assert.deepEqual(result.review_ready, [top.id]);
});

test('parent graph, revision, and Gate-set structural errors stop inspection', (t) => {
  const parentCycle = fixture(t);
  writeSpec(parentCycle);
  writeNode(parentCycle, nodeMetadata('SLICE-01', { parent_id: 'SLICE-02', write_scope: [] }));
  writeNode(parentCycle, nodeMetadata('SLICE-02', { parent_id: 'SLICE-01', write_scope: [] }));
  expectTreeError(parentCycle, /parent cycle/);

  const orphan = fixture(t);
  writeSpec(orphan);
  writeNode(orphan, nodeMetadata('SLICE-01.01'));
  expectTreeError(orphan, /orphan parent SLICE-01/);

  const hierarchy = fixture(t);
  writeSpec(hierarchy, { links: [sliceLink('SLICE-02')] });
  writeNode(hierarchy, nodeMetadata('SLICE-01', { parent_id: 'SLICE-02' }));
  writeNode(hierarchy, nodeMetadata('SLICE-02', { write_scope: [] }));
  expectTreeError(hierarchy, /parent_id must be SPEC-0001 to match ID hierarchy/);

  const revision = fixture(t);
  writeSpec(revision, { links: [sliceLink('SLICE-01')] });
  writeNode(revision, nodeMetadata('SLICE-01', { spec_revision: 4 }));
  expectTreeError(revision, /spec_revision must match SPEC-0001 revision 3/);

  const missingGate = fixture(t);
  writeSpec(missingGate, { links: [sliceLink('SLICE-01')] });
  writeNode(missingGate, nodeMetadata('SLICE-01'));
  writeGate(missingGate, SPEC_ID);
  expectTreeError(missingGate, /missing Gate file: SLICE-01\.md/);

  const orphanGate = fixture(t);
  writeSpec(orphanGate);
  writeGate(orphanGate, SPEC_ID);
  writeGate(orphanGate, 'SLICE-99');
  expectTreeError(orphanGate, /orphan Gate file: SLICE-99\.md/);
});

test('combined dependencies must be acyclic and reference siblings only', (t) => {
  const cycle = fixture(t);
  writeSpec(cycle, { links: [sliceLink('SLICE-01'), sliceLink('SLICE-02')] });
  writeNode(cycle, nodeMetadata('SLICE-01', { run_after: ['SLICE-02'] }));
  writeNode(cycle, nodeMetadata('SLICE-02', { blocked_by: ['SLICE-01'] }));
  writeGateSet(cycle, [SPEC_ID, 'SLICE-01', 'SLICE-02']);
  expectTreeError(cycle, /blocked_by \+ run_after contains a dependency cycle/);

  const nonSibling = fixture(t);
  writeSpec(nonSibling, { links: [sliceLink('SLICE-01'), sliceLink('SLICE-02')] });
  writeNode(nonSibling, nodeMetadata('SLICE-01', { write_scope: [] }));
  writeNode(nonSibling, nodeMetadata('SLICE-01.01', { blocked_by: ['SLICE-02'] }));
  writeNode(nonSibling, nodeMetadata('SLICE-02'));
  writeGateSet(nonSibling, [SPEC_ID, 'SLICE-01', 'SLICE-01.01', 'SLICE-02']);
  expectTreeError(nonSibling, /dependency SLICE-02 must be a sibling/);
});

test('write_scope rejects concurrent overlap but permits transitive sibling ordering', (t) => {
  const conflict = fixture(t);
  writeSpec(conflict, { links: [sliceLink('SLICE-01'), sliceLink('SLICE-02')] });
  writeNode(conflict, nodeMetadata('SLICE-01', { write_scope: ['src/shared'] }));
  writeNode(conflict, nodeMetadata('SLICE-02', { write_scope: ['src/shared/file.js'] }));
  writeGateSet(conflict, [SPEC_ID, 'SLICE-01', 'SLICE-02']);
  expectTreeError(conflict, /concurrent write_scope conflict/);

  const ordered = fixture(t);
  writeSpec(ordered, {
    links: [sliceLink('SLICE-01'), sliceLink('SLICE-02'), sliceLink('SLICE-03')],
  });
  writeNode(ordered, nodeMetadata('SLICE-01', { write_scope: ['src/shared/'] }));
  writeNode(ordered, nodeMetadata('SLICE-02', {
    run_after: ['SLICE-01'],
    write_scope: ['src/independent.js'],
  }));
  writeNode(ordered, nodeMetadata('SLICE-03', {
    blocked_by: ['SLICE-02'],
    write_scope: ['src/shared/deep.js'],
  }));
  writeGateSet(ordered, [SPEC_ID, 'SLICE-01', 'SLICE-02', 'SLICE-03']);
  const result = inspectExecutionTree(ordered);
  assert.deepEqual(result.runnable_leaves, ['SLICE-01']);
});

test('write_scope rejects invalid boundaries, glob metacharacters including !, and duplicates', (t) => {
  const invalidEntries = [
    'C:/absolute.js',
    '/absolute.js',
    '../escape.js',
    'src/./file.js',
    'src//file.js',
    'src\\file.js',
    'src/*.js',
    'src/file?.js',
    'src/[ab].js',
    'src/{a,b}.js',
    'src/!important.js',
  ];
  for (const entry of invalidEntries) {
    const root = fixture(t);
    writeSpec(root, { links: [sliceLink('SLICE-01')] });
    writeNode(root, nodeMetadata('SLICE-01', { write_scope: [entry] }));
    writeGateSet(root, [SPEC_ID, 'SLICE-01']);
    expectTreeError(root, /write_scope/);
  }

  const duplicate = fixture(t);
  writeSpec(duplicate, { links: [sliceLink('SLICE-01')] });
  writeNode(duplicate, nodeMetadata('SLICE-01', {
    write_scope: ['src/file.js', 'src/file.js'],
  }));
  writeGateSet(duplicate, [SPEC_ID, 'SLICE-01']);
  expectTreeError(duplicate, /duplicate write_scope entry/);
});

test('ABANDON is exit-valid terminal state and suppresses every action array', (t) => {
  const rootOnly = fixture(t);
  writeSpec(rootOnly);
  writeGate(rootOnly, SPEC_ID, 'abandoned');
  let result = inspectExecutionTree(rootOnly);
  assert.equal(result.execution_stopped, true);
  assert.deepEqual(result.abandoned_ids, [SPEC_ID]);
  assert.deepEqual(result.runnable_leaves, []);
  assert.deepEqual(result.dispatch_candidates, []);
  assert.deepEqual(result.runnable_slices, []);
  assert.deepEqual(result.completable_branches, []);
  assert.deepEqual(result.review_ready, []);

  const cli = spawnSync(process.execPath, [scriptPath, rootOnly], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).execution_stopped, true);

  const branchStop = fixture(t);
  writeSpec(branchStop, { links: [sliceLink('SLICE-01')] });
  writeNode(branchStop, nodeMetadata('SLICE-01', { write_scope: [] }));
  writeNode(branchStop, nodeMetadata('SLICE-01.01'));
  writeGateSet(branchStop, [SPEC_ID, 'SLICE-01', 'SLICE-01.01'], {
    'SLICE-01': 'abandoned',
  });
  result = inspectExecutionTree(branchStop);
  assert.deepEqual(result.abandoned_ids, ['SLICE-01']);
  assert.deepEqual(result.runnable_leaves, [], 'an abandoned ancestor suppresses descendant work');

  const completedNode = fixture(t);
  writeSpec(completedNode, { links: [sliceLink('SLICE-01')] });
  writeNode(completedNode, nodeMetadata('SLICE-01', { status: 'completed' }));
  writeGateSet(completedNode, [SPEC_ID, 'SLICE-01'], { 'SLICE-01': 'abandoned' });
  expectTreeError(completedNode, /completed node requires all own Gates met/);

  const completedRoot = fixture(t);
  writeSpec(completedRoot, { status: 'completed' });
  writeGate(completedRoot, SPEC_ID, 'abandoned');
  expectTreeError(completedRoot, /completed Spec requires the root Gate to be all met/);
});

test('legacy v1 and v2 artifacts stop with the exact re-slice phrase', (t) => {
  const roots = [];
  for (const version of [1, 2]) {
    const root = fixture(t);
    roots.push(root);
    writeSpec(root, { links: [sliceLink('SLICE-01', `legacy-${version}.md`)] });
    writeNode(root, {
      schema_version: version,
      id: 'SLICE-01',
      spec_id: SPEC_ID,
      spec_revision: SPEC_REVISION,
      title: 'Legacy',
      status: 'pending',
      blocked_by: [],
      ...(version === 2 ? { run_after: [] } : {}),
    }, { fileName: `legacy-${version}.md`, body: 'Legacy body.' });
    assert.throws(
      () => inspectExecutionTree(root),
      (error) => error instanceof ExecutionTreeError
        && error.message === 'explicit re-slice required',
    );
  }

  const cli = spawnSync(process.execPath, [scriptPath, roots[1]], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(cli.status, 2);
  assert.equal(cli.stdout, '');
  assert.equal(cli.stderr, 'explicit re-slice required\n');
});

test('Spec Slices links resolve actual direct files and reject text, deeper, duplicate, or unknown links', (t) => {
  const valid = fixture(t);
  writeSpec(valid, { links: [sliceLink('SLICE-01', 'owned-work.md', { target: './slices/owned-work.md' })] });
  writeNode(valid, nodeMetadata('SLICE-01', { write_scope: [] }), { fileName: 'owned-work.md' });
  writeNode(valid, nodeMetadata('SLICE-01.01'), { fileName: 'nested-work.md' });
  writeGateSet(valid, [SPEC_ID, 'SLICE-01', 'SLICE-01.01']);
  assert.equal(inspectExecutionTree(valid).nodes[0].id, 'SLICE-01');

  const plainText = fixture(t);
  writeSpec(plainText, { body: '# Spec\n\n## Slices\n\nSLICE-01' });
  writeNode(plainText, nodeMetadata('SLICE-01'), { fileName: 'work.md' });
  writeGateSet(plainText, [SPEC_ID, 'SLICE-01']);
  expectTreeError(plainText, /must be an actual Markdown link/);

  const deeper = fixture(t);
  writeSpec(deeper, {
    links: [sliceLink('SLICE-01', 'top.md'), sliceLink('SLICE-01.01', 'deep.md')],
  });
  writeNode(deeper, nodeMetadata('SLICE-01', { write_scope: [] }), { fileName: 'top.md' });
  writeNode(deeper, nodeMetadata('SLICE-01.01'), { fileName: 'deep.md' });
  writeGateSet(deeper, [SPEC_ID, 'SLICE-01', 'SLICE-01.01']);
  expectTreeError(deeper, /deeper Node document/);

  const duplicate = fixture(t);
  writeSpec(duplicate, {
    links: [sliceLink('SLICE-01', 'work.md'), sliceLink('SLICE-01', 'work.md')],
  });
  writeNode(duplicate, nodeMetadata('SLICE-01'), { fileName: 'work.md' });
  writeGateSet(duplicate, [SPEC_ID, 'SLICE-01']);
  expectTreeError(duplicate, /must be linked exactly once/);

  const unknown = fixture(t);
  writeSpec(unknown, { links: [sliceLink('SLICE-01', 'missing.md')] });
  writeNode(unknown, nodeMetadata('SLICE-01'), { fileName: 'actual.md' });
  writeGateSet(unknown, [SPEC_ID, 'SLICE-01']);
  expectTreeError(unknown, /unknown Node document slices\/missing\.md/);

  const misleading = fixture(t);
  writeSpec(misleading, {
    links: [sliceLink('SLICE-99', 'actual.md')],
  });
  writeNode(misleading, nodeMetadata('SLICE-01'), { fileName: 'actual.md' });
  writeGateSet(misleading, [SPEC_ID, 'SLICE-01']);
  expectTreeError(misleading, /contains another Node ID/);
});

test('Node body has exactly four ordered nonempty H2 sections and a live Spec link', (t) => {
  const invalidBodies = [
    {
      body: `${nodeBody()}\n\n## Extra\n\nNo extra H2 is allowed.`,
      pattern: /H2 sections must be exactly/,
    },
    {
      body: [
        '## Spec sections', '', '[Requirement](../SPEC.md#requirements)', '',
        '## Outcome', '', 'Outcome.', '',
        '## Contract', '', 'Contract.', '',
        '## Context', '', 'Context.',
      ].join('\n'),
      pattern: /in that order/,
    },
    {
      body: nodeBody({ Context: '' }),
      pattern: /Context section must be non-empty/,
    },
    {
      body: nodeBody({ 'Spec sections': 'Requirement prose only.' }),
      pattern: /must link to \.\.\/SPEC\.md#<anchor>/,
    },
    {
      body: nodeBody({
        'Spec sections': 'Example only:\n\n```md\n[Requirement](../SPEC.md#requirements)\n```',
      }),
      pattern: /must link to \.\.\/SPEC\.md#<anchor>/,
    },
  ];
  for (const invalid of invalidBodies) {
    const root = fixture(t);
    writeSpec(root, { links: [sliceLink('SLICE-01')] });
    writeNode(root, nodeMetadata('SLICE-01'), { body: invalid.body });
    writeGateSet(root, [SPEC_ID, 'SLICE-01']);
    expectTreeError(root, invalid.pattern);
  }
});

test('completed Node and completed Spec states require bottom-up completion and met Gates', (t) => {
  const childPending = fixture(t);
  writeSpec(childPending, { links: [sliceLink('SLICE-01')] });
  writeNode(childPending, nodeMetadata('SLICE-01', { status: 'completed', write_scope: [] }));
  writeNode(childPending, nodeMetadata('SLICE-01.01'));
  writeGateSet(childPending, [SPEC_ID, 'SLICE-01', 'SLICE-01.01'], {
    'SLICE-01': 'met',
  });
  expectTreeError(childPending, /completed node has incomplete children/);

  const dependencyPending = fixture(t);
  writeSpec(dependencyPending, {
    links: [sliceLink('SLICE-01'), sliceLink('SLICE-02')],
  });
  writeNode(dependencyPending, nodeMetadata('SLICE-01'));
  writeNode(dependencyPending, nodeMetadata('SLICE-02', {
    status: 'completed',
    blocked_by: ['SLICE-01'],
  }));
  writeGateSet(dependencyPending, [SPEC_ID, 'SLICE-01', 'SLICE-02'], {
    'SLICE-02': 'met',
  });
  expectTreeError(dependencyPending, /completed node has incomplete dependencies/);

  const gateUnmet = fixture(t);
  writeSpec(gateUnmet, { links: [sliceLink('SLICE-01')] });
  writeNode(gateUnmet, nodeMetadata('SLICE-01', { status: 'completed' }));
  writeGateSet(gateUnmet, [SPEC_ID, 'SLICE-01'], { 'SLICE-01': 'checked-pending' });
  expectTreeError(gateUnmet, /completed node requires all own Gates met/);

  const completedSpec = fixture(t);
  writeSpec(completedSpec, { status: 'completed', links: [sliceLink('SLICE-01')] });
  writeNode(completedSpec, nodeMetadata('SLICE-01', { status: 'completed' }));
  writeGateSet(completedSpec, [SPEC_ID, 'SLICE-01'], {
    [SPEC_ID]: 'met',
    'SLICE-01': 'met',
  });
  const completed = inspectExecutionTree(completedSpec);
  assert.deepEqual(completed.dispatch_candidates, []);
  assert.deepEqual(completed.runnable_slices, []);
  assert.deepEqual(completed.completable_branches, []);
  assert.deepEqual(completed.review_ready, []);

  const incompleteSpec = fixture(t);
  writeSpec(incompleteSpec, { status: 'completed', links: [sliceLink('SLICE-01')] });
  writeNode(incompleteSpec, nodeMetadata('SLICE-01'));
  writeGateSet(incompleteSpec, [SPEC_ID, 'SLICE-01'], { [SPEC_ID]: 'met' });
  expectTreeError(incompleteSpec, /completed Spec has incomplete direct children/);
});

test('CLI emits JSON on valid input and uses exit 2 for usage and structural errors', (t) => {
  const root = fixture(t);
  writeSpec(root);
  writeGate(root, SPEC_ID);

  const valid = spawnSync(process.execPath, [scriptPath, root], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.stderr, '');
  assert.equal(JSON.parse(valid.stdout).root_id, SPEC_ID);

  const usage = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(usage.status, 2);
  assert.equal(usage.stdout, '');
  assert.equal(usage.stderr, 'Usage: inspect-execution-tree.js <spec-directory>\n');

  writeSpec(root, { status: 'draft' });
  const invalid = spawnSync(process.execPath, [scriptPath, root], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /status must be ready or completed/);
});
