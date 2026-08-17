const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('figure-it-out is a compact linked workflow without copied stage contracts', () => {
  const skill = read('skills', 'figure-it-out', 'SKILL.md');

  assert.match(skill, /Run from the earliest incomplete applicable stage/);
  assert.match(skill, /Optional Plan\. If a ready Spec would require inventing the problem, intended outcome, scope, direction, or material tradeoffs/);
  assert.match(skill, /development-plan[\s\S]*tenet-me[\s\S]*Plan is `ready` and Tenet finds no material unresolved outcome path/);
  assert.match(skill, /implementation-spec[\s\S]*tenet-me[\s\S]*Spec `ready`/);
  assert.match(skill, /spec-slice[\s\S]*start-implementation/);
  assert.match(skill, /Revise from findings and rerun Tenet/);
  assert.match(skill, /This invocation owns the full chain/);
  assert.match(skill, /Resolve facts from evidence\. Ask only for unresolved material decisions, then resume/);

  for (const stage of [
    'development-plan',
    'tenet-me',
    'implementation-spec',
    'spec-slice',
    'start-implementation',
  ]) {
    assert.match(skill, new RegExp(`\\[\\$${stage}\\]\\(\\.\\.\\/${stage}\\/SKILL\\.md\\)`));
  }

  assert.ok(skill.split(/\r?\n/).length <= 15);
  assert.doesNotMatch(skill, /## Authority|## Stage contracts|## Stop|Implementation Gate|wait_agent|cherry-pick|run_after|blocked_by/);
});

test('owned stages return to figure-it-out while standalone calls keep their boundaries', () => {
  const plan = read('skills', 'development-plan', 'SKILL.md');
  const spec = read('skills', 'implementation-spec', 'SKILL.md');
  const tenet = read('skills', 'tenet-me', 'SKILL.md');
  const slice = read('skills', 'spec-slice', 'SKILL.md');

  assert.match(plan, /figure-it-out\/SKILL\.md` owns the explicit user request/);
  assert.match(plan, /otherwise report it and leave review, specification, slicing, and implementation to separate user requests/);
  assert.match(spec, /implementation requires a separate user request unless `\.\.\/figure-it-out\/SKILL\.md` owns the explicit request/);
  assert.match(tenet, /explicitly invokes \$tenet-me or \$figure-it-out owns the explicit workflow/);
  assert.match(tenet, /return the final result to it for the next revision or stage/);
  assert.match(slice, /return the result to `\.\.\/figure-it-out\/SKILL\.md` when it owns the explicit workflow/);
});

test('figure-it-out is explicit-only and exposed by the plugin', () => {
  const metadata = read('skills', 'figure-it-out', 'agents', 'openai.yaml');
  const readme = read('README.md');
  const manifest = JSON.parse(read('.codex-plugin', 'plugin.json'));

  assert.match(metadata, /default_prompt: "Use \$figure-it-out/);
  assert.match(metadata, /allow_implicit_invocation: false/);
  assert.match(readme, /\$proofline:figure-it-out/);
  assert.ok(manifest.interface.defaultPrompt.some((prompt) => prompt.startsWith('$proofline:figure-it-out')));
});
