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

## Write the Spec

### Envelope

- Create from `assets/templates/spec.md` and serialize its JSON safely
- Require `schema_version: 2`; `SPEC-0001`-form `id`; stable `title`; `kind` in `feature | bug | refactor | exact_port | maintenance`; `status` in `draft | ready | blocked | completed | cancelled | superseded`; positive `revision`; arrays `supersedes`/`related_issues`; nullable `superseded_by`
- Create no other metadata; preserve unknown keys in an existing valid Spec

### Contract

- **Sources:** Request, confirmed decisions, current project evidence, and authoritative domain or linked documents
- **Standalone body:** Include linked information required for implementation or review
- **Body:** Current contract only

### Body style

- Write the Spec body in the target language's conventional telegraphic style
- Compress content as far as possible without loss of meaning
- Use tables and bullets when they improve structure, preferring tables when either form works
- Avoid terminal periods
- Keep a short, dense development-document style

### Contract structure

- Keep material conditions, boundaries, fixed decisions, and minimum evidence with the part of the contract they qualify
- Use Mermaid for graph-shaped relationships with multiple branches or actors

## Lifecycle

- **Ready:** The implementer can proceed without inventing product behavior, scope, cross-boundary ownership, state or data rules, compatibility obligations, or proof of the required results; the reviewer can judge every required outcome from observable evidence
- **Draft:** A material decision or unsupported current-state claim could change the contract; expose the gap instead of filling it by inference
- **Blocked:** An actual external prerequisite only; transient task, tool, reviewer, or runtime failures do not change status
- **Create:** Revision `1`, with status determined by the ready rule
- **Major revision:** Snapshot first, never overwrite a differing snapshot, increment once, and invalidate old evidence
- **Operational edit:** No revision change for typo/formatting, relation links, or lifecycle-only changes
- **Terminal:** Complete only from same-revision evidence and a fresh passing post-review; cancel only by user; supersede by linking both Specs; preserve body/location
- **Report:** Operation, resulting ID/title/path/revision/status, any snapshot, material decisions or blockers, and that no implementation occurred; implementation requires a separate user request unless `../figure-it-out/SKILL.md` owns the explicit request, in which case return the result to that workflow
