---
name: proofline-start-implementation
description: Start or resume a Proofline PRD with one persistent implementation task, optional risk pre-review, and fresh post-review. Complete only after the latest report passes.
---

# Proofline Start Implementation

Coordinate one PRD revision:

```text
optional pre-review -> persistent implementation task -> fresh post-review
changes_required -> same task -> fresh post-review
```

The request authorizes that revision. Keep intent in the PRD and reports in task history; create no local artifacts.

## Rules

- Coordinate only: modify no product code/tests and supply no verdict.
- Use one writable top-level task per revision, created with `create_thread` and followed up through `send_message_to_thread`; never use `spawn_agent` for implementation. Reviewers are fresh read-only subagents that never control/message it. Never simulate roles, run subprocess agents, or create top-level review tasks.
- If orchestration, history, follow-up, or model selection is unavailable, stop without changing PRD status.

## Target and chain

Resolve one `.proofline/prds/<PRD-ID>-*/PRD.md`; validate identity, schema, revision, contract, status, project, and validation. Proceed only with `ready`. Route `draft | blocked` through `proofline-implementation-spec` unless only lifecycle metadata is stale; reject terminal PRDs.

Chain key: `proofline_<lowercase PRD ID with hyphens replaced by underscores>_r<revision>`. Use these exact prompt-first-line and task/subagent names:

```text
<chain_key>_pre_review_<two-digit attempt>
<chain_key>_implementation
<chain_key>_post_review_<two-digit attempt>
```

Query only exact names/latest results. Stop on duplicate implementation tasks. Reuse pre-review `pass` only while revision/facts remain current; number every post-review and resume the first incomplete step.

## Run

Choose each role through `assets/model-routing.md`; fill only its matching `references/*-prompt.md`. Use the user's language and only request overrides absent from PRD/repository. In implementation prompts, omit empty optional lines and do not repeat project identity, model settings, or automatic repository instructions; use `none` only where review templates require it.

**Pre-review:** Run only when explicitly requested or the PRD/request already identifies difficult design uncertainty or security/data/migration/deployment/rollback/external-contract risk. Otherwise implement directly. On `block` or no verdict, create no task; revise the contract or report missing evidence. Set `blocked` only for a durable product prerequisite.

**Implementation:** Create/resume the chain task. When needed, invoke only: `proofline-scope-integrity` for large/risky work, `proofline-refactor-proof` for `refactor`, `proofline-exact-port` for `exact_port`, and `proofline-issue-ledger` for durable out-of-scope work. Use each exact `$...` mention instead of listing skill names as context; omit the line when none apply. Include only material pre-review findings. Before review, return incomplete evidence once to the same task.

**Post-review:** Review only the latest report. On `changes_required`, send blocker/major and relevant minor findings to the same task; require verified fixes/affected checks, then use a fresh reviewer. No verdict counts but cannot complete.

Allow three post-review attempts total, including the first and no-verdict reports. If attempt three does not `pass`, stop; resume only explicitly. Reviewer spawn failures do not count.

After task creation/follow-up, end the turn; do not monitor or call `wait_threads` because the task reports back.

## Finish

- Never auto-rollback; correct through the same task. Roll back only its changes by user request/PRD procedure. On stop, report paths, failed/unrun checks, findings, and next action.
- Complete only when all REQs/ACs hold, required validation has no failure/omission, fresh post-review passed the latest report, and every role names the revision. Set `completed`, update timestamps, freeze the body, and report settings, task refs, files, checks, blockers, and verdict without transcripts.
- On revision change, stop the old chain and reuse no report; start the new chain only when authorized. Orchestration failure does not alter PRD status.
- On workflow cancellation, stop new work and report changes/validation; set `cancelled` only for product-contract cancellation.
