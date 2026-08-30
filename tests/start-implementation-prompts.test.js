'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('start-implementation keeps top coordination in the entrypoint and child work in assignments', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');

  for (const assignment of [
    'worktree-holder.md',
    'root-only-implementation.md',
    'slice-coordinator.md',
    'implementation-task.md',
    'reviewer.md',
  ]) {
    assert.equal((skill.match(new RegExp(`references/${assignment}`, 'g')) || []).length, 1);
  }

  assert.match(skill, /top coordinator/);
  assert.match(skill, /owns no execution Node, implementation, Repair, or review/);
  assert.match(skill, /fork_thread\(threadId:/);
  assert.doesNotMatch(skill, /fork_thread\(thread_id:/);
  assert.match(skill, /For two or more direct Root Slices/);
  assert.match(skill, /## Recursive tasks/);
  assert.match(skill, /## Leaf implementation/);
  assert.match(skill, /## Close and review a Slice/);
  assert.match(skill, /For root-only, the task forked from the holder implements the Spec directly/);
  assert.ok(skill.length <= 12000);
});

test('the source skill root does not contain the removed authoring instruction file', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'AGENTS.md')), false);
});

test('Slice coordinator assignments own subtree execution but not integration review', () => {
  const coordinator = read(
    'skills', 'start-implementation', 'references', 'slice-coordinator.md',
  );

  assert.match(coordinator, /PROOFLINE_EXECUTION_ROLE: slice-coordinator/);
  assert.match(coordinator, /<spec-directory>/);
  assert.match(coordinator, /<boundary-id>/);
  assert.match(coordinator, /fork_thread\(environment: \{ type: "same-directory" \}\)/);
  assert.match(coordinator, /spawn_agent\(fork_turns: "none"\)/);
  assert.match(coordinator, /wait only for it/);
  assert.match(coordinator, /Repair reuses the owning task/);
  assert.match(coordinator, /Callback its compact result and end/);
  assert.doesNotMatch(coordinator, /repair-task|review_snapshot\.review_command|thread_id|create_thread|wait_threads/);
});

test('implementation, root-only, and review assignments keep their fixed boundaries', () => {
  const implementation = read(
    'skills', 'start-implementation', 'references', 'implementation-task.md',
  );
  const rootImplementation = read(
    'skills', 'start-implementation', 'references', 'root-only-implementation.md',
  );
  const reviewer = read('skills', 'start-implementation', 'references', 'reviewer.md');

  assert.match(implementation, /PROOFLINE_EXECUTION_ROLE: implementer/);
  assert.match(implementation, /Stage exact product and test paths/);
  assert.match(implementation, /without a destination ID/);
  assert.doesNotMatch(implementation, /fewest coherent tool calls|longest blocking interval/);
  assert.doesNotMatch(implementation, /spawn_agent|fork_thread|create_thread|wait_agent|wait_threads/);

  assert.match(rootImplementation, /PROOFLINE_EXECUTION_ROLE: root-implementer/);
  assert.doesNotMatch(rootImplementation, /Spec directory:|Spec ID:/);
  assert.match(rootImplementation, /coordinator-state\.js close/);
  assert.match(rootImplementation, /coordinator-state\.js review-pass/);
  assert.match(rootImplementation, /spawn_agent\(fork_turns: "none"\)/);
  assert.match(rootImplementation, /repair only blocking findings within this Spec/);
  assert.doesNotMatch(rootImplementation, /fewest coherent tool calls|longest blocking interval/);
  assert.match(rootImplementation, /without a destination ID/);
  assert.doesNotMatch(rootImplementation, /fork_thread|create_thread|wait_threads|repair-task|review_snapshot\.review_command/);

  assert.match(reviewer, /PROOFLINE_EXECUTION_ROLE: reviewer/);
  assert.match(reviewer, /git diff --cached --unified=3/);
  assert.match(reviewer, /run no verification/);
  assert.doesNotMatch(reviewer, /fork_thread|create_thread|send_message_to_thread|wait_/);
});
