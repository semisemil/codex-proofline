# Design document operations

Use `.proofline/designs/DESIGN-0001-<slug>/DESIGN.md`. Preserve identity and location; never overwrite an ID collision. The body is free-form. Frontmatter is JSON between Markdown `---` delimiters:

```json
{
  "schema_version": 2,
  "id": "DESIGN-0001",
  "title": "Stable title",
  "kind": "feature",
  "status": "draft",
  "revision": 1,
  "supersedes": [],
  "superseded_by": null,
  "related_issues": []
}
```

Kinds: `feature | bug | refactor | exact_port | maintenance`. Status: `draft | ready | blocked | completed | cancelled | superseded`. `related_issues` contains explicit `PL-*` targets only; apply [work links](../../issue-ledger/references/work-link.md) for those targets.

Write complete UTF-8 Markdown on stdin to:

```text
node <plugin-root>/writers/document-writer.js write --kind design --project-root <absolute-project-root> --relative-path <project-relative-design-path> --language <document-language>
```

Add `--memory off` when recording is prohibited for this request. Existing disabled project settings remain authoritative. Writer results separate `write`, `registration`, and `memory`; a partial result is not an all-or-nothing failure. An unchanged save may finish an interrupted Memory connection without rewriting the Design.

## Revision and completion

For an existing body/contract change add `--change-kind major`, increment revision once, and reassess readiness. The writer snapshots the old document in `revisions/REV-<revision>.md`. Preserve existing `supersedes` links. Use `operational` for status/link changes, preserving the body and revision. Identical content is a no-op.

Complete only when current verification establishes every required condition for the final revision. Previous checks may be reused for unchanged code and requirements after confirming their applicability; the old revision's completion label alone is insufficient. A status request does not start verification. Cancel only when requested. A replacing Design declares the previous ID in `supersedes`; the shared resolver derives the previous document's effective superseded state without rewriting legacy files.

## Legacy succession

Existing Plans and Specs remain readable. An unsuperseded ready Spec may still be implemented directly; complete it through `--kind spec` with its original path/body/revision and `--change-kind operational`.

For requested new design work on a legacy Plan/Spec, resolve its latest active successor before editing. Create or revise one Design containing the current applicable contract and consequential decisions; put each document it replaces in `supersedes` and link the original for provenance. Replacing a legacy contract changes the active source immediately, even while the new Design is draft. Do not batch-convert or delete unrelated documents, or copy old readiness without evaluating the current requirements.

Readiness and successor checks for execution use:

```text
node <plugin-root>/dashboard/records/development-contracts.js --project-root <project> --id <DESIGN-ID-or-legacy-SPEC-ID>
```

Conflicting successors and cycles require reconciliation, not arbitrary selection. Implementers and the dashboard use the same successor interpretation. Detailed contracts belong in this Design; Architecture Memory keeps only durable context with links.
