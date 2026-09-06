# Document operations

Read Storage for every write; Creation, Revision, or Lifecycle only for that operation. Reuse unchanged instructions.

## Storage

Path: `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md`. Keep ID, title, slug, and location stable; never overwrite an ID collision. No global index.

Write Spec files only through:

`node <plugin-root>/writers/document-writer.js write --kind spec --project-root <absolute-project-root> --relative-path <project-relative-spec-path>`

Pass complete UTF-8 Markdown on stdin in one tool call. For existing Specs add `--change-kind major|operational`. The writer owns snapshots and returns separate `write` and `registration` results; report either failure.

## Creation

Use [the envelope template](../assets/templates/spec.md), serializing JSON safely. Require schema version `2`, `SPEC-0001`-form ID, revision `1`, kind `feature | bug | refactor | exact_port | maintenance`, and status `draft | ready | blocked | completed | cancelled | superseded`. Set initial status by the skill's readiness rules. `supersedes` and `related_issues` are arrays; `superseded_by` is nullable. Add no other metadata; the body is free-form.

## Revision

Preserve unknown keys in existing valid metadata. For contract changes select `major`, increment revision once, and invalidate previous evidence. The writer snapshots the prior document at `revisions/REV-<revision>.md` and rejects a differing existing snapshot. Reassess readiness against the changed contract.

For typo/formatting, relation links, or lifecycle-only changes select `operational` and keep revision unchanged. Preserve referenced targets when editing the body.

## Lifecycle

Preserve body, identity, location, and revision. Complete only with current same-revision verification and independent review of the final changes, with no valid unresolved finding. Check the supplied evidence; missing evidence leaves completion pending. An implementer's exclusion of an out-of-scope-only failure needs reasons tied to the contract and change evidence. `implement` owns verification and review/fix execution; a status request does not initiate them.

Cancel only at the user's request. Supersede by linking both Specs through `supersedes` and `superseded_by`, marking the replaced Spec `superseded`. Report any incomplete link update.
