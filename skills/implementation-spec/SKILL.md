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

## Evidence load

- After discovery, form one bounded manifest of the project evidence needed to settle the contract and load it in one batched tool call; another read is only for a newly discovered or changed source
- Prefer symbol searches and relevant excerpts for large generated sources and test files; full implementation context belongs to the later execution task
- Reuse unchanged skill, template, project, and artifact evidence for the rest of this Spec operation

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
- **Exact terms:** Preserve explicit identifiers, output field names, paths, commands, quantities, and examples from their authoritative source; do not generalize, translate, or rename them across the Spec or verification contract
- **Scope ceiling:** The requested outcome and explicit boundaries are the maximum product scope. Repository evidence and a Plan constrain delivery but do not authorize adjacent behavior, generic hardening, cleanup, migration, future extensibility, or new goals. Include supporting work only when omitting it would leave a requested result incomplete or break an existing contract on the changed path
- **Source gaps:** A named algorithm, policy, standard, format, example, current implementation, or model familiarity does not supply omitted result-changing semantics. A gap is material only when plausible choices would materially change the requested capability, compatibility with an existing consumer or authority, safety, privacy, data retention, or meaningful scope and cost. A detail is not material merely because implementation must fix it or expose it in a file, schema, or API. For a non-material gap, select the narrowest repository-consistent default and keep it as an implementation decision rather than adding a user requirement or acceptance condition
- **Standalone body:** Include linked information required for implementation or review
- **Body:** Current contract only
- **Acceptance:** Convert the current intent into observable, source-supported acceptance conditions and one minimum-sufficient completion set. Every required result has planned evidence capable of deciding it
- **Verification:** Prove the changed outcome through the smallest realistic check on the real production path. One check may decide multiple acceptance conditions. Add another check only when the primary check cannot decide a distinct source-required result or a reproduced regression. Reuse existing checks when sufficient. When automation would be indirect or unrealistic, use review evidence or no mechanical check instead of inventing a test. Distinguish an explicit artifact obligation such as adding a test, migration, or generated contract from merely passing an existing command. Unchanged behavior and implementation details get no new test
- **Independence:** A verifier, expected value, or report derived from the candidate implementation cannot independently decide that implementation's correctness
- **Verification commitment:** Preserve the completion conditions and user-required verification. Implementers may add and run checks needed by the actual change without fixing every command in advance. Record each command, location, result, and verified state; reuse success while relevant state is unchanged and rerun affected checks after changes. Required conditions must have current evidence before completion
- **Boundary:** Do not add product behavior or generic error, performance, or quality conditions absent from the sources; an implementation decision must stay inside the requested result and cannot enlarge acceptance

### Body style

- Write the Spec body in the target language's conventional telegraphic style
- Use tables and bullets when they improve structure, preferring tables when either form works
- Avoid terminal periods

### Contract structure

- Keep each acceptance condition, its material boundaries and fixed decisions, and its planned evidence together enough for implementation and review
- Give every required outcome a stable linkable section that keeps its acceptance conditions, owned boundary, prerequisite or ordering relationship, and planned evidence together
- Keep outcomes together when they must be implemented and reviewed as one final state; separate them only when each remains a coherent independently implementable result
- Keep execution decomposition out of the Spec; `spec-slice` derives it without changing the implementation contract
- Use Mermaid for graph-shaped relationships with multiple branches or actors

## Lifecycle

- **Ready:** Every material source intent is represented, every acceptance condition is source-supported, and each required result has a verification plan capable of producing observable evidence; the implementer can proceed directly from the Spec without inventing a requested product result, scope, outcome ownership, material prerequisite or ordering relationship, source-constrained state or data semantics, compatibility obligation, or proof of the required results. Ordinary implementation choices may remain when the narrow-default rule decides them
- **Draft:** A material decision or unsupported current-state claim could change the contract; expose the gap instead of filling it by inference
- **Blocked:** An actual external prerequisite only; transient task, tool, reviewer, or runtime failures do not change status
- **Create:** Revision `1`, with status determined by the ready rule
- **Major revision:** Select `major`, increment once, and invalidate old evidence; the writer snapshots the previous revision and refuses a differing snapshot
- **Operational edit:** Select `operational` and keep the revision unchanged for typo/formatting, relation links, or lifecycle-only changes
- **Terminal:** Complete only from current same-revision verification and a fresh independent review of the final changes, with no valid unresolved finding. The main implementer may exclude an out-of-scope-only `fail` with reasons tied to the Spec contract and change evidence. Cancel only by user; supersede by linking both Specs; preserve body/location
- **Report:** Operation, resulting ID/title/path/revision/status, registration result, any snapshot, material decisions or blockers, and that no implementation occurred; implementation requires a separate user request unless `../figure-it-out/SKILL.md` owns the explicit request, in which case return the result to that workflow
