# Initialization evidence and content

`<workflow>` means `<plugin-root>/skills/architecture-memory/scripts/workflow.js`. Append `--project-root <project>` to each command. Reuse completed analysis and existing draft sections on resume.

## Evidence pass

Use `inventory` for directory counts, then `inventory --prefix <directory/>` or `--offset 0` for relevant paths. Trace entrypoints, runtime/storage units, integrations and deployment boundaries through representative code and existing documentation. Retrieve evidence with `source --path <path>`; it reads the captured commit even if the working tree or HEAD changes. `next_offset` exposes remaining lines; request only the continuation needed for the claim. Commands and recovery details are in [workflow](../../architecture-memory/references/workflow.md).

With no committed HEAD, the helper tracks observed working files and detects changes before publication; the checkpoint stays null. Later `architecture-memory-update` seeds the first committed baseline. Keep uncommitted implementation claims outside a committed baseline. User facts, requirements and accepted plans remain attributable conversation evidence.

Identify purpose, scope/non-goals, physical and organizational operating conditions, actors, external systems, responsibility and data boundaries, deployment, quality tradeoffs, consequential risks and unknowns. Code proves structure; record motives and accepted choices only from explicit decision evidence. A missing decision history stays unknown.

## Baseline

Use [recording](../../architecture-memory/references/recording.md) and [base templates](../../architecture-memory/references/base-templates.md) to fill the five documents already registered in the draft manifest: index, system context (C4 L1), containers (L2), current project context, and decision index. Tables/prose are authoritative; add Mermaid only for evidenced relationships.

Use [component templates](../../architecture-memory/references/component-templates.md) only where L2 cannot explain a material responsibility or risk boundary. Use [decision templates](../../architecture-memory/references/decision-templates.md) only for an established consequential choice with rationale. An empty decision index needs a statement that no supported ADR was found, not fabricated history.

Compose prose/headings in manifest `language`; retain fixed filenames, enums, C4 identifiers and manifest keys. Use C4 IDs for referenced `PER`, `SYS`, `EXT`, `CNT` and `CMP` nodes; retain existing IDs and never reuse retired IDs or ADR numbers.

Keep the generated manifest. To register another document, copy an existing entry and supply a unique stable ID, supported kind and normalized relative `.md` path within the draft; retain the six entry fields. Whole-document evidence review may set `verified_at` and `source_revision`; partial edits retain them. The helper validates registration and assigns the checkpoint during `apply`.

Initialization may establish a truthful baseline with important unknowns. State those unknowns beside affected claims; ask only when the answer is required for the pending work. Future conversation supplies additional context through ordinary memory capture.
