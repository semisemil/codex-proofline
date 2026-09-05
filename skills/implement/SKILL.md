---
name: implement
description: "Explicit-only execution of one ready Spec by ID in this session, with optional parallel agents and fresh independent review."
---

# Proofline Implement

Implement the ready Spec in this invoking session using its current model and reasoning effort. Own direct implementation, independent assignments, integration, and the completion decision.

## Prepare

Resolve the supplied Spec ID in this project's `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md` and read the unique ready Spec. Report a missing, ambiguous, or non-ready Spec before implementation. The Spec supplies the requirements, settled decisions, boundaries, and completion conditions; read its required original sources and relevant repository evidence. No originating conversation or separate handoff summary is required. Do not reconstruct a missing original request or label the Spec as a verbatim user request. This session owns execution and reports directly to the user; it does not invoke the session launcher or return completion to the originating session.

Before changing product files, read [execution evidence](../start-implementation/references/execution-evidence.md) and capture the start state. Distinguish this run's changes from existing staged, unstaged, and untracked files; preserve existing user changes. Use the location selected by the user and execution environment. Review preparation requires neither staging nor a commit.

This workflow applies to new runs. Preserve existing execution documents and records; resuming or automatically converting an in-progress legacy run is outside this workflow.

## Implement and optionally delegate

Proceed directly from the Spec when one session can implement the work coherently. Sequential work stays with this session. Split only when goals, change boundaries, and interfaces are clear and independent execution has a useful parallel benefit. File count and desired agent count are not decomposition criteria.

When a split is useful, read [Spec Slice](../spec-slice/SKILL.md) and record the flat assignments in one `PARALLEL.md` beside the Spec. Keep a concrete implementation task for yourself. Before dispatch, establish non-conflicting write ownership and the shared interfaces; overlapping changes require sequencing or a revised assignment, not concurrent writers.

For each parallel implementer, load [model routing](../start-implementation/assets/model-routing.md) and [the implementation assignment](../start-implementation/references/implementation-task.md). Select model and reasoning separately and record the work characteristic and selection reason in one sentence. Render only the necessary Spec context, owned scope, and interfaces. Dispatch with `spawn_agent(fork_turns: "none")`, setting both selected fields. The shared routing policy selects new implementation sessions and parallel implementers. This running session keeps its actual settings; Preparation and Reviewer settings follow their own contracts.

Continue your own implementation immediately after dispatch. Wait only when your own work is done or a result is needed; collect and integrate the results in this same turn. Use `send_message` for coordination with a running agent and `followup_task` to continue an existing implementer's work. Internal assignments use subagents rather than automatically creating separate Codex tasks for message transport. Parallel implementers do not delegate further.

Each child has one immutable execution role: `preparation`, `parallel-implementer`, or `reviewer`. A different role requires a fresh history-free agent; never send a different `PROOFLINE_EXECUTION_ROLE` marker to an existing agent. The main session has no execution role marker. Children receive the Proofline baseline through the runtime hooks; when hooks are disabled, supply that baseline at child start.

## Repair and verify

The implementer that encountered a failure first investigates, repairs, and verifies it within its assigned scope. This includes your own work. Escalate only a scope change, coordination with another assignment, an unresolved blocker, or a needed model change, with failure evidence and the required support. The main session handles that coordination or reassignment without a mandatory second diagnosis.

If the runtime cannot change an existing agent's model or reasoning, wait for or stop that execution and confirm its writes have ended before assigning a replacement. Transfer the same task, current changes, attempted repairs, failure evidence, and unresolved work. Reassess parallel implementer fit using model routing; there is no fixed promotion ladder. This workflow does not automatically recreate the main session or transfer an in-progress run to another task. Treat environment errors and missing requirements according to their cause. Report a blocker when the same failure repeats without new evidence or progress.

Implementers may add and run tests needed by the actual change. Preserve the Spec's completion conditions and user-required verification; commands need not be fixed before implementation. Follow execution evidence to record each command, location, result, and tested state. Reuse successful evidence while relevant state is unchanged; after a change, rerun only affected checks. All required conditions must have current evidence before completion.

Once all writers have finished and results are integrated, verify the actual run delta and required outcomes. Keep the reviewed and verified state aligned with that delta, including changes to previously dirty files.

## Fresh independent review

Load [the reviewer assignment](../start-implementation/references/reviewer.md) and create a new `reviewer` with `fork_turns: "none"` for every review, including after repairs. Use the main session's model and reasoning effort at dispatch, independently of worker routing. Read the actual settings from the runtime and set both tool fields explicitly when available. Use documented inheritance only if it guarantees both settings with fresh context; if neither is possible, report the missing capability instead of guessing settings or inheriting the implementation conversation.

Build the assignment from the captured Spec and its relevant original sources, the actual run diff, and current verification evidence. The Spec is the implementation and review contract. Use the evidence helper's snapshot and read command. Supply no implementation conversation, implementer self-assessment, or earlier review findings, verdicts, rebuttals, or history. After repairs, use the same input composition against the latest state. The reviewer may read related code to establish impact; it does not change files or execution state.

On findings, follow [review disposition](../start-implementation/references/review-conflicts.md). Repair only valid in-scope findings, update affected evidence, and create another fresh reviewer. An out-of-scope-only `fail` does not prevent completion when its exclusion is supported, no valid finding remains unresolved, and all required verification is current.

## Finish

Use execution evidence to confirm the final state matches the verified and reviewed changes and complete the Spec only when its requirements are met and no valid blocking finding remains. Report the delivered outcome, relevant verification, and any unresolved limitation. Preserve existing user changes and execution records. Commit or push only when the user has authorized it.
