---
name: start-implementation
description: "Coordinate a ready Spec through implementation, independent review, and optional safe Slice concurrency."
---

# Proofline Start Implementation

Coordinate; do not implement or review product changes yourself. Write messages in the user's language. Before creating each implementer or reviewer, read `assets/model-routing.md` and pass its selected model and reasoning through the stated tool fields.

## Prepare

1. Validate the Spec identity, revision, project, requirements, and `ready` status. Stop for missing prerequisites, terminal status, or revision change.
2. Apply linked-issue handling from `../issue-ledger/references/work-link.md` once when needed; keep issue content outside implementer and reviewer context.
3. Read the project domain document and applicable ADRs.
4. Read and apply `../spec-slice/SKILL.md` as an internal preparation step. This Direct/Sliced decision is not implementation approval and requires neither separate user approval nor a separate `$spec-slice` call.
   - When the current revision has Slice documents, run `node ../spec-slice/scripts/inspect-slice-plan.js <slice-directory>` and reuse an accepted plan. Stop on an invalid plan; replace it only when the user explicitly requests re-slicing.
   - When it has no Slice documents, decide from the ready Spec. For `Direct`, continue without writing Slice artifacts. For `Sliced`, create the complete plan and run the inspector.
   - Continue Sliced implementation only when the inspector accepts the current plan; use its plan mode, dispatch, and integration order.

## Gates

| Gate | Owner | Pass condition |
| --- | --- | --- |
| Implementation | Implementer | All Spec-planned checks executable by the implementer, the smallest affected build, syntax, or type check, and focused changed-behavior tests succeed; the report maps every owned acceptance condition to final evidence or an unverified reason. |
| Review | Direct or Slice reviewer | Current evidence supports every target acceptance condition, the implementation introduces no defect or regression, and its changes stay within authorized scope. A pre-existing issue blocks only when it prevents a required target outcome. |
| Integration | Direct or final reviewer | Current integrated evidence supports every Spec-wide acceptance condition and reviewer-owned integration check. |

A target passes only with a successful Implementation Gate and reviewer `pass`. Direct review owns Review and Integration; Slice review owns Review; final Sliced review owns Integration.

## Implementation loop

1. Send exactly these fields: target and domain-document paths; requested change; user constraint delta; one-line Implementation Gate; report contract. The report contract requires changed paths, final commands and results, evidence or an unverified reason for each owned acceptance condition, completion state, and stop reason. End the implementer message there.
2. The implementer changes product and test paths within target scope, leaves Spec/Slice documents unchanged, runs the Gate, and reports through `send_message_to_thread`. The implementer does not judge whole-Spec compliance, design, scope, or the final review verdict.
3. End the coordinator turn after instruction; resume on the callback. Do not call `wait_threads`.
4. Review only a `complete` report whose Gate succeeded. Spawn a fresh blind, read-only reviewer with `fork_turns: "none"`; pass target/project/domain paths, repository instructions, user constraints, output language, changed paths, final commands and results, acceptance-condition evidence or unverified reasons, and the owned Gate. The reviewer checks the contract and final evidence first, then inspects the implementation as needed. Require `pass` when the Gate holds, `fail` with evidence-backed blocking findings that name the violated acceptance condition or missing or conflicting evidence, or `need_confirm` for an unresolved decision outside authorized scope. A concrete out-of-scope issue already evidenced by the target review is a separate `observation`; it affects neither judgment nor blocking findings. Exclude implementer self-judgment, retry history, and expected judgment. Keep the coordinator turn active and call `wait_agent` until judgment returns.
5. On `pass`, approve the target. On `fail`, send the same implementer only the target/domain paths, unresolved blocking findings, constraint delta, and one-line Gate; then use a fresh reviewer. On `need_confirm`, obtain the decision and require a fresh reviewer `pass`. Record each non-duplicate `observation` through `../issue-ledger/SKILL.md`.

Stop on an unchanged or repeated failure, after three `fail` judgments for one target, or after a replacement reviewer also fails to return a valid judgment.

## Direct

Create a shared-local implementer with routed `model` and `thinking`, then run the loop for the Spec. On approval, mark the Spec `completed`. Leave product/test edits in the shared working tree without staging or committing.

## Sliced

For Non-Git projects, run one Slice implementer at a time; approve and mark each Slice `completed` before starting the next.

For Git projects:

1. Follow the inspector's integration order. Use one active Slice for legacy or mixed plans; for v2 use at most two Slices from `dispatch` when their recorded boundaries are non-overlapping.
2. Create a routed temporary-worktree integration base with this prompt: `<SPEC-ID> integration base. Send ready with send_message_to_thread to <codex_delegation><source_thread_id>, then end the turn.` Resume using the callback source ID as the base `threadId`. The base only cherry-picks, aborts conflicts, removes completed Slice worktrees under step 4, and reports Git state.
3. Fork runnable Slice worktrees from the current base. Put routed `model` and `thinking` in each first implementation message and run the implementation loop.
4. After approval, stage and commit only reviewed target-scope product/test paths. Cherry-pick approved commits into the base strictly in integration order; mark a Slice `completed` only after a clean pick. Treat its implementer task as terminal, send it no further messages, and archive it with `set_thread_archived`. Only after archival succeeds, use the base to verify `git -C <slice-root> rev-parse HEAD` equals the approved commit and `git -C <slice-root> status --porcelain` is empty, then run `git worktree remove <slice-root>` without `--force`. On archive failure, check mismatch, or removal failure, preserve the worktree and report the exact path and reason. Later Slices wait for earlier ones.
5. On conflict, abort cleanly and redo that Slice in a fresh worktree from the current base, followed by a fresh Review Gate. Rerun the inspector after each completion to dispatch newly runnable Slices.

Keep the integration base through final review. Preserve pre-existing Git state. Do not push, merge, rebase, squash, force-remove worktrees, or delete branches automatically.

## Final review

After every Slice is completed, run a fresh entire-Spec Integration review against every acceptance condition and the current integrated evidence. A final fix gets its own Implementation and Review Gates, is integrated through the same path, and is followed by another Integration review. Complete the Spec only after reviewer `pass`; change only lifecycle status in Spec/Slice documents.

Report mode, tasks and roots, changed paths, acceptance-condition evidence or unverified reasons, Gate results, reviewer judgment, integrated SHAs, or the exact stop reason.
