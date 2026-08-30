---
name: architecture-memory
description: Maintain opted-in architecture memory for durable project context.
---

Use only when the request or inspected work establishes durable architecture context worth keeping as `confirmed`, `inferred`, `proposed`, `unknown`, or `planned`. Otherwise do not read or write architecture memory.

## Gate

Find every `docs/**/.architecture-memory/manifest.json` in one bounded operation. Before any registered-document read, require exactly one schema-v2 `managed: true` manifest; all v2 manifest, checkpoint, and document fields; unique IDs and paths; non-negative integer orders; and normalized relative `.md` paths resolving inside the architecture root and outside `.architecture-memory`. Otherwise stop without a managed-document read or write.

The manifest owns only registered documents; `language` controls their headings and prose. Never advance `git_checkpoint`; explicit `architecture-memory-update` owns committed-range reconciliation.

## Patch

Patch the canonical item; if none exists, add one row or list item. Keep a table and its Mermaid view consistent in the same patch.

Follow local form for ordinary patches. Load only the matching template: [base documents](references/base-templates.md) for a structural base-document change, [components](references/component-templates.md) for a new L3 document, or [decisions](references/decision-templates.md) for a new ADR.

Unmarked content is `confirmed/current`. Put other states and their evidence beside the affected item. Current documents hold current state and explicitly marked target state. Create an ADR only for an explicitly established decision; supersede an accepted ADR with a new ADR instead of rewriting its historical fields.

Record neither failed or reverted work, regenerable code detail, nor duplicate meaning. Remove resolved questions, ended risks, and obsolete current descriptions. Code changes are not required.

Write once and accept success without validation or reread. Partial patches retain `verified_at` and `source_revision`; change them only after a whole-document evidence review.

When a write occurs, add exactly one compact final line: `Architecture: <changed documents>`. Say nothing about architecture memory when no write occurs.
