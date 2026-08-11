---
name: start-implementation
description: "Coordinate implementation sessions and independent reviews in Direct or Sliced mode when the user asks to start or resume implementation using a ready Spec ID or path."
---

# Proofline Start Implementation

Coordinate one ready Spec through implementation completion. The coordinator does not directly implement product code or tests or judge the result. Write all messages and reports in the user's language, and follow `assets/model-routing.md` for implementer and reviewer model and reasoning levels.

## Participants

- **Coordinator (current Codex task):** Coordinate sessions and reviews and update Spec/Slice status.
- **Implementer (created by the coordinator with `create_thread`/`fork_thread`):** Implement code and tests.
- **Reviewer (`spawn_agent` subagent):** Do not participate in implementation; judge independently (blind and read-only).

## Preparation

1. Check `.proofline/specs/<SPEC-ID>-*/SPEC.md` (identity, schema, revision, requirements, project, and status).
2. For linked `PL-*` targets, apply `../issue-ledger/references/work-link.md` once and keep issue content outside implementer and reviewer context.
3. Read the project's domain glossary (`CONTEXT.md`) and any ADRs in the area you're touching first.
4. Proceed only with `ready` (`draft` → return to `implementation-spec`; `blocked` → inform the user of the prerequisite; terminal status → stop).
5. If `$spec-slice` reports `Direct`, proceed in Direct mode. If it reports `Sliced`, use the current revision's Slice plan written by that skill.

## Common Implementation and Review Sequence

Specify the target for Direct (entire Spec) or Sliced (current Slice/final fixes), then proceed:

1. **Instruct:** The coordinator sends the implementer the target path, relevant domain documentation paths to read, implementation work, user constraints, and required verification.
2. **Execute:** The implementer implements only the specified target and performs the required verification. Do not change Spec/Slice status.
3. **Report:** The implementer reports whether the work is complete (and the reason if incomplete) to the coordinator with `send_message_to_thread`.
4. **Wait:** The coordinator must not call `wait_threads`. End the turn after instructing or creating the task, and resume when the report is received.
5. **Handle incomplete work:** When an incomplete report is received, report the stop reason to the user without review.
6. **Create review:** When a completion report is received, create a fresh reviewer with `spawn_agent`(`fork_turns: "none"`).
   - **Pass:** Target Spec/Slice, project root containing the current implementation state, relevant domain documentation paths to read, repository instructions, user constraints, output language, and judgment criteria.
   - **Do not pass:** Implementer report, previous review, fix explanation, work history, or expected judgment.
7. **Judge:** The reviewer compares against the project state and judges:
   - `pass`: Requirements are satisfied and required verification succeeds → proceed with the pass procedure for that mode.
   - `fail`: Implementation defect or scope violation (give the reason and required fixes) → send to the same implementer and resume from step 2 (a fresh reviewer makes the next judgment).
   - `need_confirm`: A user decision is required → stop automatic progress and, after user confirmation, either proceed with the pass procedure or send to the same implementer and resume from step 2.

## Repetition Limits

- Review again only when the result has changed materially or new evidence exists. Stop immediately if the result is unchanged, a failure repeats, or a previous failure recurs.
- Allow at most three `fail` judgments per target (one Direct target, one Slice, or the final entire Spec). Report a stop if the limit is exceeded.
- If reviewer execution fails or the judgment is invalid, replace the reviewer with a fresh one at most once (stop if it fails again).
- If task creation, forking, reporting, or review is unavailable, report the stop reason without changing status.

## Direct Mode

1. Use `create_thread` to create a local task that shares the project (implementer).
2. Run the common sequence for the entire Spec.
3. Complete on `pass` (no worktree, staging, or automatic commit).

## Sliced Mode

Process Slices whose dependencies are satisfied sequentially (run only one implementer at a time).

### Git Repositories

1. From a state containing the ready Spec and Slice plan, use `create_thread` to create a task based on a temporary worktree. Its entire prompt is: `<SPEC-ID> base session`.
2. When creation returns a `threadId`, select a runnable Slice, fork the base task with `fork_thread` (`environment: { type: "same-directory" }`), and send the implementation instructions only to that fork. If creation returns only a `clientThreadId`, end the turn and resolve the ready task before forking it.
3. Run the common sequence for that Slice.
4. On `pass`, ask the implementer to commit and report the SHA with `send_message_to_thread`, then end the turn. Change the Slice to `completed` only after receiving the SHA.
5. Repeat with the next Slice (do not commit before `pass`; do not merge, rebase, squash, push, remove the worktree, or delete the branch).

### Non-Git Projects

1. For each Slice, use `create_thread` to create a shared local task (implementer).
2. Run the common sequence → on `pass`, change it to `completed` and proceed to the next Slice (no worktree, staging, or automatic commit is needed).

### Final Review of the Entire Spec

1. When all Slices are `completed`, create a fresh reviewer with `spawn_agent`(`fork_turns: "none"`) (target: entire Spec; use the same pass/do-not-pass constraints as common step 6).
2. Complete on `pass`.
3. On `fail`, send it to the last Slice implementer → run common steps 2-5, then return to final review step 1.
4. On `need_confirm`, obtain user confirmation → complete if passed; if changes are required, send them to the last Slice implementer, run common steps 2-5, and return to final review step 1.

If there were final fixes, in Git the same implementer commits after `pass` and reports the SHA with `send_message_to_thread`. In non-Git projects, complete without a commit.

## Completion

- Direct: On review `pass`, change the Spec to `completed`.
- Sliced: When every Slice is `completed` and the entire Spec receives `pass`, change the Spec to `completed`. In Git, all Slice SHAs and, if there were final fixes, that SHA must have been received.
- Preserve the Spec body except for lifecycle status.
- Report to the user: execution mode, tasks used, project/worktree root, changed paths, verification results, final judgment, and commit SHAs (when stopped, include the reason and the decision or prerequisite).
- Stop immediately if the Spec revision changes (do not reuse previous implementation or review results, and do not roll back automatically; roll back only when explicitly requested by the user or permitted by the Spec procedure).
