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

test('a Leaf work-packet agent implements directly and reports once', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  const coordinator = read('skills', 'start-implementation', 'references', 'slice-coordinator.md');
  const implementation = read('skills', 'start-implementation', 'references', 'implementation-task.md');

  assert.match(skill, /Leaf packet is implementation itself/);
  assert.match(skill, /Never default to one agent per Leaf/);
  assert.match(coordinator, /fewest reliable work packets/);
  assert.match(coordinator, /Never default to one agent per Leaf/);
  assert.match(coordinator, /one terminal envelope/);
  assert.match(coordinator, /close-batch/);
  assert.match(implementation, /one or more direct sibling Leaves/);
  assert.match(implementation, /complete packet in one continuous pass/);
  assert.match(implementation, /Do not stop or report between Leaves/);
  assert.match(implementation, /Stage every final product and test path through `node .*prepare-review\.js stage/);
  assert.match(implementation, /completed=<node-id>,<node-id>/);
  assert.match(implementation, /failed=<node-id>: <exact blocker>/);
  assert.match(implementation, /Do not create another task/);
  assert.match(implementation, /send a task callback/);
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
  assert.match(direct, /boundary, Gate, and exact `Reviewer route` file together once/);
  assert.match(direct, /Do not enumerate its directory or reread unchanged content/);
});

test('Leaf cohorts close atomically and direct roots repair from the Gate result', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  const coordinator = read('skills', 'start-implementation', 'references', 'slice-coordinator.md');
  const direct = read('skills', 'start-implementation', 'references', 'root-only-implementation.md');

  assert.match(skill, /changes every Leaf status atomically only when all Gates pass/);
  assert.match(coordinator, /Do not close a cohort until every mutating descendant task.*terminated/);
  assert.match(coordinator, /every current Leaf status stays pending/);
  assert.match(coordinator, /completed Leaf Gates whose write scopes overlap.*completed ancestor Gates/);
  assert.match(coordinator, /revalidated predecessor failure to the current cohort owner first/);
  assert.match(coordinator, /rerun the whole cohort once after Repairs settle/);
  assert.match(direct, /Do not run a Gate, local feedback, or any direct test/);
  assert.match(direct, /transient diagnostics before any additional read/);
  assert.match(direct, /never terminate and restart a still-running `close`/);
});

test('model routing avoids automatic high effort for repository breadth', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  const routing = read('skills', 'start-implementation', 'assets', 'model-routing.md');
  assert.match(skill, /Use `low` reasoning for Preparation, Slice coordinators, and Reviewers/);
  assert.match(skill, /use `medium` for Implementation and Repair/);
  assert.match(skill, /Repository breadth alone never raises effort/);
  assert.match(skill, /evidenced unclear root cause/);
  assert.match(routing, /canonical routing contract is in `\.\.\/SKILL\.md`/);
  assert.doesNotMatch(skill + routing, /gpt-5\./);
});

test('capture output replaces coordinator rediscovery and fresh Preparation scope is reused', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  assert.match(skill, /scope=verified-to-original-request/);
  assert.match(skill, /direct `start-implementation` call must read the Spec once/);
  assert.match(skill, /dispatch descriptor/);
  assert.match(skill, /valid only with its embedded control fingerprint/);
  assert.match(skill, /do not scan the Spec directory to rediscover/);
});

test('task children callback their parent on every terminal path before ending', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  const coordinator = read('skills', 'start-implementation', 'references', 'slice-coordinator.md');
  const direct = read('skills', 'start-implementation', 'references', 'root-only-implementation.md');

  assert.match(skill, /exactly one accepted terminal callback/);
  assert.match(skill, /final response is not parent transport/);
  assert.match(skill, /assigning parent alone owns the user-facing result/);
  assert.match(skill, /state=completed/);
  assert.match(skill, /state=reviewed/);
  assert.match(skill, /state=failed\|environment_blocked\|need_confirm/);
  for (const content of [coordinator, direct]) {
    assert.match(content, /Every terminal path must produce exactly one accepted `send_message_to_thread` callback/);
    assert.match(content, /A final response is not that callback/);
    assert.match(content, /state=failed/);
    assert.match(content, /state=need_confirm/);
  }
  assert.match(coordinator, /state=environment_blocked/);
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
  assert.match(reviewer, /not a user-facing report or task callback/);
  assert.doesNotMatch(reviewer, /git diff --cached/);
});

test('original request stays delimited and Reviewer prompts never become files', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  const assignments = ['root-only-implementation.md', 'slice-coordinator.md', 'reviewer.md'];
  for (const name of assignments) {
    const content = read('skills', 'start-implementation', 'references', name);
    assert.match(content, /<BEGIN_ORIGINAL_REQUEST>[\s\S]*\{\{original_request\}\}[\s\S]*<END_ORIGINAL_REQUEST>/);
  }
  assert.match(skill, /only in memory as the `spawn_agent` message/);
  assert.match(skill, /never write a Reviewer prompt or manifest/);
  assert.match(read('skills', 'start-implementation', 'references', 'root-only-implementation.md'), /never create a Reviewer prompt or manifest file/);
});

test('final apply merges validated control state without overwriting definitions', () => {
  const skill = read('skills', 'start-implementation', 'SKILL.md');
  assert.match(skill, /--control-fingerprint <captured-control-fingerprint>/);
  assert.match(skill, /merges only monotonic Slice status plus Gate state and evidence, then completes the original Spec/);
  assert.match(skill, /never overwrites Spec requirements, Gate definitions, Slice structure/);
  assert.match(skill, /Any validation or write failure rolls back/);
  assert.match(skill, /sync-control-state\.js/);
  assert.match(skill, /integrate-reviewed\.js/);
  assert.match(skill, /finalize --mode single-root/);
  assert.match(skill, /finalize --mode multi-root/);
  assert.match(skill, /finalize-review-pass/);
  assert.match(skill, /never returns the reviewed owner to `close` or `review-pass`/);
});

test('the source skill root does not contain the removed authoring instruction file', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'AGENTS.md')), false);
});
