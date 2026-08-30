---
name: architecture-memory-update
description: Update or seed opted-in architecture memory from Git.
---

Explicit requests only.

## Results

Final line:

- `stopped`: `Architecture update stopped: <reason>; checkpoint <unchanged or unavailable>`
- `current`: `Architecture update: documents unchanged; checkpoint <short revision>`
- `ignored`: `Architecture update: documents unchanged; checkpoint <short unchanged revision>`
- `written`: `Architecture update: <changed documents or documents unchanged>; checkpoint <short revision>`

`current`/`stopped`/`ignored`: write nothing; keep the checkpoint.

## Preflight

One bounded preflight finds every `.architecture-memory/manifest.json` under `docs/**` and reads full `HEAD`, branch, and porcelain status. Before registered documents, require:

- exactly one schema-v2 `managed: true` manifest: required v2 fields, unique IDs/paths, nonnegative integer orders, and normalized relative `.md` paths resolving inside its architecture root and outside `.architecture-memory`;
- a clean worktree and committed `HEAD`;
- non-null revision to be a full 40/64-hex ID resolving to a commit.

Preflight failure: `stopped`; `revision == HEAD`: `current`. Both precede registered-document reads. `branch_at_check` is provenance; revision controls the diff.

## Seed

For `revision == null`, invent no base and skip history/diffs. From only the [initialization evidence pass](../architecture-memory-init/references/initialization.md#evidence-pass) and committed tree, reconcile every registered current-state document; never reconstruct ADR history. Incomplete classification is `stopped`; otherwise Write with fixes and checkpoint `HEAD`.

## Delta

Otherwise, from project root, one call runs `git diff --name-status --find-renames <checkpoint> <HEAD> -- .` plus a bounded statistic. A non-empty architecture-root-only range with both rename/copy paths inside is `ignored` before registered-document read. In mixed ranges, exclude root evidence and classify all other paths before Write.

Read hunks only for paths that may change system boundaries, containers, selected components, data/deployment boundaries, integrations, quality constraints, or explicit decision artifacts; batch relevant sections. Narrow truncation or ambiguity by exact path until all paths are classified; unresolved is `stopped`.

Update only affected current C4, Context, or selected L3 content in local form. A code delta cannot create an ADR; require this range to contain an explicit rationale-bearing decision record, or a decision established by the current user, then read [decision templates](../architecture-memory/references/decision-templates.md). For a non-ancestor checkpoint, use snapshot differences and infer no history from commit order.

## Write

After classifying every non-managed change and addressing each architecture effect, write affected documents and `git_checkpoint` once: `revision` = full `HEAD`; `branch_at_check` = current branch or detached `null`; `checked_at` = current ISO 8601 time. Reaching Write advances even without document edits. Keep document `verified_at` and `source_revision`; seeding never refreshes them. Successful write needs no validator/reread; return `written`.
