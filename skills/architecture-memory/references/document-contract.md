# Architecture memory contract

Read this contract for initialization, document-structure changes, new ADRs, or unfamiliar formatting. Ordinary content patches follow the target document directly.

## Manifest

The manifest is `.architecture-memory/manifest.json` inside the architecture root. Document paths are relative to that root. Its complete schema is:

```json
{
  "schema_version": 2,
  "managed": true,
  "language": "ko",
  "git_checkpoint": {
    "revision": "0123456789abcdef0123456789abcdef01234567",
    "branch_at_check": "main",
    "checked_at": "2026-08-30T00:00:00.000Z"
  },
  "documents": [
    {
      "id": "architecture-index",
      "kind": "index",
      "path": "README.md",
      "order": 10,
      "verified_at": null,
      "source_revision": null
    }
  ]
}
```

Every document has exactly `id`, `kind`, `path`, `order`, `verified_at`, and `source_revision`. IDs are stable and unique. Orders are numeric and determine display order. `language` is the BCP 47 tag of the initialization conversation language and governs later headings and prose; `"ko"` above is only an example. `verified_at` is `null` or an ISO 8601 timestamp for a whole-document evidence review. `source_revision` is `null` or the source revision checked in that review.

`git_checkpoint` applies to the document set, not one document. It has exactly `revision`, `branch_at_check`, and `checked_at`. A populated `revision` is a full 40- or 64-hex Git commit object ID; `branch_at_check` is the branch observed at that check and is never a diff authority; `checked_at` is an ISO 8601 time. All three values are `null` when no committed Git checkpoint exists. Explicit `architecture-memory-update` advances the checkpoint only after classifying the complete committed project delta through the new revision. Conversational patches and partial document reviews retain it.

Allowed kinds:

- `index`: architecture entry point;
- `system-context`: C4 L1;
- `containers`: C4 L2;
- `component-index`: selected L3 index;
- `component`: one container's selected C4 L3;
- `context`: architecture-affecting goals, constraints, qualities, principles, terms, plans, assumptions, risks, and questions;
- `decision-index`: ADR index;
- `decision`: one ADR.

The manifest lists only documents owned by this architecture memory. It is not an integration, migration, or external-tool contract.

## Root discovery

The default root is `docs/architecture/`, but initialization may select another root under `docs/`. When the root is not already known, use one bounded path-only search under `docs/**` for `.architecture-memory/manifest.json`. Exactly one supported manifest selects its parent architecture root. None ends without a write; more than one is a conflict and also ends without a write. Never search outside `docs/` for implicit maintenance.

## Canonical responsibility

- `README.md` is navigation, not a summary copy.
- C4 and `04-context.md` hold current state and explicitly marked target states.
- Component documents exist only where L2 cannot explain a material responsibility or risk boundary.
- ADRs preserve the context, decision, consequences, alternatives, and evidence at decision time. The decision index links each ADR to the current C4 or Context effect.
- Detailed product plans remain in their own documents; Context links to them and keeps only architecture consequences.

Tables and prose are canonical. Mermaid mirrors evidenced relationships and remains optional when evidence is insufficient. Stable C4 IDs use `PER`, `SYS`, `EXT`, `CNT`, or `CMP`; ADR IDs use `ADR`. Context items have no IDs.

Unmarked content means `confirmed/current`. Exceptional content uses `inferred`, `proposed`, `unknown`, or `planned` beside the affected item with its evidence or needed confirmation. A table annotation sits immediately below its table and names the affected stable ID or exact statement. Current-state documents retain current information and explicitly marked target states.
