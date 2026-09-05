'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
const launcher = read('skills', 'start-implementation', 'SKILL.md');
const skill = read('skills', 'implement', 'SKILL.md');
const implementation = read('skills', 'start-implementation', 'references', 'implementation-task.md');
const reviewer = read('skills', 'start-implementation', 'references', 'reviewer.md');

test('the launcher creates a local Spec-only task and ends at dispatch', () => {
  assert.match(launcher, /same project|current project folder/);
  assert.match(launcher, /explicit `local` environment, including for a Git repository/);
  assert.match(launcher, /Pass its JSON unchanged to `create_thread` once/);
  assert.match(launcher, /exactly `\$proofline:implement <SPEC-ID>` on one line/);
  assert.match(launcher, /Do not wait for implementation results/);
  assert.match(launcher, /do not issue a duplicate creation/);
  assert.match(launcher, /explicit user model choice/);
  assert.match(launcher, /does not satisfy that tool requirement/);
  assert.match(skill, /does not invoke the session launcher/);
  assert.doesNotMatch(launcher, /spawn_agent|implementation-state\.js capture|review-input/);
  for (const name of ['start-implementation', 'implement']) {
    const metadata = read('skills', name, 'agents', 'openai.yaml');
    assert.match(metadata, /allow_implicit_invocation: false/);
    assert.ok(metadata.includes(`Use $${name}`));
  }
});

test('the implementation session executes the Spec directly and preserves current settings and user changes', () => {
  assert.match(skill, /Implement the ready Spec in this invoking session using its current model and reasoning effort/);
  assert.match(skill, /Own direct implementation, independent assignments, integration, and the completion decision/);
  assert.match(skill, /Sequential work stays with this session/);
  assert.match(skill, /existing staged, unstaged, and untracked files/);
  assert.match(skill, /location selected by the user and execution environment/);
  assert.match(skill, /Review preparation requires neither staging nor a commit/);
  assert.match(skill, /No originating conversation or separate handoff summary is required/);
  assert.match(skill, /read the unique ready Spec/);
  assert.match(skill, /resuming or automatically converting an in-progress legacy run is outside/);
});

test('parallel dispatch retains local work and integrates results in the same turn', () => {
  assert.match(skill, /goals, change boundaries, and interfaces are clear/);
  assert.match(skill, /File count and desired agent count are not decomposition criteria/);
  assert.match(skill, /one `PARALLEL.md` beside the Spec/);
  assert.match(skill, /Keep a concrete implementation task for yourself/);
  assert.match(skill, /non-conflicting write ownership/);
  assert.match(skill, /Continue your own implementation immediately after dispatch/);
  assert.match(skill, /Wait only when your own work is done or a result is needed/);
  assert.match(skill, /collect and integrate the results in this same turn/);
  assert.match(skill, /spawn_agent\(fork_turns: "none"\)/);
  assert.match(skill, /`followup_task` to continue an existing implementer's work/);
  assert.match(skill, /Parallel implementers do not delegate further/);
  assert.match(skill, /automatically creating separate Codex tasks/);
  assert.doesNotMatch(skill, /create_thread|fork_thread|send_message_to_thread/);
});

test('new sessions and parallel implementers share Astra-default routing', () => {
  const routing = read('skills', 'start-implementation', 'assets', 'model-routing.md');
  assert.match(skill, /shared routing policy selects new implementation sessions and parallel implementers/);
  assert.match(skill, /Preparation and Reviewer settings follow their own contracts/);
  assert.match(routing, /Explicit user model, reasoning, and usage limits take precedence/);
  assert.match(routing, /Choose model capability and reasoning effort separately/);
  assert.match(routing, /gpt-5\.6-luna` \| `high` \| The change method is effectively settled/);
  assert.match(routing, /use `xhigh` only when the same settled method/);
  assert.match(routing, /gpt-5\.6-sol` \| `medium` \/ `high`/);
  assert.match(routing, /gpt-6-astra` — Astra Light \| `low` \| Implementation or design judgment/);
  assert.match(routing, /visual work is not required/);
  assert.match(routing, /prior failure is not required/);
  assert.match(routing, /Terra and Spark are not initial routing candidates/);
  assert.match(routing, /reason for the selected model and effort in one sentence/);
  assert.doesNotMatch(routing, /gpt-5\.6-terra|gpt-5\.3-codex-spark/);
});

test('parallel implementers repair and verify first without recursive delegation', () => {
  assert.match(implementation, /^PROOFLINE_EXECUTION_ROLE: parallel-implementer$/m);
  assert.match(implementation, /First investigate, repair, and verify failures in your own scope/);
  assert.match(implementation, /scope changes, coordination, an unresolved blocker, or a needed model change/);
  assert.match(implementation, /do not make the main session repeat diagnosis as a required step/);
  assert.match(implementation, /Add and run tests needed by the actual change/);
  assert.match(implementation, /Do not create child agents or separate tasks/);
  assert.match(skill, /confirm its writes have ended before assigning a replacement/);
  assert.match(skill, /same task, current changes, attempted repairs, failure evidence/);
  assert.match(skill, /environment errors and missing requirements according to their cause/);
  assert.match(skill, /same failure repeats without new evidence or progress/);
  assert.doesNotMatch(implementation, /spawn_agent|fork_thread|create_thread|send_message_to_thread/);
});

test('review dispatch preserves main settings and starts fresh after every repair', () => {
  assert.match(skill, /new `reviewer` with `fork_turns: "none"` for every review, including after repairs/);
  assert.match(skill, /main session's model and reasoning effort at dispatch/);
  assert.match(skill, /set both tool fields explicitly when available/);
  assert.match(skill, /documented inheritance only if it guarantees both settings with fresh context/);
  assert.match(skill, /instead of guessing settings or inheriting the implementation conversation/);
  assert.match(skill, /Supply no implementation conversation, implementer self-assessment, or earlier review findings, verdicts, rebuttals, or history/);
  assert.match(reviewer, /same template applies after every repair/);
  assert.match(reviewer, /none of the bindings contains prior review material/);
  assert.doesNotMatch(reviewer, /\{\{(?:review_history|prior_findings|implementation_summary)\}\}/);
});

test('review bindings contain original authority, current changes and real evidence only', () => {
  const prompt = reviewer.match(/```text\r?\n([\s\S]*?)\r?\n```/)[1];
  const bindings = [...prompt.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]);
  assert.deepEqual(bindings, [
    'source_links', 'review_snapshot',
    'verification_evidence', 'review_command', 'plugin_root',
  ]);
  assert.match(prompt, /^PROOFLINE_EXECUTION_ROLE: reviewer$/m);
  assert.doesNotMatch(prompt, /original_request|accepted_decisions|BEGIN_ORIGINAL_REQUEST/);
  assert.match(prompt, /captured Spec requirements, decisions, boundaries, and completion conditions/);
  assert.match(prompt, /Read the actual diff and relevant related code directly/);
  assert.match(prompt, /circular oracle/);
  assert.match(prompt, /Do not run verification, edit code, change Git or execution state, or delegate/);
});

test('review blocks scoped defects and parent records justified out-of-scope exclusions', () => {
  const disposition = read('skills', 'start-implementation', 'references', 'review-conflicts.md');
  assert.match(reviewer, /unmet requirement, a regression introduced by this change, or a violated directly affected contract/);
  assert.match(reviewer, /triggering conditions, concrete code evidence, and relationship to this run's changes/);
  assert.match(reviewer, /unrelated existing issue or optional improvement does not block/);
  assert.match(disposition, /recorded reason tied to the Spec and change evidence/);
  assert.match(disposition, /An unresolved valid finding still blocks completion/);
  assert.match(disposition, /Do not forward previous findings, verdicts, rebuttals, dispositions, or review history/);
  assert.match(disposition, /every finding in a returned `fail` is out of scope/);
  assert.match(disposition, /A second passing verdict is not required/);
});

test('verification remains outcome-based and final-state evidence is required', () => {
  assert.match(skill, /commands need not be fixed before implementation/);
  assert.match(skill, /record each command, location, result, and tested state/);
  assert.match(skill, /Reuse successful evidence while relevant state is unchanged/);
  assert.match(skill, /rerun only affected checks/);
  assert.match(skill, /All required conditions must have current evidence before completion/);
  assert.match(skill, /Once all writers have finished and results are integrated/);
  assert.match(skill, /final state matches the verified and reviewed changes/);
});

test('the live instruction path has no recursive execution or Gate helper dependency', () => {
  const live = [
    skill, implementation, reviewer,
    read('skills', 'start-implementation', 'references', 'review-conflicts.md'),
    read('skills', 'figure-it-out', 'SKILL.md'),
    read('skills', 'figure-it-out', 'references', 'preparation-task.md'),
    read('skills', 'spec-slice', 'SKILL.md'),
    read('skills', 'spec-slice', 'references', 'parallel-plan.md'),
  ].join('\n');
  assert.doesNotMatch(live, /coordinator-state\.js|run-gates\.js|inspect-execution-tree\.js|prepare-worktree\.js|sync-control-state\.js|integrate-reviewed\.js|prepare-review\.js/);
  assert.doesNotMatch(live, /root-only-implementation\.md|slice-worker\.md|execution-tree\.md|review_history/);
  for (const name of ['root-only-implementation.md', 'slice-worker.md', 'slice-coordinator.md']) {
    assert.equal(fs.existsSync(path.join(repoRoot, 'skills/start-implementation/references', name)), false);
  }
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'AGENTS.md')), false);
});
