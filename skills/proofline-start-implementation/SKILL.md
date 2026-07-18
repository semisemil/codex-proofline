---
name: proofline-start-implementation
description: Start or resume implementation of a Proofline PRD through one persistent top-level implementation task and fresh independent review subagents. Complete only after the latest implementation report passes independent post-review.
---

# Proofline Start Implementation

Coordinate one canonical Proofline PRD through a hybrid topology. The current task is the coordinator; one persistent writable top-level task implements the exact PRD revision, and fresh read-only subagents review it before and after implementation.

The PRD stores product intent. Native Codex task history stores execution and review reports. Do not duplicate task transcripts in project files.

Before coordinating, read `../proofline-baseline-quality/SKILL.md` and `assets/model-routing.md` completely. Before the final report, also read `../proofline-completion-evidence/SKILL.md` completely.

An explicit request to implement a PRD authorizes that exact revision. Do not ask for the same approval again.

## Topology

```text
coordinator -> fresh pre-review subagent -> coordinator -> top-level implementation task -> coordinator -> fresh post-review subagent -> coordinator
```

On `changes_required`:

```text
post-review subagent -> coordinator -> same implementation task -> coordinator -> new post-review subagent
```

Only the coordinator creates the implementation task, spawns review subagents, and sends follow-ups. Review subagents never control or message the implementation task.

## Boundaries

- The coordinator does not modify product code or tests and does not replace independent review with its own verdict.
- Use one native top-level Codex task for implementation and native subagents for review. Do not simulate either role, use local subprocess agents, or create top-level review tasks.
- Use one implementation task for one PRD revision. Reuse it for every correction.
- Spawn every review subagent with no forked conversation history. Give it only its compact role contract, exact paths, current constraints, selected model, and reasoning effort. For post-review, also include the latest complete implementation report exactly once; a task ID is identity evidence but may not be readable from a subagent.
- Spawn a fresh subagent for every post-review attempt. Never reuse a reviewer after it returns a verdict.
- Keep implementation and review reports in native task and subagent responses. Do not create project-local report copies or execution ledgers.
- If implementation-task creation, subagent spawning, model selection, task history, or follow-up messaging is unavailable, stop and report the workflow as blocked.

## Resolve and gate the PRD

Accept a canonical path or resolve an ID to exactly one:

```text
.proofline/prds/<PRD-ID>-*/PRD.md
```

Confirm path/front-matter ID agreement, project identity, supported `schema_version`, positive `revision`, required sections, and a valid status.

- `ready`: proceed.
- `draft`: set `ready` only when the existing contract already passes the ready gate and only the status is stale. Otherwise use `proofline-implementation-spec` first.
- `blocked`: verify the blocker. Set `ready` only when an external prerequisite was resolved without changing the contract. Revise the PRD first when requirements, scope, acceptance, validation, or policy changes.
- `completed`, `cancelled`, or `superseded`: do not start.

The PRD remains `ready` while tasks run. Confirm required project files and validation entry points are inspectable before creating a task.

## Identity and resumption

Use this chain key for the exact revision:

```text
proofline_<normalized_prd_id>_r<revision>
```

Lowercase the PRD ID and replace hyphens with underscores. Use these exact keys as the first prompt line and task or subagent name:

```text
<chain_key>_pre_review_<two-digit attempt>
<chain_key>_implementation
<chain_key>_post_review_<two-digit attempt>
```

Inspect native task history and the coordinator's prior subagent results before creating anything.

- Never create a second implementation task for the same revision.
- Reuse a prior pre-review subagent `pass` only while its revision and inspected project facts remain current.
- Use a new post-review subagent and the next attempt number for every review.
- If multiple implementation tasks exist and authority is unclear, stop and report the conflict.
- Ignore results from another revision.

Resume the first incomplete step: valid pre-review `pass`, implementation report, post-review of the latest report, correction when required, then completion.

## Model routing

Use `assets/model-routing.md` as the source of truth. Select implementation and each review independently. Explicitly set the model and reasoning effort when spawning each review subagent; do not inherit the coordinator's model accidentally. Put the selected setting and short rationale in the task or subagent input without repeating the routing table.

## Compact task prompts

Read only the reference for the task or subagent being created, fill every placeholder, and send the filled prompt without extra duplicated instructions:

- pre-review: `references/pre-review-prompt.md`
- implementation: `references/implementation-prompt.md`
- post-review: `references/post-review-prompt.md`

For review subagents, use a no-history spawn. Pass paths instead of copying the PRD or coordinator conversation. For post-review, read the latest implementation-task response and include that complete report exactly once in `<implementation_report_text>`; do not assume the subagent can read another top-level task. Use the user's language as `<output_language>`. Remove inapplicable optional values rather than leaving placeholders. The prompt contracts preserve required identity, permissions, verdict rules, evidence, and report fields while avoiding repeated content.

## Pre-review result

- `pass`: continue.
- `block`: create no implementation task. Use `proofline-implementation-spec` when the contract needs revision. Set PRD status `blocked` only for a durable user decision, permission, or external prerequisite.
- no verdict: create no implementation task. Report unavailable material and the next action. Do not change a `ready` PRD solely because review access was insufficient.

## Implementation report

Create or resume the chain's implementation task. Apply `proofline-baseline-quality` always, `proofline-scope-integrity` for large or risky work, `proofline-refactor-proof` for `kind: refactor`, `proofline-exact-port` for `kind: exact_port`, and `proofline-issue-ledger` only for durable out-of-scope work.

Before post-review, confirm the report names the exact PRD revision and sequence, lists every changed path, explains file-level behavior, and reports passed, failed, and unrun checks. If incomplete, send one corrective follow-up to the same task. Stop if adequate evidence still cannot be obtained.

## Post-review and corrections

Review only the latest implementation report sequence.

- `pass`: evaluate the completion gate.
- `changes_required`: send blocker and major findings plus relevant minor findings to the same implementation task. Require it to verify findings, fix valid issues, rerun affected checks, and return the next complete report sequence. Then spawn a new post-review subagent.
- no verdict: count the attempt, report unavailable evidence, and do not complete.

Spawn at most three post-review subagents automatically, counting verdict and no-verdict reports. A spawn failure does not consume an attempt but blocks the workflow. After three attempts without `pass`, stop and report unresolved findings and observed validation. Continue later only on an explicit user request, using the same implementation task.

## Failure and rollback policy

Do not roll back automatically when implementation, validation, or review fails. Keep the current changes and use the same implementation task for in-scope corrections. When the workflow stops, report changed paths, failed or unrun checks, unresolved findings, and the next action.

Rollback requires an explicit user request or a rollback procedure already approved in the PRD. Limit rollback to changes made by the implementation task and never discard unrelated user work.

## Completion

Complete only when, for the exact current revision:

1. every mandatory requirement and acceptance criterion is implemented;
2. every required validation ran with no required failure or omission;
3. the latest implementation report sequence has `pass` from a fresh post-review subagent;
4. the implementation task and every review subagent in the chain still name the same revision;
5. the result can be reported under `proofline-completion-evidence`.

Then set PRD status `completed`, update `updated_at` and `archived_at`, freeze the body, and report the selected settings, task references, changed files, validation, omissions, and final verdict. Do not copy task transcripts into the PRD.

## Revision, blocking, and cancellation

If the PRD revision changes, stop the old chain. Do not send further instructions to its implementation task, spawn more review subagents, or reuse its reports. Start the new revision only when the current user request authorizes it.

A transient orchestration failure does not change PRD status. Set `blocked` only for a durable product decision, permission, or external prerequisite; revise through `proofline-implementation-spec` when resolving it changes the contract.

On explicit workflow cancellation, create no task or subagent and send no follow-up. Report existing changes and validation. Leave the PRD `ready` or `blocked` according to its contract. Set `cancelled` only when the user also cancels the product contract.
