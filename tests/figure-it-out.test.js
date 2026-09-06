const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('figure-it-out hands a ready Spec to the launcher without owning implementation', () => {
  const skill = read('skills', 'figure-it-out', 'SKILL.md');
  const preparation = read('skills', 'figure-it-out', 'references', 'preparation-task.md');

  assert.match(skill, /Run from the earliest incomplete applicable stage/);
  assert.match(skill, /hands the ready Spec to a new implementation session/);
  assert.match(skill, /If preparation remains/);
  assert.match(skill, /directly in this session using the current request and existing context/);
  assert.match(skill, /Preserve every explicit output, identifier, path, command, number, and example/);
  assert.match(skill, /Keep the current model and reasoning/);
  assert.match(skill, /model routing does not apply to preparation/);
  assert.doesNotMatch(skill, /spawn_agent|Preparation agent|delimited authority block/);
  assert.match(skill, /prepared or already ready Spec/);
  assert.match(skill, /create the new implementation session in the current project folder/);
  assert.match(skill, /without waiting for implementation results/);
  assert.match(skill, /Resolve facts from evidence\. Ask only for unresolved material decisions, then resume/);
  assert.doesNotMatch(skill, /model-routing\.md|thin top coordinator|create_thread|fork_thread/);

  assert.match(preparation, /directly in the invoking session and project folder/);
  assert.match(preparation, /Reuse the request and evidence already in context/);
  assert.doesNotMatch(preparation, /PROOFLINE_EXECUTION_ROLE|\{\{original_request\}\}|parent-delivered/);
  assert.match(preparation, /implementation-spec\/SKILL\.md.*implementation-spec\/assets\/templates\/spec\.md.*one batched read/);
  assert.match(preparation, /Reuse it unless a source changes/);
  assert.match(preparation, /capped at 4,000 tokens/);
  assert.match(preparation, /Use documented helper commands directly/);
  assert.match(preparation, /inspect helper source only after an actual helper error/);
  assert.match(preparation, /Source result-changing behavior/);
  assert.match(preparation, /do not fill gaps/);
  assert.match(preparation, /Leave only material gaps unknown/);
  assert.match(preparation, /without renaming or paraphrasing it away/);
  assert.match(preparation, /only if the Spec would otherwise invent/);
  assert.match(preparation, /Produce one authoritative Spec/);
  assert.match(preparation, /scope is verified against the original request/);
  assert.match(preparation, /No implementation, parallel assignments, or execution artifact generation/);
  assert.doesNotMatch(preparation, /spec-slice\/|tree readiness|Node and Gate|create-gates\.js/);
});

test('owned stages return to figure-it-out while standalone calls keep their boundaries', () => {
  const plan = read('skills', 'development-plan', 'SKILL.md');
  const spec = read('skills', 'implementation-spec', 'SKILL.md');
  const tenet = read('skills', 'tenet-me', 'SKILL.md');

  assert.match(plan, /figure-it-out\/SKILL\.md` owns the explicit user request/);
  assert.match(plan, /otherwise report it and leave review, specification, slicing, and implementation to separate user requests/);
  assert.match(spec, /implementation requires a separate user request unless `\.\.\/figure-it-out\/SKILL\.md` owns the explicit request/);
  assert.match(tenet, /explicitly invokes \$tenet-me or \$figure-it-out owns the explicit workflow/);
  assert.match(tenet, /return the final result to it for the next revision or stage/);
  assert.match(spec, /named algorithm, policy, standard, format/);
  assert.match(spec, /derived from the candidate implementation cannot independently decide/);
  assert.match(tenet, /unversioned algorithm or policy name as non-authoritative/);
  assert.match(tenet, /derived from the candidate implementation as circular/);
});

test('figure-it-out is explicit-only and exposed by the plugin', () => {
  const metadata = read('skills', 'figure-it-out', 'agents', 'openai.yaml');
  const readme = read('README.md');
  const manifest = JSON.parse(read('.codex-plugin', 'plugin.json'));

  assert.match(metadata, /default_prompt: "Use \$figure-it-out/);
  assert.match(metadata, /allow_implicit_invocation: false/);
  assert.match(readme, /\$proofline:figure-it-out/);
  assert.ok(manifest.interface.defaultPrompt.length <= 3);
  assert.ok(manifest.interface.defaultPrompt.every((prompt) => prompt.length <= 128));
  assert.ok(manifest.interface.defaultPrompt.some((prompt) => prompt.startsWith('$proofline:figure-it-out')));
});
