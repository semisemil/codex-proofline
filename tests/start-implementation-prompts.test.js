'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('start-implementation creates the final Worktree owner without a holder role', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  assert.match(skill, /create a Worktree task.*final owner assignment/s);
  assert.match(skill, /prepare-worktree\.js/);
  assert.match(skill, /copies only the active Spec directory/);
  assert.match(skill, /Worktree-local Spec and Gate path/);
  assert.match(skill, /process-local `safe\.directory`/);
  assert.match(skill, /Do not create a holder task/);
  assert.doesNotMatch(skill, /worktree-holder\.md|register-safe-directory\.js|--global/);
  assert.equal(fs.existsSync(path.join(
    repoRoot, 'skills', 'start-implementation', 'references', 'worktree-holder.md',
  )), false);
});

test('roles stay immutable and cross-role work starts without inherited history', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  assert.match(skill, /one immutable execution role/);
  assert.match(skill, /Never send a different `PROOFLINE_EXECUTION_ROLE`/);
  assert.match(skill, /same-directory fork is permitted only.*Branch coordinator.*Branch coordinator/s);
  assert.match(skill, /spawn_agent\(fork_turns: "none"\)/);

  const assignments = ['root-only-implementation.md', 'slice-coordinator.md', 'implementation-task.md', 'reviewer.md'];
  const markers = assignments.map((name) => {
    const content = read('skills', 'start-implementation', 'references', name);
    const found = content.match(/PROOFLINE_EXECUTION_ROLE: [a-z-]+/g) || [];
    assert.equal(found.length, 1, name);
    return found[0];
  });
  assert.equal(new Set(markers).size, 4);
});

test('a Leaf agent implements directly and returns through its agent result', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  const coordinator = read('skills', 'start-implementation', 'references', 'slice-coordinator.md');
  const implementation = read('skills', 'start-implementation', 'references', 'implementation-task.md');

  assert.match(skill, /Leaf assignment is implementation itself/);
  assert.match(coordinator, /direct Leaf gets `implementation-task\.md` directly/);
  assert.match(coordinator, /Leaf agent implements the Leaf itself/);
  assert.match(coordinator, /final result is the Leaf result and needs no callback/);
  assert.match(implementation, /Stage every final product and test path through `prepare-review\.js stage`/);
  assert.match(implementation, /Do not create another task/);
  assert.match(implementation, /send a callback/);
  assert.doesNotMatch(implementation, /spawn_agent|fork_thread|create_thread|wait_agent|send_message_to_thread/);
});

test('Branch and direct review-boundary owners use local control state and minimal callbacks', () => {
  const coordinator = read('skills', 'start-implementation', 'references', 'slice-coordinator.md');
  const direct = read('skills', 'start-implementation', 'references', 'root-only-implementation.md');
  for (const content of [coordinator, direct]) {
    assert.match(content, /prepare-worktree\.js/);
    assert.match(content, /environment_blocked/);
    assert.match(content, /Worktree-local Spec path/);
    assert.match(content, /current Worktree root/);
    assert.match(content, /Do not send fingerprints|send paths, fingerprints/);
  }
  assert.match(coordinator, /same-directory `fork_thread`/);
  assert.match(coordinator, /same-role fork/);
  assert.match(coordinator, /followup_task/);
  assert.match(direct, /spawn_agent\(fork_turns: "none"\)/);
  assert.match(direct, /Keep the root-implementer role/);
});

test('Reviewer reads the diff only through the safe helper', () => {
  const reviewer = read('skills', 'start-implementation', 'references', 'reviewer.md');
  assert.match(reviewer, /PROOFLINE_EXECUTION_ROLE: reviewer/);
  assert.match(reviewer, /prepare-review\.js diff/);
  assert.match(reviewer, /prepare-review\.js diff-range/);
  assert.match(reviewer, /\{\{review_command\}\}/);
  assert.match(reviewer, /process-local Git policy/);
  assert.match(reviewer, /original request and authoritative sources as primary/);
  assert.match(reviewer, /circular oracle/);
  assert.match(reviewer, /Do not run verification/);
  assert.doesNotMatch(reviewer, /git diff --cached/);
});

test('final apply merges validated control state without overwriting definitions', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  assert.match(skill, /--control-fingerprint <captured-control-fingerprint>/);
  assert.match(skill, /merges only monotonic Spec\/Slice status plus Gate check state, evidence/);
  assert.match(skill, /never overwrites Spec requirements, Gate definitions, Slice structure/);
  assert.match(skill, /Any validation or write failure rolls back/);
  assert.match(skill, /sync-control-state\.js/);
  assert.match(skill, /integrate-reviewed\.js/);
  assert.match(skill, /finalize --mode single-root/);
  assert.match(skill, /finalize --mode multi-root/);
  assert.match(skill, /finalize-review-pass/);
});

test('the source skill root does not contain the removed authoring instruction file', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'AGENTS.md')), false);
});
