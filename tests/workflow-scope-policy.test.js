'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('Plan and downstream review preserve the requested scope and identifiers', () => {
  const plan = read('skills', 'development-plan', 'SKILL.md');
  const slice = read('skills', 'spec-slice', 'SKILL.md');
  const tenet = read('skills', 'tenet-me', 'SKILL.md');

  assert.match(plan, /requested outcome and every explicit boundary as the Plan's scope ceiling/);
  assert.match(plan, /Repository evidence constrains delivery; it does not add adjacent features/);
  assert.match(plan, /supporting work only when omitting it would leave a requested result incomplete/);
  assert.match(plan, /identifiers, output field names, paths, commands, quantities, and examples/);
  assert.match(plan, /do not generalize, translate, or rename/);
  assert.match(slice, /without renaming its identifiers, output fields, paths, commands, or quantities/);
  assert.match(tenet, /omission, translation, or renaming breaks that edge/);
});

test('ordinary implementation details do not become blockers or acceptance scope', () => {
  const preparation = read('skills', 'figure-it-out', 'references', 'preparation-task.md');
  const tenet = read('skills', 'tenet-me', 'SKILL.md');

  for (const source of [preparation, tenet]) {
    assert.match(source, /not material merely because/);
    assert.match(source, /narrowest repository-consistent default/);
  }
  assert.match(tenet, /do not promote it into a user requirement or acceptance condition/);
  assert.match(preparation, /Leave only material gaps unknown/);
});
