'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, 'skills/spec-slice', file), 'utf8');
const skill = read('SKILL.md');
const contract = read('references/parallel-plan.md');

test('Spec Slice is optional and requires a concrete independent parallel benefit', () => {
  assert.match(skill, /ready Spec can proceed directly to implementation/);
  assert.match(contract, /independent work can proceed alongside the main implementer's own task/);
  assert.match(contract, /coherent Spec result with clear change boundaries and available interfaces/);
  assert.match(contract, /neither file count nor a target agent count establishes independence/);
  assert.match(contract, /main session should implement directly and create no plan/);
});

test('flat assignments preserve authoritative scope and do not invent another execution tree', () => {
  assert.match(skill, /one `PARALLEL.md` in the same directory as `SPEC.md`/);
  assert.match(skill, /including the main implementer's work/);
  assert.match(skill, /Keep assignments flat and write ownership non-conflicting/);
  assert.match(contract, /not another source of product requirements/);
  assert.match(contract, /no recursive Nodes, parent\/child execution states, or per-task Gate files/);
  assert.match(contract, /subject to the Spec and user-required verification/);
  assert.doesNotMatch(skill + contract, /inspect-execution-tree\.js|run-gates\.js|create-gates\.js|coordinator-state|schema_version/);
});

test('planning exposes dependent work and stops before execution', () => {
  assert.match(contract, /concurrent write scopes do not overlap/);
  assert.match(contract, /requires another's unfinished design or changes/);
  assert.match(contract, /handles that dependency sequentially or revises the split before dispatch/);
  assert.match(skill, /Planning ends before implementation, project verification, review, or agent dispatch/);
  assert.match(skill, /Preserve existing documents and records/);
  assert.match(skill, /resuming or converting a legacy execution is outside/);
});
