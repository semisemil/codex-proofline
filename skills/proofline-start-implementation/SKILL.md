---
name: proofline-start-implementation
description: Start or resume implementation of a Proofline PRD through one persistent top-level implementation task and fresh independent review subagents. Complete only after the latest implementation report passes independent post-review.
---

# Proofline Start Implementation

Coordinate one exact PRD revision through:

```text
fresh pre-review -> one persistent writable implementation task -> fresh post-review
changes_required -> same implementation task -> new post-review
```

Keep intent in the PRD and reports in native task history; create no project-local transcript, report copy, or execution ledger. Read `../proofline-baseline-quality/SKILL.md` and `assets/model-routing.md` completely before coordination, and `../proofline-completion-evidence/SKILL.md` before the final report. An explicit request to implement a PRD authorizes that revision; do not ask again.

## Roles

- Act only as coordinator: modify no product code/tests and supply no substitute verdict. Only the coordinator creates the implementation task, spawns reviewers, and follows up; reviewers never control or message the implementation task.
- Use one native top-level implementation task per revision for all work and corrections, plus native review subagents. Never simulate roles, run local subprocess agents, or create top-level review tasks.
- Spawn each reviewer fresh, read-only, and without conversation history. Never reuse a reviewer after verdict.
- If task creation, subagent spawn, model selection, history, or follow-up is unavailable, stop and report the workflow blocked without changing PRD status.

## Resolve and resume

Accept a canonical path or resolve an ID to exactly one `.proofline/prds/<PRD-ID>-*/PRD.md`. Confirm path/front-matter ID agreement, project identity, supported `schema_version`, positive revision, required sections, valid status, and inspectable project files and validation entry points.

- `ready`: proceed and retain it while tasks run.
- `draft`: set `ready` only when the unchanged contract already passes the ready gate and status alone is stale; otherwise use `proofline-implementation-spec`.
- `blocked`: verify the blocker; set `ready` only after an external prerequisite resolves without contract change. Revise first if requirements, scope, acceptance, validation, or policy changes.
- `completed | cancelled | superseded`: do not start.

Form `proofline_<lowercase_prd_id_with_hyphens_as_underscores>_r<revision>` and use these exact session keys as prompt line one and task/subagent name:

```text
<chain_key>_pre_review_<two-digit attempt>
<chain_key>_implementation
<chain_key>_post_review_<two-digit attempt>
```

Inspect native task history and prior coordinator subagent results first. Never create a second implementation task for the revision. Reuse pre-review `pass` only while revision and inspected facts remain current; number a fresh subagent for every post-review. Stop if multiple implementation tasks leave authority unclear; ignore other revisions. Resume the first incomplete step: current pre-review pass, implementation report, post-review of its latest sequence, correction, or completion.

## Settings and prompts

Apply `assets/model-routing.md`; select implementation and every review independently. Explicitly set each reviewer's model and effort. Include each chosen setting and short rationale without copying the routing table.

Immediately before creating a role, read only its reference, fill every placeholder, and send it without duplicated instructions:

- `references/pre-review-prompt.md`
- `references/implementation-prompt.md`
- `references/post-review-prompt.md`

Use the user's language for `<output_language>` and remove inapplicable optional values.

## Chain

**Pre-review:** On `pass`, continue. On `block`, create no implementation task; use `proofline-implementation-spec` when the contract needs revision and set PRD `blocked` only for a durable user decision, permission, or external prerequisite. With no verdict, create no task, report unavailable material and next action, and do not change `ready` merely for insufficient review access.

**Implementation:** Create/resume the chain task. Always apply `proofline-baseline-quality`; add `proofline-scope-integrity` for large/risky work, `proofline-refactor-proof` for `refactor`, `proofline-exact-port` for `exact_port`, and `proofline-issue-ledger` only for durable out-of-scope work. Before post-review, require exact revision and report sequence, every changed path, file-level behavior, and passed/failed/unrun checks. If incomplete, send one corrective follow-up to the same task; stop if evidence remains inadequate.

**Post-review:** Review only the latest report sequence. On `pass`, evaluate completion. On `changes_required`, send blocker and major plus relevant minor findings to the same implementation task; require verification, valid fixes, rerun affected checks, and the next complete sequence, then spawn a new reviewer. With no verdict, count the attempt, report missing evidence, and do not complete.

Allow at most three automatic post-review attempts, counting verdict and no-verdict reports. A spawn failure consumes none but blocks the workflow. After three without `pass`, stop with unresolved findings and observed validation; resume only explicitly, with the same implementation task.

## Failure and finish

Never auto-rollback after implementation, validation, or review failure. Keep changes and use the same task for in-scope corrections. On stop, report changed paths, failed/unrun checks, unresolved findings, and next action. Roll back only by explicit user request or approved PRD procedure, only that task's changes, never unrelated work.

Complete the exact revision only when every mandatory requirement and acceptance criterion is implemented; every required validation ran without required failure or omission; a fresh post-review passed the latest report sequence; and the implementation task and all chain reviewers still name that revision. Then set `completed`, update `updated_at` and `archived_at`, freeze the body, and use `proofline-completion-evidence` to report settings, task references, changed files, validation, omissions, and verdict without copying transcripts.

If revision changes, stop the old chain: no further task instructions, reviewers, or reused reports. Start the new revision only when the current request authorizes it. Transient orchestration failure does not alter PRD status; reserve `blocked` for a durable product decision, permission, or external prerequisite, and revise through `proofline-implementation-spec` when resolution changes the contract.

On explicit workflow cancellation, create no task/subagent or follow-up; report existing changes and validation. Leave the PRD `ready` or `blocked` by its contract. Set `cancelled` only if the user also cancels the product contract.
