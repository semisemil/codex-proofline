---
name: architecture-memory-update
description: Reconcile opted-in architecture memory through committed Git changes since its checkpoint.
---

# Architecture Memory Update

Run only on an explicit user request.

## Preflight

In one bounded operation, find every `.architecture-memory/manifest.json` under `docs/**`, select exactly one managed schema-v2 manifest, and inspect the repository's full `HEAD`, current branch, and porcelain status. The Git worktree must be clean, and the checkpoint revision must be non-null and resolve to a commit. A failed condition ends without reading managed documents or writing: `Architecture update stopped: <reason>; checkpoint <unchanged or unavailable>`. When the checkpoint equals `HEAD`, end without a document read or write: `Architecture update: documents unchanged; checkpoint <short revision>`. `branch_at_check` is provenance only; the checkpoint revision is the diff authority.

## Reconcile

Compare committed snapshots with `git diff --name-status --find-renames <checkpoint> <HEAD> -- .` from the project root. Include a bounded diff statistic in the same call. Classify every changed project path before advancing the checkpoint; exclude the managed architecture root from code evidence.

Read hunks only for paths that may change system boundaries, containers, selected components, data or deployment boundaries, integrations, quality constraints, or explicit decision artifacts. Batch those hunks with the relevant current document sections. If output is truncated or a path remains ambiguous, narrow by exact paths until every change is classified. An unclassifiable range ends with the stopped result and no write.

Update only the current C4, Context, or selected L3 items affected by the final committed state, following each document's local form. Read [the document contract](../architecture-memory/references/document-contract.md) only before a structural document change or unfamiliar formatting. A code delta alone cannot create an ADR; create one only when the range contains an explicit decision record with its rationale or the current user establishes the decision, then read [the decision templates](../architecture-memory/references/decision-templates.md) before writing it. When the checkpoint is not an ancestor of `HEAD`, use the snapshot difference for current state and make no historical inference from commit order.

## Complete

After every committed change is classified and every architecture effect is addressed, update the affected documents and `git_checkpoint` in one write. Set `revision` to full `HEAD`, `branch_at_check` to the current branch or `null` for detached HEAD, and `checked_at` to the current ISO 8601 time. Advance the checkpoint even when no document content changes, preventing the same range from being scanned again.

Delta reconciliation retains document `verified_at` and `source_revision`; those fields require a whole-document evidence review. End a successful write with one line: `Architecture update: <changed documents or documents unchanged>; checkpoint <short revision>`.
