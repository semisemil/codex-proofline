---
name: implementation-spec
description: "Create, revise, complete, cancel, or supersede a project implementation Spec under .proofline/specs without implementing it. Use when the user explicitly requests Spec lifecycle work or invokes this skill with a Spec ID, path, or proposed implementation contract."
---

# Proofline Implementation Spec

## Scope

- Modify only `.proofline/specs/**`; the sole exception is domain documentation maintained through an available `domain-modeling` skill. Never implement or migrate legacy `.proofline/prds/**`.
- Record the current implementation contract, not repository, system, formatting, or ordinary build/test policy.

## Project language

Read the project's domain glossary (`CONTEXT.md`) and any ADRs in the area you're touching first.

When a project-specific term is ambiguous, conflicts with an existing definition, becomes canonical, or an important design decision settles, use the `domain-modeling` skill when available to maintain the domain model.

## Resolve

Resolve an explicit path or ID directly. For creation, inspect Spec metadata and only plausible active `draft | ready | blocked` same-goal bodies. Stop on identity ambiguity.

Compare contract, metadata, lifecycle, and links before writing. If already matched, report `no-op`; do not rewrite, snapshot, or revise.

Use `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md`; allocate above the largest Spec ID, recheck, and never overwrite a collision. Keep ID/slug fixed. Store snapshots at `revisions/REV-<revision>.md`; create no global index.

## Contract

Write the Spec in the user's language.

Create from `assets/templates/spec.md` and serialize its JSON safely. Require `schema_version: 2`; `SPEC-0001`-form `id`; stable `title`; `kind` in `feature | bug | refactor | exact_port | maintenance`; `status` in `draft | ready | blocked | completed | cancelled | superseded`; positive `revision`; arrays `supersedes`/`related_issues`; nullable `superseded_by`. Create no other metadata; preserve unknown keys in an existing valid Spec.

Keep only the current contract: no discussion history, investigation logs, rejected alternatives, or metadata repeated as prose. Format every stable `REQ-001` as one list item with nested `Behavior:` and observable `Done when:` lines; create no acceptance IDs or mapping.

Use the smallest matching body:

- `feature`: `Outcome`, `Contract`
- `bug | maintenance`: `Current`, `Contract`
- `refactor`: `Current structure`, `Contract`, `Preserve`, `Verification`
- `exact_port`: `Source and target`, `Contract`, optional `Approved deviations`, `Verification`

Add `Boundaries` only for plausible adjacent scope, `Preserve` only for material invariants, `Constraints` only for decisions restricting valid implementations, and `Verification` only when a check/environment is contractual. Omit empty sections and title headings; invent no requirement.

## Lifecycle

Prefer `ready`. Use `draft` only when a missing user decision materially changes behavior, scope, compatibility, or data. Use `blocked` only for an actual external prerequisite; transient task, tool, reviewer, or runtime failures never change status. Implementation details and ordinary project-discoverable validation do not prevent `ready`.

- **Create:** Write revision `1` and apply the ready rule.
- **Major revision:** Snapshot first, never overwrite a differing snapshot, increment once, and invalidate old evidence.
- **Operational edit:** Do not revise for typo/formatting, relation links, or lifecycle-only changes.
- **Terminal:** Complete only from same-revision evidence and a fresh passing post-review; cancel only by user; supersede by linking both Specs. Preserve body/location.

Never ask for implementation approval. Report operation, ID/title/path, revision/status, snapshot, decisions, blockers, and that no implementation occurred.
