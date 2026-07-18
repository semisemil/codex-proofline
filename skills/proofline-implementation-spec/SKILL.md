---
name: proofline-implementation-spec
description: Create, revise, complete, cancel, or supersede durable implementation PRDs under .proofline/prds without implementing them. Use for implementation specifications, durable multi-task plans, or explicit invocation.
---

# Proofline Implementation Spec

Create a canonical product contract that lets a new task recover behavior, scope, and completion conditions without the originating conversation. Keep intent in the PRD, implementation activity in one native top-level task, and independent reviews in fresh subagents; create no project-local execution ledger or report copy.

Before reading or writing a PRD, read and apply `../proofline-baseline-quality/SKILL.md` completely. Do not auto-apply this skill to trivial wording, an obvious low-risk one-file change, or work without durable planning value; explicit invocation wins.

## Limits and target

Write PRD artifacts only under `.proofline/prds/`. Create no issue ledger, `STATE.md`, dashboard, execution state, or task-report file; modify no product code, tests, build files, or implementation documentation. Never promote assumptions without evidence, mark `ready` with a blocking decision, or delete, move, or rewrite a terminal PRD's product body.

Inspect enough `.proofline/prds/` front matter and bodies to identify IDs, goals, revisions, and statuses, then choose create, revise, operational edit, complete, cancel, or supersede. Prefer the same-goal active PRD (`draft | ready | blocked`) over duplication. Treat `completed | cancelled | superseded` as terminal; product changes after one require a new PRD. Link supersession only when replacing the old contract. Report non-unique targets without editing.

Use `.proofline/prds/<PRD-ID>-<slug>/PRD.md`. Allocate `PRD-0001` upward from the largest number in directory names and front matter; re-read the directory immediately before writing and never overwrite a collision. Use a short filesystem-safe kebab-case slug; fix the directory name and ID after creation. Store snapshots at `revisions/REV-<revision>.md`, create no global index, and use ISO 8601 timestamps with explicit UTC offsets.

## Contract

Create from `assets/templates/prd.md`; preserve its section order and replace every `{{...}}` placeholder. Serialize and parse the JSON front matter instead of inserting raw strings; escape quotes, backslashes, control characters, and line breaks.

Require integer `schema_version: 1`; `PRD-0001`-form `id`; stable human-readable `title`; `kind: feature | bug | refactor | exact_port | maintenance`; `status: draft | ready | blocked | completed | cancelled | superseded`; positive `revision` starting at `1`; `created_at`; `updated_at`; terminal timestamp or `null` in `archived_at`; PRD-ID array `supersedes`; replacing ID or `null` in `superseded_by`; and issue-ID array `related_issues`. Preserve unknown valid metadata on update; do not migrate solely for a missing newer optional convention.

Interpret statuses exactly: `draft` is incomplete or awaits a product decision; `ready` is executable and persists during implementation; `blocked` means a durable product decision, permission, or external prerequisite, never a temporary task/tool failure; `completed` means the current revision passed validation and independent review; `cancelled` means the user cancelled the contract; `superseded` means another PRD replaced it.

Use stable `REQ-001` and `AC-001` IDs; each acceptance criterion names the requirements it verifies.

## Authoring

- Inspect enough code, tests, configuration, and documentation to separate confirmed facts, assumptions, confirmed decisions, and open decisions. Claim no file, module, API, command, or behavior without inspection; cite stable repository evidence as `path:line`.
- State problem, observable behavior, goals, requirements, in/out scope, acceptance, validation, and completion evidence. Leave technical design open unless confirmed as a product constraint.
- Cover only material errors, empty states, and boundaries justified by explicit requirements, actual trust boundaries, or reachable paths in the inspected system. Address compatibility, data, security, migration, and rollback only when the change affects them. Use `N/A` instead of inventing requirements, and do not require downstream validation for an invariant already enforced by its owning boundary. Make required validation executable in-project or explain why no check can yet be defined.
- Use the user's language while preserving exact identifiers, paths, commands, model names, status values, and schema keys.
- Before recommending model and reasoning effort, read and apply `../proofline-start-implementation/assets/model-routing.md` completely. Record a concrete rationale; later explicit user choice prevails.

## Operations

**Create:** Investigate only enough for an executable contract; resolve facts, assumptions, decisions, scope, requirements, acceptance, and validation. Allocate the fixed ID/directory and write `revision: 1`. Use `ready` only after the ready gate; otherwise use `draft` or `blocked`. Report ID, path, revision, status, and remaining decisions, then stop without implementing.

**Major revision:** Treat changes to goal, user-visible behavior, requirement meaning, scope, acceptance/validation, compatibility/safety policy, or a blocker-resolving product decision as major. First copy the complete current PRD to `revisions/REV-<current revision>.md`; never overwrite a snapshot, and stop unchanged if it contains different content. Increment exactly once, apply the change, update `updated_at`, and recompute active status. Invalidate old-revision implementation/review evidence; send its tasks no further instructions and start a new chain only when authorized.

Do not increment revision for non-semantic typo/formatting, link or evidence-reference correction, related-issue or supersession linkage, timestamp, or lifecycle update; touch only affected content.

**Lifecycle:**

- Set `ready` only after its gate and `blocked` only for a durable product prerequisite. Resolve a blocker without revision when only evidence changes; revise when the contract changes.
- Set `completed` only when current project evidence and native history prove, for the same revision: every mandatory requirement and acceptance criterion is implemented; all required validation ran without required failure or omission; a fresh post-review subagent passed the latest implementation report sequence; and `proofline-completion-evidence` can report it. Then update `updated_at` and `archived_at`, freeze the body, and add no transcript.
- Set `cancelled` only when the user cancels the product contract, not one workflow; update `updated_at` and `archived_at` and preserve content.
- To supersede, add the old ID to the new `supersedes`; set the old `superseded_by`, status, `updated_at`, and `archived_at`; preserve its body and location.

## Ready and report

Set `ready` only when project and intended behavior are identifiable; requirements are consistent; every mandatory requirement has acceptance coverage; in/out scope is explicit; material errors and boundaries are covered; no open decision awaits user, permission, or external state; validation can run in-project; and known repository constraints are accurate.

Update a stale status or non-semantic detail directly; revise for a product decision or contract change. Never ask for implementation approval or implement. Finally report the operation; PRD ID, title, path, revision, and status; snapshot; confirmed decisions; remaining blockers; and that no implementation occurred.
