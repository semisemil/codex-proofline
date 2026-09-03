'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('Plan and Spec treat the request as a scope ceiling', () => {
  const plan = read('skills', 'development-plan', 'SKILL.md');
  const spec = read('skills', 'implementation-spec', 'SKILL.md');

  assert.match(plan, /requested outcome and every explicit boundary as the Plan's scope ceiling/);
  assert.match(plan, /Repository evidence constrains delivery; it does not add adjacent features/);
  assert.match(plan, /supporting work only when omitting it would leave a requested result incomplete/);
  assert.match(spec, /requested outcome and explicit boundaries are the maximum product scope/);
  assert.match(spec, /do not authorize adjacent behavior/);
  assert.match(spec, /implementation decision must stay inside the requested result/);
});

test('ordinary implementation details do not become blockers or acceptance scope', () => {
  const preparation = read('skills', 'figure-it-out', 'references', 'preparation-task.md');
  const spec = read('skills', 'implementation-spec', 'SKILL.md');
  const tenet = read('skills', 'tenet-me', 'SKILL.md');

  for (const source of [preparation, spec, tenet]) {
    assert.match(source, /not material merely because/);
    assert.match(source, /narrowest repository-consistent default/);
  }
  assert.match(spec, /compatibility with an existing consumer or authority/);
  assert.match(spec, /implementation decision rather than adding a user requirement or acceptance condition/);
  assert.match(tenet, /do not promote it into a user requirement or acceptance condition/);
  assert.match(preparation, /Leave only material gaps unknown/);
});
