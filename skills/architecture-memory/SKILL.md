---
name: architecture-memory
description: Maintain an opted-in project's architecture memory when work changes or settles system boundaries, containers, component contracts, data or deployment boundaries, quality constraints, architectural plans, or decisions, including context-only changes. Skip local implementation, renames, temporary debugging, brainstorming, and already-recorded context.
---

# Architecture Memory

Before architecture-specific tools, decide from the current request and inspected work whether both conditions hold:

1. the work is within the description's architecture scope;
2. it produced long-lived architecture context worth preserving as `confirmed`, `inferred`, `proposed`, `unknown`, or `planned`.

If either fails, finish with no architecture-memory read or write. Otherwise reuse current task evidence and make one bounded operation that first finds and checks every manifest under `docs/**`. Only when exactly one has a supported `schema_version` and `managed: true` may that operation return the target heading or referenced IDs. A missing or ambiguous manifest, `managed: false`, or unsupported `schema_version` ends without reading a managed document or writing.

The manifest is under the selected architecture root at `.architecture-memory/manifest.json`. It owns only its registered documents and its `language` governs document headings and prose. This conversational maintenance never advances `git_checkpoint`; committed-range reconciliation belongs to explicit `architecture-memory-update`. Read [the document contract](references/document-contract.md) completely for structural changes, a new ADR, or unfamiliar formatting. Read only the matching template branch: [base documents](references/base-templates.md) for their structure, [components](references/component-templates.md) for a new L3 document, or [decisions](references/decision-templates.md) for a new ADR. Ordinary patches use the existing document's local form without loading templates.

Update the existing canonical item in place; otherwise add one row or list item. Keep tables and Mermaid consistent in the same patch when their shared relationship changes. Use one write call, then accept its success result without a validator or reread. Partial patches retain `verified_at` and `source_revision`; change them only after the whole document's evidence was re-established.

Unmarked content is `confirmed/current`. Mark `inferred`, `proposed`, `unknown`, or `planned` content with evidence beside the affected item; for a table row, put the keyed annotation immediately below that table. C4 and Context describe current architecture and explicitly marked target states. ADRs preserve decision-time context and rationale; create one only for an explicitly established architecture decision, and supersede an accepted ADR with a new ADR instead of rewriting its historical fields.

Do not record failed or reverted implementation, easily regenerated code detail, or duplicate meaning. Remove resolved questions, ended risks, and obsolete current descriptions; preserve decision history only when it belongs in an ADR. Code changes are not required for a confirmed architecture update.

When a write occurs, add exactly one compact final line: `Architecture: <changed documents>`. Say nothing about architecture memory when no write occurs.
