const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('figure-it-out is a compact linked workflow without copied stage contracts', () => {
  const skill = read('skills', 'figure-it-out', 'SKILL.md');
  const preparation = read(
    'skills', 'figure-it-out', 'references', 'preparation-task.md',
  );

  assert.match(skill, /Run from the earliest incomplete applicable stage/);
  assert.match(skill, /thin top coordinator/);
  assert.match(skill, /references\/preparation-task\.md/);
  assert.match(skill, /spawn_agent\(task_name: "preparation", fork_turns: "none"\)/);
  assert.doesNotMatch(skill, /model:|reasoning_effort:/);
  assert.match(skill, /wait only for it/);
  assert.match(skill, /Retain only returned artifact links, revision, readiness/);
  assert.match(skill, /run \[\$start-implementation\]\(\.\.\/start-implementation\/SKILL\.md\)/);
  assert.match(skill, /This invoking task is its top coordinator/);
  assert.match(skill, /This invocation owns the full chain/);
  assert.match(skill, /Resolve facts from evidence\. Ask only for unresolved material decisions, then resume/);

  assert.match(preparation, /\{\{skill_root\}\}/);
  assert.doesNotMatch(
    preparation,
    /development_plan_skill|tenet_skill|implementation_spec_skill|spec_slice_skill/,
  );

  assert.ok(skill.split(/\r?\n/).length <= 15);
  const renderedPrompt = preparation.match(/```text\r?\n([\s\S]*?)\r?\n```/)[1];
  assert.doesNotMatch(renderedPrompt, /AGENTS\.md|system, developer, project/);
  assert.match(preparation, /Batch narrow evidence/);
  assert.match(preparation, /^PROOFLINE_EXECUTION_ROLE: preparation$/m);
  assert.match(preparation, /Execute in/);
  assert.match(preparation, /do not invoke `figure-it-out` or another agent/);
  assert.match(preparation, /cap output at 4,000 tokens/);
  assert.match(preparation, /reuse it until its source changes/);
  assert.match(preparation, /Use documented helpers/);
  assert.match(preparation, /inspect source only after failure/);
  assert.match(preparation, /Load only its `SKILL\.md` and triggered references/);
  assert.match(preparation, /Source result-changing behavior/);
  assert.match(preparation, /do not fill gaps/);
  assert.match(preparation, /Leave only material gaps unknown/);
  assert.match(preparation, /instead of guessing/);
  assert.match(preparation, /only if the Spec would otherwise invent/);
  assert.match(preparation, /produce one authoritative Spec/);
  assert.doesNotMatch(preparation, /compact authoritative Spec/);
  assert.match(preparation, /After the Spec, load `<skill-root>\/tenet-me\/SKILL\.md`/);
  assert.match(preparation, /Once ready, load `<skill-root>\/spec-slice\/SKILL\.md`/);
  assert.match(preparation, /fewest reliable Nodes/);
  assert.match(preparation, /No implementation/);
  assert.ok(preparation.length <= 1700);
  assert.doesNotMatch(skill, /## Authority|## Stage contracts|## Stop|Implementation Gate|cherry-pick|run_after|blocked_by/);
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
