# Initialization

## Preflight

Before repository analysis or template reads, inspect the default architecture root and find every `docs/**/.architecture-memory/manifest.json` in one bounded search. If neither a manifest nor a conflicting documentation system exists, use `docs/architecture/`.

Do not implicitly overwrite or reorganize an existing architecture collection. On conflict, stop before analysis and ask whether to integrate, use another root under `docs/`, or leave it unchanged.

For a supported manifest:

- `managed: true`: report that the project is initialized, then stop; ordinary changes belong to `architecture-memory`.
- `managed: false`: validate registered paths with the Manifest rules before opening them, confirm file compatibility, read registered files but no templates, change only `managed` to `true`, run registration below, report compactly, then stop.

A malformed, unsupported, or ambiguous manifest stops without analysis or write. There is no migration workflow.

## Evidence pass

Start with repository instructions, existing documentation, and a bounded file map. Narrow from build and package configuration to entry points, runtime or deployment units, data stores, integrations, representative tests, and architecture-sensitive areas. Exclude generated output, dependencies, vendor trees, caches, and large data files unless they directly evidence architecture.

Batch independent reads and return only boundary evidence. Reuse current-task evidence. Distinguish confirmed facts, evidence-backed inferences, accepted plans, and unknowns.

Do not invent or interview for missing intent; record it in the relevant `Open questions` section. Reconstruct neither historical rationale nor retrospective ADRs from code.

## Baseline

After the evidence pass, read [the base templates](../../architecture-memory/references/base-templates.md). Read [the component templates](../../architecture-memory/references/component-templates.md) only when selecting L3, and [the decision template](../../architecture-memory/references/decision-templates.md) only when an ADR is warranted.

Create a compact baseline:

- `README.md`, C4 L1 `01-system-context.md`, C4 L2 `02-containers.md`, `04-context.md`, and `decisions/README.md`;
- L1 and L2 Mermaid diagrams only when the recorded relationships have sufficient evidence;
- `components/README.md` and one document per selected container only when L2 cannot explain a material responsibility or risk boundary;
- an ADR only for a decision explicitly established by available decision records or the current conversation;
- `.architecture-memory/manifest.json` with every document owned by this architecture memory and the committed Git checkpoint.

Tables and prose are authoritative; Mermaid is secondary. Use the conversation language for titles and prose, store its BCP 47 tag in manifest `language`, and keep fixed identifiers, enum values, filenames, and manifest keys in English.

Use C4 IDs only for referenced `PER`, `SYS`, `EXT`, `CNT`, and `CMP` nodes. Reuse neither removed C4 IDs nor ADR numbers. Record repository-relative source paths and prefer symbols over line numbers.

For a Git worktree with committed `HEAD`, set `git_checkpoint.revision` to its full object ID, `branch_at_check` to the current branch or detached `null`, and `checked_at` to the current ISO 8601 time. This covers committed history through `HEAD`; working-tree evidence may inform the baseline but is outside the checkpoint. Without committed `HEAD`, set all three fields to `null`. After the first commit, explicit `architecture-memory-update` reconciles the current committed state once and fills the checkpoint.

## Manifest

Use exactly this schema-v2 shape:

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

Use only these kinds: `index`, `system-context`, `containers`, `component-index`, `component`, `context`, `decision-index`, and `decision`. IDs are stable, unique, and match `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`. Paths are unique, normalized relative `.md` paths inside the architecture root; reject absolute paths, backslashes, empty, `.`, `..`, and `.architecture-memory` segments. Existing symlinks or junctions must resolve inside the root. `order` is a non-negative integer. `verified_at` is `null` or the ISO 8601 time of a whole-document evidence review; `source_revision` is `null` or the full Git revision covered by that review. Partial updates preserve both.

## Write and register

Render the complete set, then create it in one batched write. After success, do not validate or reread.

Resolve `<plugin-root>` from this skill's `SKILL.md`, then run from the project root:

~~~text
node <plugin-root>/dashboard/register-project.js register --project-root <absolute-project-root>
~~~

Registration is a separate result. Keep the created memory if it fails and report the failure compactly. Report success compactly.
