---
name: proofline-implementation-spec
description: Create, revise, complete, cancel, or supersede durable implementation PRDs under .proofline/prds without implementing them. Use when the user asks for an implementation specification or explicitly names this skill.
---

# Proofline Implementation Spec

Create the canonical product contract for an implementation request. A new Codex task must be able to understand the required behavior, scope, and completion conditions from the PRD without the conversation in which it was written.

The PRD stores durable product intent. One top-level Codex task stores implementation activity, and fresh review subagents store independent review activity. Do not add project-local execution ledgers or copies of task or subagent reports.

Before reading or writing a PRD, read `../proofline-baseline-quality/SKILL.md` completely and apply it to the investigation, artifact, and final report.

## Use and boundaries

Use this skill when the user asks to:

- create an implementation PRD
- document work that will span multiple tasks
- revise, complete, cancel, or supersede a Proofline PRD
- apply `proofline-implementation-spec`

Do not apply automatically to a trivial wording edit, an obvious low-risk one-file change, or work with no durable planning value. Explicit invocation always wins.

While using this skill:

- write PRD artifacts only under `.proofline/prds/`
- do not create the issue ledger, `STATE.md`, a dashboard, execution state, or task-report files
- do not modify product code, tests, build files, or implementation documentation
- do not turn assumptions into decisions without evidence
- do not mark a PRD `ready` while a blocking decision remains
- do not delete, move, or rewrite the product body of a terminal PRD

## Resolve the target

1. Resolve the repository root and inspect existing `.proofline/prds/` entries.
2. Read enough front matter and body content to identify IDs, goals, revisions, and statuses.
3. Decide whether to create, revise, make an operational edit, complete, cancel, or supersede.
4. Prefer revising an active PRD with the same goal over creating a duplicate.
5. Treat `draft`, `ready`, and `blocked` as active. Treat `completed`, `cancelled`, and `superseded` as terminal.
6. Create a new PRD for product changes after a terminal PRD. Link supersession only when the new contract replaces the old one.

If the target is not unique, report the ambiguity without editing.

## Path, ID, and metadata

Canonical path:

```text
.proofline/prds/<PRD-ID>-<slug>/PRD.md
```

- Allocate IDs from `PRD-0001` upward using the largest number found in directory names and front matter.
- Re-read the directory immediately before writing. Never overwrite a colliding path.
- Use a short filesystem-safe kebab-case slug.
- Keep the directory name and PRD ID fixed after creation.
- Store snapshots under `revisions/REV-<revision>.md`.
- Do not create a global index.
- Use ISO 8601 timestamps with an explicit UTC offset.

Create PRDs from `assets/templates/prd.md` and replace every `{{...}}` placeholder before saving. Populate JSON front matter through valid JSON serialization rather than raw string insertion. Escape quotes, backslashes, control characters, and line breaks, then parse the completed front matter as JSON before saving.

Required JSON front matter:

- `schema_version`: integer; currently `1`
- `id`: `PRD-0001` style identifier
- `title`: stable human-readable title
- `kind`: `feature | bug | refactor | exact_port | maintenance`
- `status`: `draft | ready | blocked | completed | cancelled | superseded`
- `revision`: positive integer beginning at `1`
- `created_at`, `updated_at`: timestamps
- `archived_at`: terminal-state timestamp or `null`
- `supersedes`: array of PRD IDs
- `superseded_by`: replacing PRD ID or `null`
- `related_issues`: array of issue IDs

Status meaning:

- `draft`: the contract is incomplete or still needs a product decision.
- `ready`: the contract is executable. It remains `ready` while native implementation tasks run.
- `blocked`: a durable product decision, permission, or external prerequisite prevents implementation. Temporary task or tool failures do not change PRD status.
- `completed`: the current revision passed validation and independent review.
- `cancelled`: the user cancelled the product contract.
- `superseded`: another PRD replaced the contract.

Preserve unknown valid metadata fields on update. Do not perform migration only because an older PRD lacks a newer optional convention.

## Body contract

Keep these sections in order:

1. Problem and Context
2. Confirmed Facts, Assumptions, and Decisions
3. Goals
4. Users and Usage Scenarios
5. Requirements
6. In Scope
7. Out of Scope
8. Constraints and Compatibility
9. Errors, Empty States, and Edge Cases
10. Acceptance Criteria
11. Verification Plan
12. Open Decisions
13. Recommended Implementation Settings
14. Repository Evidence and Related Items

Use stable `REQ-001` requirement IDs and `AC-001` acceptance IDs. Each acceptance criterion must identify the requirements it verifies.

## Investigation and writing

- Inspect enough code, tests, configuration, and documentation to separate facts from assumptions.
- Record repository evidence as `path:line` when stable references are available.
- Separate confirmed facts, assumptions, confirmed decisions, and open decisions.
- State the problem, observable behavior, included and excluded scope, and completion evidence.
- Keep technical design open unless a choice is a confirmed product constraint.
- Do not claim a file, module, API, command, or behavior exists unless inspected.
- Cover errors, empty states, boundaries, compatibility, data, security, migration, and rollback when relevant.
- Make required validation executable in the project or state why a check cannot yet be defined.
- Use the user's language for prose while preserving exact identifiers, paths, commands, model names, status values, and schema keys.
- Before recommending a model and reasoning effort, read `../proofline-start-implementation/assets/model-routing.md` completely and apply it as the source of truth.
- Treat the recommendation as guidance; a later explicit user choice takes precedence.

## Create

1. Investigate only as much as needed for an executable contract.
2. Resolve facts, assumptions, decisions, scope, requirements, acceptance criteria, and validation.
3. Allocate the ID and fixed directory.
4. Write `PRD.md` with `revision: 1`.
5. Set `ready` only when the ready gate passes. Otherwise use `draft` or `blocked` according to the status definitions.
6. Report the ID, path, revision, status, and remaining decisions.
7. Stop without implementing.

## Revise

A major revision changes the goal, user-visible behavior, requirement meaning, scope, acceptance or validation, compatibility or safety policy, or the product decision used to resolve a blocker.

For a major revision:

1. Copy the complete current `PRD.md` to `revisions/REV-<current revision>.md` before editing.
2. Never overwrite a snapshot. If the path exists with different content, stop without changing the PRD.
3. Increment `revision` by exactly one.
4. Apply the change, update `updated_at`, and recompute `draft`, `ready`, or `blocked`.
5. Treat implementation and review evidence for the old revision as invalid for the new revision.
6. Send no further implementation or review instructions to tasks bound to the old revision. Start the new revision under a new chain only when authorized.

Do not increment revision for a non-semantic typo or formatting correction, link correction, related-issue linkage, timestamp or lifecycle update, evidence-reference correction, or supersession linkage. Change only the affected fields or text.

## Lifecycle

### Ready and blocked

Set `ready` when the ready gate passes. Set `blocked` only for a durable product prerequisite. If a blocker is resolved without changing the contract, update its evidence and set `ready` without a revision. If the resolution changes the contract, perform a major revision.

### Complete

Set `completed` only when current project evidence and native task history establish, for the same revision, that:

- every mandatory requirement and acceptance criterion is implemented
- every required validation ran and no required failure or omission remains
- a fresh post-implementation review subagent gave the latest implementation report sequence `pass`
- the result can be reported under `proofline-completion-evidence`

Then update `updated_at` and `archived_at` and freeze the body. Do not copy task transcripts into the PRD.

### Cancel and supersede

Set `cancelled` only when the user cancels the product contract; ending one implementation workflow is not enough. Update `updated_at` and `archived_at` and preserve the content.

When a new PRD replaces an old one, add the old ID to the new `supersedes`, set the old `superseded_by`, mark the old PRD `superseded`, update its timestamps, and preserve its body and location.

## Ready gate

A PRD may be `ready` only when:

- the target project and intended behavior are identifiable
- requirements do not contradict one another
- every mandatory requirement has acceptance coverage
- included and excluded scope are explicit
- material errors and boundary conditions are addressed
- no open decision requires a user, permission, or external state before implementation
- the validation plan can run in the project
- known repository constraints are represented accurately

If only a stale status or non-semantic detail prevents readiness, update it. If readiness requires a product decision or contract change, write that change through the revision rules. Do not ask for implementation approval; this skill does not start implementation.

## Final report

Report the operation, PRD ID and title, canonical path, revision, status, any snapshot created, confirmed decisions, remaining blockers, and that no implementation was performed.
