# Proofline PRD to Spec migration

Copy the prompt below into a Codex task opened at the project root. The current Proofline plugin ignores `.proofline/prds/**`; run this prompt only when that project should expose its legacy contracts as Specs. The migration leaves every source PRD unchanged.

```text
Migrate every legacy Proofline PRD in this current project from `.proofline/prds/**` to Proofline Spec v2 under `.proofline/specs/**`.

Scope and safety:
- Treat `.proofline/prds/**` as read-only. Do not edit, move, rename, or delete any source file or directory.
- Modify only `.proofline/specs/**`. Do not change product code, tests, issue files, repository policy, or unrelated documentation.
- Do not commit unless I explicitly request it.
- If `.proofline/prds/` has no PRDs, report `no-op`.

Preflight the entire migration before writing anything:
1. Enumerate every `.proofline/prds/PRD-<number>-<slug>/PRD.md` and every `revisions/REV-<revision>.md` below it.
2. Plan a one-to-one target for every file:
   - `PRD-0007-<slug>/PRD.md` -> `SPEC-0007-<slug>/SPEC.md`
   - `PRD-0007-<slug>/revisions/REV-2.md` -> `SPEC-0007-<slug>/revisions/REV-2.md`
3. Preserve the numeric ID, slug, revision number, title, kind, status, supersession relationships, related issue IDs, and contract meaning.
4. Inspect all planned target paths. An existing semantically identical target is a `no-op`. If a target has different content, an ID/path collision exists, or any source cannot be mapped faithfully, write nothing and report every conflict. Never overwrite, merge identities, or allocate a replacement number.

Write each target with JSON front matter between `---` delimiters:
{
  "schema_version": 2,
  "id": "SPEC-0007",
  "title": "...",
  "kind": "feature | bug | refactor | exact_port | maintenance",
  "status": "draft | ready | blocked | completed | cancelled | superseded",
  "revision": 1,
  "supersedes": [],
  "superseded_by": null,
  "related_issues": []
}

Do not carry `created_at`, `updated_at`, or `archived_at` into Spec v2. Rewrite migrated `PRD-*` relationship values to their one-to-one `SPEC-*` IDs; leave non-PRD issue IDs unchanged. Add no model, reasoning, history, or migration metadata. Do not repeat the title or other metadata in the Markdown body.

Convert the body into a standalone implementation document. Group the contract by independently observable outcomes and keep each outcome with its required behavior, material conditions, boundaries, and minimum sufficient proof. Preserve every prohibition, condition, exception, compatibility obligation, approved deviation, unknown, and validation obligation from the source. Invent no requirement or decision. Remove discussion history, investigation logs, rejected alternatives, and duplicated restatements. Keep a decision only when it limits valid implementations.

Add `Boundaries` only when needed to distinguish plausible adjacent scope, `Preserve` only for material invariants, and `Verification` only when a particular check or environment is contractual. Do not copy ordinary repository build/test policy. Omit empty sections and add no title heading.

After writing, validate:
- every planned non-no-op source has exactly one target;
- directory, front-matter ID, main revision, and snapshot revision agree;
- all JSON front matter parses and contains every required field with no placeholder;
- every migrated relationship resolves to the intended Spec or retained issue ID;
- all source outcomes, conditions, and acceptance obligations remain represented without added behavior;
- `.proofline/prds/**` is byte-for-byte untouched;
- `git diff --check` passes when Git is available.

Report created targets, identical no-ops, validation results, and any unverified item. State explicitly that `.proofline/prds/**` was left unchanged and that current Proofline ignores it. Do not claim successful migration if any planned target or semantic obligation is missing.
```
