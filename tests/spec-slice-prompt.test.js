'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const contract = fs.readFileSync(
  path.join(repoRoot, 'skills', 'spec-slice', 'references', 'execution-tree.md'),
  'utf8',
);

test('Spec Slice uses the fewest reliable execution Nodes', () => {
  assert.match(
    contract,
    /Use the fewest Nodes that keep implementation, repair ownership, and proof reliable/,
  );
  assert.match(contract, /Root-only is valid when one task can deliver the whole outcome/);
  assert.match(contract, /enough to pay its task, callback, and Gate cost/);
  assert.match(contract, /stop at the first reliable one-pass boundary/);
});

test('Spec Slice keeps outcome decomposition distinct from mechanical splitting', () => {
  assert.match(contract, /An independent sub-goal is a meaningful outcome/);
  assert.match(contract, /not a file, layer, technology, component, test category/);
  assert.match(contract, /group dependent sub-goals that must compose into one end-to-end result under one direct Slice/);
  assert.match(contract, /apply the absent-sibling test/);
  assert.match(contract, /if every sibling implementation is omitted/);
  assert.match(contract, /interface, schema, generated artifact, or implementation contract created by the blocker/);
});

test('Spec Slice assigns executable proof without duplicating checks across the tree', () => {
  assert.match(contract, /Map the Spec's fixed completion set once/);
  assert.match(contract, /JSON array containing one executable and its arguments/);
  assert.match(contract, /without equivalent combinations or unchanged behavior/);
  assert.match(contract, /lowest boundary whose completed subtree contains every prerequisite/);
  assert.match(contract, /one direct Slice owns every prerequisite/);
  assert.match(contract, /Combine compatible conditions/);
  assert.match(contract, /do not substitute for a behavior-running check when one exists/);
  assert.match(contract, /Generated-artifact drift is checked only when contractual/);
  assert.match(contract, /An ancestor never repeats a descendant `CHECK`/);
  assert.match(contract, /Reuse it through staging, review, commit, and unchanged transport/);
  assert.match(contract, /Review cannot add tests beyond the fixed completion set/);
  assert.match(contract, /complete Gate set is exactly the Spec's fixed completion set/);
  assert.match(contract, /CHECK: NONE/);
  assert.match(contract, /JSON-array checks reject shell strings, chaining, pipes, redirection, and command substitution/);
  assert.match(contract, /Do not invent a test, build, lint, or type check/);
  assert.doesNotMatch(contract, /Scale: quick|verification units|CLASS: none/);
});

test('Spec Slice permits only contract-fixed file requirements with one Gate owner', () => {
  assert.match(contract, /appears literally in the Spec body or its fixed verification command/);
  assert.match(contract, /Assign each path to one Gate only/);
  assert.match(contract, /Directories, discovered repository boundaries, inferred output files, and duplicate ownership are invalid/);
  assert.match(contract, /does not fix its exact file path, omit `REQUIRES`/);
});

test('Spec Slice leaves completion validation to coordinator close', () => {
  assert.match(contract, /`coordinator-state close` runs the fixed Gate set once/);
  assert.doesNotMatch(contract, /run-gates\.js feedback/);
});
