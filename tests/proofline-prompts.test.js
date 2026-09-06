'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { MODE_SLOT } = require('../hooks/proofline-prompt.js');

const repoRoot = path.resolve(__dirname, '..');

test('the shared prompt has one mode slot and all mode components exist', () => {
  const skillPath = path.join(repoRoot, 'skills', 'proofline', 'SKILL.md');
  const baseline = fs.readFileSync(skillPath, 'utf8');
  assert.equal(baseline.split(MODE_SLOT).length - 1, 1);

  for (const mode of ['normal', 'focus', 'core']) {
    const modePath = path.join(repoRoot, 'skills', 'proofline', `${mode}.md`);
    assert.ok(fs.statSync(modePath).isFile(), mode);
    assert.ok(fs.statSync(modePath).size > 0, mode);
  }
});

test('hook registration keeps lifecycle boundaries and removes legacy owners', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hooks', 'hooks.json'), 'utf8')).hooks;
  const loader = hooks.SessionStart.find((entry) => entry.hooks.some((hook) => (
    hook.command.includes('load-proofline.js')
  )));
  const subagentLoader = hooks.SubagentStart.find((entry) => entry.hooks.some((hook) => (
    hook.command.includes('load-proofline.js')
  )));
  const modeHook = hooks.UserPromptSubmit[0].hooks[0];
  const numberHook = hooks.UserPromptSubmit[0].hooks[1];

  assert.equal(loader.matcher, 'startup|clear|compact');
  assert.ok(subagentLoader);
  assert.equal(subagentLoader.matcher, undefined);
  assert.match(modeHook.command, /proofline-mode\.js/);
  assert.match(numberHook.command, /next-document-number\.js/);
  assert.equal(hooks.SessionEnd, undefined);
  assert.equal(fs.existsSync(path.join(repoRoot, 'hooks', 'load-baseline.js')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'proofline-baseline-quality')), false);
});
