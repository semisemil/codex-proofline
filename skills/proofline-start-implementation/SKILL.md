---
name: proofline-start-implementation
description: Start or resume a Proofline Spec directly or through conditional Work Slices, with user-requested pre-review and blind post-review. Use when implementing a ready SPEC-* contract and complete only after its current implementation passes.
---

# Proofline Start Implementation

Coordinate one authorized Spec revision. Keep the contract in the Spec, optional execution state in its Slice files, and evidence in task history.

## Rules

- Coordinate only: modify no product code/tests and supply no verdict. Modify only Slice files and Spec lifecycle state.
- Use one writable top-level task for direct work or each active Slice through `create_thread`/`send_message_to_thread`; use an integration task only for final integration findings. Never use `spawn_agent` for implementation.
- Use fresh blind read-only subagents for review; they never control/message implementation tasks or receive prior work/review history.
- Stop without changing Spec status when required orchestration, history, follow-up, or model selection is unavailable.

## Target and chain

Resolve `.proofline/specs/<SPEC-ID>-*/SPEC.md`; ignore `.proofline/prds/**`. Validate identity, schema `2`, revision, contract, status, and project. Proceed only with `ready`; route `draft` through `proofline-implementation-spec`, report the prerequisite for `blocked`, and reject terminal Specs.

Chain key: `proofline_<lowercase Spec ID with hyphens replaced by underscores>_r<revision>`. Use:

```text
<chain_key>_pre_review_<two-digit attempt>
<chain_key>_implementation
<chain_key>_post_review_<two-digit attempt>
<chain_key>_slice_<two-digit slice number>_implementation
<chain_key>_slice_<two-digit slice number>_post_review_<two-digit attempt>
<chain_key>_integration
<chain_key>_final_review_<two-digit attempt>
```

Query exact names/latest results; stop on duplicate implementation tasks. Reuse pre-review `pass` only while the revision and inspected facts remain current. Number each review type independently and resume the first incomplete step.

## Run

Choose roles through `assets/model-routing.md` and fill the matching `references/*-prompt.md`. Render the entire prompt in the user's language while preserving identifiers and verdict tokens; add only overrides absent from the Spec/repository and omit empty optional lines.

**Pre-review:** Run only when the user explicitly requests it. On `block`, route a contract-changing decision to `draft` and an external prerequisite to `blocked`; create no task. On `no_verdict`, report missing evidence without changing status.

**Execution mode:** Default to direct implementation. Read `references/slicing.md` only when the Spec may contain multiple independently verifiable outcomes, a real dependency sequence, or more work/evidence than one task context can hold. Record the chain baseline before writing a Slice plan. Create no Slice merely to satisfy the workflow, and never block because a ready Spec has none.

**Implementation:** For direct work, create/resume `<chain_key>_implementation` with `references/implementation-prompt.md`. For sliced work, create/resume only one frontier Slice task with `references/slice-implementation-prompt.md`. Each prompt records the pre-edit boundary and task-attributable changes. Mention only needed skills: `proofline-scope-integrity` for large/risky work, `proofline-refactor-proof` for `refactor`, `proofline-exact-port` for `exact_port`, and `proofline-issue-ledger` for durable out-of-scope work. Include only material pre-review findings. After creating or following up an implementation task, end the turn; do not monitor or call `wait_threads` because the task reports back.

Before review, return reports missing required or changed-behavior evidence to the same task for evidence only; invent no check or code defect.

**Post-review:** Start every attempt with a fresh blind read-only subagent through `spawn_agent` using `fork_turns: "none"`; never use `create_thread` to run a post-review. Give it only the matching neutral review prompt, current Spec/Slice path, project root, request overrides, and output language. Never pass implementation or pre-review reports, prior review reports/findings, fix summaries, task references, attempt history, or expected conclusions. Wait for its result in the coordinator task. For direct work use `references/post-review-prompt.md`. For a Slice use `references/post-review-slice.md`; on `pass`, mark only that Slice `completed` and proceed to the next frontier. After every Slice passes, use `references/post-review-final.md`. Resolve its `changes_required` findings through `<chain_key>_integration` with `references/integration-prompt.md`, then run a fresh blind final review.

Send only `changes_required` findings to the responsible task. For `no_verdict`, request missing implementation evidence only; retry reviewer/tool/attribution failures with a fresh reviewer or report the unverified boundary. Neither verdict changes Spec status.

Use no fixed attempt limit. Continue while fixes/evidence make material progress; stop and report when the same finding repeats without progress or progress cannot continue. Set `blocked` only for an external prerequisite.

After creating or following up an integration task, end the turn; do not monitor or call `wait_threads` because the task reports back.

## Finish

- Never auto-rollback. Correct through the same task; roll back only by user request or Spec procedure.
- Complete direct work only after its post-review passes. Complete sliced work only after every Slice is `completed` and a fresh final review passes. In both modes, every REQ's `Behavior`/`Done when` must hold and contractual/repository-required validation must have no failure or omission. Set the Spec `completed`, freeze its body, and report settings, task refs, files, checks, blockers, and verdict without transcripts.
- On revision change, stop and reuse no report or completed Slice state; regenerate any Slice plan for the new revision. Orchestration failure never alters status. Set `cancelled` only for product-contract cancellation.
