---
name: implementation-spec
description: "Create, revise, complete, cancel, or supersede a project implementation Spec under .proofline/specs without implementing it. Use when the user explicitly requests Spec lifecycle work or invokes this skill with a Spec ID, path, or proposed implementation contract."
---

# Proofline Implementation Spec

## Scope

- **Target:** `.proofline/specs/**` only
- **Exceptions:** Domain documentation maintained through an available `domain-modeling` skill; named issues updated through `../issue-ledger/references/work-link.md` when the request or target Spec identifies a `PL-*` work target
- **Excluded:** Product implementation; legacy `.proofline/prds/**` implementation or migration
- **Output:** A standalone implementation document containing the settled change, product behavior, fixed design decisions, boundaries, and proof obligations, without requiring the conversation, an issue, or a Plan; repository-discoverable mechanics and ordinary build/test policy remain in the environment

## Project language

- Read the project's domain glossary (`CONTEXT.md`) and relevant ADRs first
- Use the available `domain-modeling` skill when a project term is ambiguous, conflicts with an existing definition, becomes canonical, or an important design decision settles

## Resolve

- **Existing Spec:** Resolve an explicit path or ID directly
- **Creation:** Inspect metadata and only plausible active `draft | ready | blocked` bodies with the same goal; stop on identity ambiguity
- **No-op:** Compare contract, metadata, lifecycle, and links before writing; when already matched, report `no-op` without rewriting, snapshotting, or revising
- **Path:** `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md`
- **ID:** Never overwrite a collision; keep ID/slug fixed
- **Snapshots:** `revisions/REV-<revision>.md`; no global index

Write Spec files and snapshots only through `node <plugin-root>/writers/document-writer.js write --kind spec --project-root <absolute-project-root> --relative-path <project-relative-spec-path>`, passing the complete UTF-8 Markdown on stdin in one tool call. Add `--change-kind major|operational` only when changing an existing Spec. Report its separate `write` and `registration` results.

## Write the Spec

### Envelope

- Create from `assets/templates/spec.md` and serialize its JSON safely
- Require `schema_version: 2`; `SPEC-0001`-form `id`; stable `title`; `kind` in `feature | bug | refactor | exact_port | maintenance`; `status` in `draft | ready | blocked | completed | cancelled | superseded`; positive `revision`; arrays `supersedes`/`related_issues`; nullable `superseded_by`
- Create no other metadata; preserve unknown keys in an existing valid Spec

### Contract

- **Sources:** When a ready Plan is supplied or linked, use it as the primary planning source; apply later confirmed user corrections and decisions, then current project evidence and authoritative domain or linked documents. Without a Plan, use the request and the same remaining sources
- **Standalone body:** Include linked information required for implementation or review
- **Body:** Current contract only
- **Acceptance:** Convert the current intent into observable acceptance conditions and a pre-implementation test and verification plan. Every required result has planned evidence capable of deciding it; every acceptance condition is supported by a source
- **Boundary:** Do not add product behavior or generic error, performance, or quality conditions absent from the sources

### Body style

- Write the Spec body in the target language's conventional telegraphic style
- Compress content as far as possible without loss of meaning
- Use tables and bullets when they improve structure, preferring tables when either form works
- Avoid terminal periods
- Keep a short, dense development-document style

### Contract structure

- Keep each acceptance condition, its material boundaries and fixed decisions, and its planned evidence together enough for implementation and review
- Use Mermaid for graph-shaped relationships with multiple branches or actors

## Lifecycle

- **Ready:** Every material source intent is represented, every acceptance condition is source-supported, and each required result has a verification plan capable of producing observable evidence; the implementer can proceed without inventing product behavior, scope, cross-boundary ownership, state or data rules, compatibility obligations, or proof of the required results
- **Draft:** A material decision or unsupported current-state claim could change the contract; expose the gap instead of filling it by inference
- **Blocked:** An actual external prerequisite only; transient task, tool, reviewer, or runtime failures do not change status
- **Create:** Revision `1`, with status determined by the ready rule
- **Major revision:** Select `major`, increment once, and invalidate old evidence; the writer snapshots the previous revision and refuses a differing snapshot
- **Operational edit:** Select `operational` and keep the revision unchanged for typo/formatting, relation links, or lifecycle-only changes
- **Terminal:** Complete only from same-revision evidence and a fresh passing post-review; cancel only by user; supersede by linking both Specs; preserve body/location
- **Report:** Operation, resulting ID/title/path/revision/status, registration result, any snapshot, material decisions or blockers, and that no implementation occurred; implementation requires a separate user request unless `../figure-it-out/SKILL.md` owns the explicit request, in which case return the result to that workflow
