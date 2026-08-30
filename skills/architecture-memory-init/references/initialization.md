# Initialization procedure

## Preflight

Inspect the default architecture root and run one bounded manifest search under `docs/**` before repository analysis or template reads. Use `docs/architecture/` when no manifest or conflicting documentation system exists.

Never overwrite or reorganize an existing architecture collection implicitly. On a documentation conflict, stop before analysis and ask the user to choose whether to integrate with the existing collection, use another root under `docs/`, or leave it unchanged.

If a supported manifest exists with `managed: true`, report that the project is initialized; ordinary updates belong to `architecture-memory`. If it has `managed: false`, an explicit initialization request authorizes reactivation: read the contract, confirm its registered files remain compatible, change only `managed` to `true`, and register the project. A malformed, unsupported, or ambiguous manifest stops without analysis or a write. There is no migration workflow.

## Evidence pass

Start with repository instructions, existing documentation, and a bounded file map. Narrow from build and package configuration to entry points, runtime or deployment units, data stores, external integrations, representative tests, and architecture-sensitive areas. Exclude generated output, dependencies, vendor trees, caches, and large data files unless they are direct architecture evidence.

Batch independent reads and return only excerpts needed to establish boundaries. Reuse evidence already inspected in the current task. The baseline must distinguish confirmed facts, evidence-backed inferences, accepted plans, and unknowns.

Do not interview for missing intent during initialization. Put material gaps in the relevant `Open questions` section. Do not reconstruct historical rationale or create retrospective ADRs from code.

## Baseline

Create:

- `README.md`, C4 L1 `01-system-context.md`, C4 L2 `02-containers.md`, `04-context.md`, and `decisions/README.md`;
- L1 and L2 Mermaid diagrams only when the recorded relationships have sufficient evidence;
- `components/README.md` and one document per selected container only when L2 cannot explain a material responsibility or risk boundary;
- an ADR only for a decision explicitly established by available decision records or the current conversation;
- `.architecture-memory/manifest.json` with every document owned by this architecture memory and the committed Git checkpoint.

Keep tables and prose authoritative; Mermaid is a secondary view. Use the user's conversation language for document titles and prose, and store its BCP 47 tag in manifest `language`. Keep fixed identifiers, enum values, file names, and manifest keys in English.

Use C4 IDs only for referenced nodes: `PER`, `SYS`, `EXT`, `CNT`, and `CMP`. Reuse neither removed C4 IDs nor ADR numbers. Record source paths relative to the repository and prefer symbols over line numbers.

When the project is a Git worktree with a committed `HEAD`, set `git_checkpoint.revision` to its full object ID, `branch_at_check` to the current branch or `null` for detached HEAD, and `checked_at` to the current ISO 8601 time. The checkpoint means committed history through `HEAD` was covered; working-tree evidence may inform the baseline but is not part of that checkpoint. When no committed Git `HEAD` exists, set all three checkpoint fields to `null`.

## Write and register

Render the complete file set first, then create it in one batched write operation. A successful write result is sufficient; do not add a validation or reread call.

Resolve `<plugin-root>` from this skill's `SKILL.md`, then run from the project root:

~~~text
node <plugin-root>/dashboard/register-project.js register --project-root <absolute-project-root>
~~~

Registration is a separate result. Keep the created architecture memory when registration fails and report the failure compactly.
