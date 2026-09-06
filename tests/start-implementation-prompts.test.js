'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const launcher = read('skills/start-implementation/SKILL.md');
const skill = read('skills/implement/SKILL.md');

test('launcher dispatches one local Spec-only task and stops', () => {
  for (const pattern of [/explicit `local` environment/, /JSON unchanged to `create_thread` once/, /exactly `\$proofline:implement <SPEC-ID>` on one line/, /Do not wait for implementation results/, /explicit user model choice/, /uncertain result is not a reason to create a duplicate/]) assert.match(launcher, pattern);
  assert.doesNotMatch(launcher, /spawn_agent|implementation-state|review-input/);
  for (const name of ['start-implementation', 'implement']) assert.match(read(`skills/${name}/agents/openai.yaml`), /allow_implicit_invocation: false/);
});

test('implementation preserves existing work and verifies the ready Spec', () => {
  for (const pattern of [/unique ready/, /current model and reasoning/, /staged, unstaged and untracked changes before editing/, /Preserve them/, /including user-required tests/, /rerun affected checks after edits/, /all Spec conditions are met/]) assert.match(skill, pattern);
});

test('parallel workers share routing and have bounded nonrecursive assignments', () => {
  for (const pattern of [/spawn_agent\(fork_turns: "none"\)/, /PROOFLINE_EXECUTION_ROLE: parallel-implementer/, /owned files\/interfaces and required checks/, /do not delegate or complete the Spec/, /non-overlapping and dependent work sequential/, /collect and integrate results/, /End a worker's writes before replacing it/]) assert.match(skill, pattern);
  assert.match(launcher, /assets\/model-routing.md/);
  assert.match(skill, /\.\.\/start-implementation\/assets\/model-routing.md/);
  assert.match(read('skills/start-implementation/assets/model-routing.md'), /Explicit user model, reasoning, and usage limits take precedence/);
});

test('initial review is independent and corrections return to the same reviewer', () => {
  const reviewer = skill.match(/```text\n([\s\S]*?)\n```/)[1];
  assert.deepEqual([...reviewer.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]), ['spec_path', 'this_run_changes', 'verification_results']);
  for (const pattern of [/PROOFLINE_EXECUTION_ROLE: reviewer/, /do not edit, run tests or delegate/, /fail only for a valid in-scope defect/]) assert.match(reviewer, pattern);
  for (const pattern of [/main session's actual model and reasoning/, /For the initial review/, /without implementation conversation or self-assessment/, /Resume the same reviewer with `followup_task`/, /verify resolution of its findings/, /corrections for regressions or unmet Spec requirements/, /reusing prior review context for unchanged code/, /Keep its role and read-only constraints unchanged/, /no valid finding remains on the final reviewed state/]) assert.match(skill, pattern);
});

test('completion uses the existing document writer without additional execution records', () => {
  assert.match(skill, /status to `completed`, preserving its body, identity and revision/);
  assert.match(skill, /document-writer\.js write --kind spec.*--change-kind operational/);
  assert.match(skill, /complete updated Markdown on stdin/);
  const links = [...skill.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]);
  assert.deepEqual(links, ['../start-implementation/assets/model-routing.md']);
  for (const relative of links) assert.ok(fs.existsSync(path.join(root, 'skills/implement', relative)));
  assert.doesNotMatch(skill, /implementation-state|review-input|fingerprint|PARALLEL\.md/);
});
