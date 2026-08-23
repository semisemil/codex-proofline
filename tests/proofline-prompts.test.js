const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('the common skill contains only the preserved baseline contract', () => {
  const skill = read('skills', 'proofline', 'SKILL.md');
  const body = skill.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  assert.match(skill, /name: proofline/);
  assert.match(body, /Apply rules within: explicit task, requested output, authorized target, and scope/);
  assert.match(body, /## Language and compression/);
  assert.match(body, /## Truth, authority, and ambiguity/);
  assert.match(body, /## Review and evidence/);
  assert.match(body, /## UI text and information design/);
  assert.match(body, /## Code/);
  assert.doesNotMatch(body, /Focus response mode|Caveman response mode|\$proofline|defaultMode|session_id/);
});

test('mode prompts are private frontmatter-free components with distinct contracts', () => {
  const normal = read('skills', 'proofline', 'normal.md');
  const focus = read('skills', 'proofline', 'focus.md');
  const caveman = read('skills', 'proofline', 'caveman.md');

  for (const prompt of [normal, focus, caveman]) {
    assert.doesNotMatch(prompt, /^---/);
    assert.doesNotMatch(prompt, /defaultMode|session_id|\$proofline/);
  }
  assert.match(normal, /normal conversational response style/);
  assert.match(normal, /Replace and ignore previous Proofline focus or caveman/);
  assert.doesNotMatch(normal, /next action|numbered steps|ultra-compressed/);

  assert.match(focus, /Start with the conclusion or the next action/);
  assert.match(focus, /numbered steps only for multi-step work with a real execution order/);
  assert.match(focus, /Show brief progress state only when needed/);
  assert.match(focus, /Limit a list to five items/);
  assert.doesNotMatch(focus, /within two minutes|same debugging failure|greetings, preambles|State completion and errors|Keep explanations, safety checks/);

  assert.match(caveman, /ultra-compressed responses with the conclusion first/);
  assert.match(caveman, /technical accuracy, code, API names, CLI commands, exact errors, negation, exceptions, numbers, and units/);
  assert.doesNotMatch(caveman, /technical terms/);
  assert.match(caveman, /Do not invent abbreviations, causal arrows, decorative tables, or emoji/);
  assert.match(caveman, /complete sentences when fragments would obscure safety, irreversible consequences, execution order, or requested clarification/);
  assert.match(caveman, /Resume ultra-compressed expression after the clarity exception/);
  assert.doesNotMatch(caveman, /Keep the user's primary language|mention yourself|preview tool calls|asks to explain again or repeats/);
});

test('hook registration keeps lifecycle boundaries and removes legacy owners', () => {
  const hooks = JSON.parse(read('hooks', 'hooks.json')).hooks;
  const loader = hooks.SessionStart.find((entry) => entry.hooks.some((hook) => (
    hook.command.includes('load-proofline.js')
  )));
  const modeHook = hooks.UserPromptSubmit[0].hooks[0];
  const numberHook = hooks.UserPromptSubmit[0].hooks[1];

  assert.equal(loader.matcher, 'startup|clear|compact');
  assert.doesNotMatch(loader.matcher, /resume/);
  assert.match(modeHook.command, /proofline-mode\.js/);
  assert.match(numberHook.command, /next-document-number\.js/);
  assert.equal(hooks.SessionEnd, undefined);
  assert.equal(fs.existsSync(path.join(repoRoot, 'hooks', 'load-baseline.js')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'proofline-baseline-quality')), false);
  assert.match(read('skills', 'issue-ledger', 'SKILL.md'), /\.\.\/proofline\/SKILL\.md/);
});
