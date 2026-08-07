---
name: proofline-start-implementation
description: "Start or resume implementation of one authorized ready Spec, directly or through conditional Work Slices, with independent review and lifecycle coordination. Use when the user explicitly invokes this skill with a Spec ID or path and asks to implement it."
---

# Proofline Start Implementation

Coordinate one authorized Spec revision. Keep the contract in the Spec, optional execution state in its Slice files, and evidence in task history.

## Rules

- Coordinate only: modify no product code/tests and supply no verdict. Modify only Slice files and Spec lifecycle state.
- In Git, use one worktree per Spec revision and one writer at a time. The direct implementation task owns its worktree; sliced work uses an unchanged implementation-base task whose children share its directory.
- A Git implementer stages its candidate. A fresh blind subagent reviews it; the same implementer fixes and restages, then commits only after `pass`.
- In non-Git projects, use the current project location without worktrees, staging, or automatic commits.
- Stop without changing Spec status when required orchestration, shared-directory branching, history, follow-up, or model selection is unavailable. Do not invent a patch or VCS-specific fallback.

## Target and chain

Resolve `.proofline/specs/<SPEC-ID>-*/SPEC.md`; ignore `.proofline/prds/**`. Validate identity, schema `2`, revision, contract, status, and project. Proceed only with `ready`; route `draft` through `proofline-implementation-spec`, report the prerequisite for `blocked`, and reject terminal Specs.

Chain key: `proofline_<lowercase Spec ID with hyphens replaced by underscores>_r<revision>`. Use it only in coordinator state to name or index:

```text
<chain_key>_pre_review_<two-digit attempt>
<chain_key>_implementation_base
<chain_key>_implementation
<chain_key>_post_review_<two-digit attempt>
<chain_key>_slice_<two-digit slice number>_implementation
<chain_key>_slice_<two-digit slice number>_post_review_<two-digit attempt>
<chain_key>_integration
<chain_key>_final_review_<two-digit attempt>
```

Query exact titled tasks and record returned fork thread IDs under their logical keys. Stop on duplicates. Reuse unchanged Spec, task linkage, pre-review facts, implementation reports, and review evidence. Resume the first incomplete step. Never place the chain key in a role prompt.

## Run

Choose roles through `assets/model-routing.md`. Fill prompts in their existing language, set `<output_language>` to the user's language, add only overrides absent from the Spec/repository, and omit empty optional lines.

**Pre-review:** Run `references/pre-review-prompt.md` only when the user explicitly requests it. On `block`, route a contract-changing decision to `draft` and an external prerequisite to `blocked`; create no implementation task. On `no_verdict`, report missing evidence without changing status.

**Execution mode:** Default to direct implementation. Read `references/slicing.md` only when the Spec may contain multiple independently verifiable outcomes, a real dependency sequence, or more work/evidence than one task context can hold. Record the chain baseline before writing the complete Slice plan. Create no Slice merely to satisfy the workflow, and never block because a ready Spec has none.

**Git tasks:** Start from the project state containing the validated Spec and, when sliced, its complete plan.

- Direct: create/resume titled task `<chain_key>_implementation` in a new worktree and send `references/implementation-prompt.md` for the whole revision.
- Sliced: create/resume titled task `<chain_key>_implementation_base` in a new worktree with: `This is the implementation fork base for <spec_id> revision <revision>. In <output_language>, reply only: ready: <current project root>`. Send it no later message. For each frontier Slice, `fork_thread` from this base with `environment: { type: "same-directory" }`, record the thread ID, mark that Slice `in_progress`, then send the common implementation prompt. Run one Slice at a time. Every Slice inherits only the base turn while seeing the commits in the shared directory.
- Final integration: fork from the same unchanged base with `same-directory`, record it as `<chain_key>_integration`, and send the common implementation prompt with only eligible final findings.

**Non-Git tasks:** Use `references/implementation-prompt.md` in the current project location for direct work or one sequential task per Slice. Use the same task pattern for final integration. Request no worktree, staging, commit, patch, or SVN-specific operation.

**Implementation candidate:** Fill `<implementation_target>` with the direct revision, Slice, or eligible integration findings. In Git, fill `<candidate_boundary>` with: `Stage only this task's implementation, including additions and deletions, and do not commit.` In non-Git, omit it. Mention only needed skills: `proofline-scope-integrity` for large/risky work, `proofline-refactor-proof` for `refactor`, `proofline-exact-port` for `exact_port`, and `proofline-issue-ledger` for durable out-of-scope work.

A Git report is review-ready when it gives the project root, staged paths, required verification, and blockers, and the index represents exactly that task's candidate. A non-Git report needs the corresponding changed paths and evidence. Return only missing evidence to the same task. After creating or following up an implementation task, end the turn; the task reports back.

**Blind review:** Start every verdict-bearing attempt with a fresh read-only `spawn_agent` using `fork_turns: "none"`; never use `create_thread` for review. Fill `references/post-review-prompt.md` for the direct revision, Slice, or final implementation. For a Git direct/Slice review, set `<candidate_boundary>` to `Treat HEAD plus the staged diff (git diff --cached) as the complete candidate; ignore unstaged and untracked changes.` For Git final review, evaluate the committed Slice state plus any staged integration candidate and ignore other unstaged/untracked changes. For non-Git, use the current authorized implementation state.

Give the subagent only that neutral prompt, current Spec/Slice path, implementation root, request overrides, and output language. Never pass implementation or pre-review reports, prior reviews/findings, fix summaries, task references, attempt history, expected conclusions, or the chain key. Wait for its result in the coordinator task.

Allow at most three verdict-bearing attempts for direct work, each Slice, and final review, including the first. A report-format repair is not a new attempt; a reviewer/tool execution failure may use one fresh replacement. On `changes_required`, `no_verdict`, malformed output, or execution failure, read `references/review-control.md`. Send eligible findings to the same implementer, which fixes, verifies, and refreshes the staged candidate before a new blind review. Never re-run a review when candidate state is unchanged.

**Pass:** In Git, send the responsible implementation task one follow-up: `Commit the staged implementation from this task as <commit_message> and report the commit SHA in <output_language>.` Use:

```text
proofline(<SPEC-ID>): implement revision <revision>
proofline(<SPEC-ID>): complete <SLICE-ID>
proofline(<SPEC-ID>): resolve final integration
```

Do not complete direct work or a Slice until the coordinator receives the SHA. A failed commit is a stop boundary. In non-Git projects, `pass` completes the direct work or Slice without a commit.

After a Slice commit, mark only that Slice `completed` and start the next frontier. After all Slices complete, run a fresh blind final review. Route eligible final findings through the integration task, then review again; commit staged integration only after `pass`. Do not automatically amend, rebase, squash, merge, hand off, push, remove the worktree, or delete a branch/reference.

## Finish

- Never auto-rollback. Correct through the responsible task; roll back only by user request or Spec procedure.
- Complete direct work only after review passes and any Git commit succeeds. Complete sliced work only after every Slice is `completed`, final review passes, and any integration commit succeeds. Every REQ's `Behavior`/`Done when` and required validation must hold. Set the Spec `completed`, freeze its body, and report settings, task refs, worktree root, files, checks, blockers, verdict, and commit SHAs without transcripts.
- On revision change, stop and reuse no report, worktree, or completed Slice state; regenerate any Slice plan. Orchestration failure never alters status. Set `cancelled` only for product-contract cancellation.
