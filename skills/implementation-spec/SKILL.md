---
name: implementation-spec
description: "Create, revise, complete, cancel, or supersede a project implementation Spec under .proofline/specs without implementing it. Use when the user explicitly requests Spec lifecycle work or invokes this skill with a Spec ID, path, or proposed implementation contract."
---

# Proofline Implementation Spec

## Scope

- Modify only `.proofline/specs/**`; the exceptions are domain documentation maintained through an available `domain-modeling` skill and named issues updated through `../issue-ledger/references/work-link.md`. Apply that reference only when the request or target Spec identifies a `PL-*` work target. Never implement or migrate legacy `.proofline/prds/**`.
- Write a standalone implementation document that gives an implementer the settled change and gives a reviewer an observable contract. Do not make either reconstruct the conversation, an issue, or a Plan to recover information required for the work.
- Record product behavior, fixed design decisions, boundaries, and proof obligations. Leave repository-discoverable mechanics and ordinary build/test policy to the environment.

## Project language

Read the project's domain glossary (`CONTEXT.md`) and any ADRs in the area you're touching first.

When a project-specific term is ambiguous, conflicts with an existing definition, becomes canonical, or an important design decision settles, use the `domain-modeling` skill when available to maintain the domain model.

## Resolve

Resolve an explicit path or ID directly. For creation, inspect Spec metadata and only plausible active `draft | ready | blocked` same-goal bodies. Stop on identity ambiguity.

Compare contract, metadata, lifecycle, and links before writing. If already matched, report `no-op`; do not rewrite, snapshot, or revise.

Use `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md`; allocate above the largest Spec ID, recheck, and never overwrite a collision. Keep ID/slug fixed. Store snapshots at `revisions/REV-<revision>.md`; create no global index.

## Write the Spec

Write the Spec in the user's language.

Create from `assets/templates/spec.md` and serialize its JSON safely. Require `schema_version: 2`; `SPEC-0001`-form `id`; stable `title`; `kind` in `feature | bug | refactor | exact_port | maintenance`; `status` in `draft | ready | blocked | completed | cancelled | superseded`; positive `revision`; arrays `supersedes`/`related_issues`; nullable `superseded_by`. Create no other metadata; preserve unknown keys in an existing valid Spec.

Synthesize the current contract from the request, authoritative linked documents, confirmed decisions, and current project evidence. A link remains a pointer; include the information an implementer or reviewer must know rather than requiring them to follow the link. Keep discussion history, investigation logs, rejected alternatives, and repeated metadata out of the body. Distinguish an unresolved material decision from an implementation choice and never invent either to make the Spec look complete.

Choose the structure, length, examples, scenarios, tables, and diagrams for the change instead of filling a fixed outline. Keep a small change short. Give a complex behavior enough structure to make its flows, state, responsibility, and proof legible. Use natural, subject-specific headings and include only material content.

The document is complete enough to implement only when a reader can locate, when material to the change:

- the evidence-backed current behavior or condition and the reason it must change;
- the intended user or system behavior through its main flow and material conditions, failures, or state transitions;
- the fixed decisions about responsibility, state, data, interfaces, compatibility, migration, or operations that implementation must not invent;
- the implementation choices intentionally left open because they are repository-discoverable or do not affect the contract;
- the invariants to preserve and plausible adjacent behavior outside scope;
- the observations, scenarios, or required environments that can prove the result.

Do not force irrelevant categories into the document. A bug usually needs the observed current failure and regression behavior; a refactor needs current and intended responsibility and what remains observable; an exact port needs authoritative source and target, preserved behavior, approved deviations, and equivalence proof. These are information needs, not required headings.

Format every stable requirement as one list item with nested `Behavior:` and observable `Done when:` lines: `- REQ-001`, `  - Behavior: ...`, `  - Done when: ...`. Requirements state the externally meaningful contract; surrounding explanation supplies the context, design, flow, and proof that a flat requirement list cannot carry. Create no acceptance IDs or mapping. Omit a title heading because metadata already identifies the document.

## Lifecycle

Use `ready` only when an implementer can proceed without inventing product behavior, scope, cross-boundary ownership, state or data rules, compatibility obligations, or proof of the required results, and a reviewer can judge every requirement from observable evidence. Repository-discoverable mechanics and ordinary validation commands do not prevent `ready`.

Use `draft` while a material decision or unsupported current-state claim could change the contract; expose that gap in the document instead of filling it by inference. Use `blocked` only for an actual external prerequisite; transient task, tool, reviewer, or runtime failures never change status.

- **Create:** Write revision `1` and apply the ready rule.
- **Major revision:** Snapshot first, never overwrite a differing snapshot, increment once, and invalidate old evidence.
- **Operational edit:** Do not revise for typo/formatting, relation links, or lifecycle-only changes.
- **Terminal:** Complete only from same-revision evidence and a fresh passing post-review; cancel only by user; supersede by linking both Specs. Preserve body/location.

Never ask for implementation approval. Report operation, ID/title/path, revision/status, snapshot, decisions, blockers, and that no implementation occurred.
