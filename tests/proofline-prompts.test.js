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
  assert.match(focus, /within two minutes/);
  assert.match(focus, /Limit a list to five items/);
  assert.match(focus, /omit greetings, preambles, restated questions, closing recaps/);
  assert.match(focus, /Keep explanations, safety checks, and clarification required by genuine ambiguity/);
  assert.match(focus, /same debugging failure repeats for three turns/);

  assert.match(caveman, /ultra-compressed responses with the conclusion first/);
  assert.match(caveman, /technical terms, code, API names, CLI commands, exact errors, negation, exceptions, numbers, and units/);
  assert.match(caveman, /do not invent abbreviations, causal arrows, decorative tables, or emoji/);
  assert.match(caveman, /Keep the user's primary language/);
  assert.match(caveman, /security warnings, confirmation of irreversible actions, multi-step procedures/);
  assert.match(caveman, /asks to explain again or repeats/);
  assert.match(caveman, /Resume ultra-compressed expression after the clarity exception/);
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
