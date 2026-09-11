---
name: implementation-spec
description: "Create, revise, complete, cancel, or supersede an implementation Spec under .proofline/specs without implementing it. Use for explicit Spec work, including invocation with an ID, path, or proposed contract."
---

# Implementation Spec

Produce a standalone, human-reviewable implementation contract. Modify only `.proofline/specs/**`, except domain documentation through available `domain-modeling` and named `PL-*` links through `../issue-ledger/references/work-link.md`. Legacy `.proofline/prds/**` is excluded.

## Resolve

Identify creation, revision, or lifecycle work. Resolve an explicit path or ID directly; for creation inspect only plausible active same-goal Specs. Ask on identity ambiguity. For lifecycle-only work, go to [document operations](references/document-operations.md).

Use the request and confirmed decisions, a supplied or linked ready Plan as the primary planning source, and relevant project/domain evidence; apply later confirmed user corrections. Read `CONTEXT.md` and relevant ADRs. Use available `domain-modeling` for ambiguous or conflicting terms, canonical definitions, or settled important design decisions.

## Establish the sources

Inspect facts needed for the requested behavior, affected existing guarantees, or completion evidence. Batch independent reads and reuse unchanged evidence; use focused excerpts when a fact is unresolved or output was truncated.

The requested outcome and boundaries cap supporting work. At changed protocol and lifecycle boundaries, establish successful, malformed-input, and invalid-state outcomes required by the request or affected owner contracts. Resolve meanings from the full request, confirmed decisions, and relevant existing contracts. Leave result-preserving implementation choices to narrow repository-consistent defaults. Ask only when an unresolved choice prevents establishing required behavior and materially changes capability, compatibility, safety, privacy, retention, or scope/cost; identify the differing observable outcomes.

## Write the contract

Build a standalone body that implementation and review can use without the conversation, Plan, or issue. Group it by behavior or affected surface. Give each requirement one authoritative condition-to-result statement, with its defaults, exceptions, and API constraints together. Preserve each condition at its original source scope; state independently conditioned results separately. For optional behavior, state normalization, active and inactive outcomes, including retained and omitted data. Every written type, signature, table, and example must agree with that statement. Retain explicit identifiers, fields, paths, commands, quantities, examples, and source references needed for verification.

For each result-changing dependency on the affected path, write a worked example beside its governing rules: concrete input and state, applicable conditions, and evaluated final values and relationships. Trace through the final consumer, including metadata, cached results, and reused state. Cases in the body must cover the identified interactions:

- Context-dependent behavior: the same source value used in different contexts during one operation or shared-state lifetime; calculate each position, including nesting where the rule recurs.
- An earlier step changes information consumed later: combine those steps in one case with the relevant rules active, including nested state at observable handoffs and subsequent processing.
- Affected compatibility: representative existing input and observed final values and relationships, preserved where the request leaves behavior unchanged.

Finish each example through the full operation or requested round trip before moving on. Account for every changed value by its governing rule and retain unaffected data. One example may cover several dependencies when its final observations distinguish each; ordinary defaults need no extra examples. Keep internal representations and algorithms open where they preserve the contract.

Use concise target-language telegraphic phrasing: noun phrases and short clauses, with sentences for conditions, exceptions, and causality. Use tables for comparable facts when equally suitable; keep cells concise. Preserve existing reference targets.

Use required behavior and expected results as the acceptance reference. Do not add instructions to write or run tests, build commands, or verification procedures. Preserve such obligations only when the user or project explicitly requires them, with their source; otherwise leave verification methods and execution procedures to `implement`.

## Check the body against the sources

Read the complete body, including examples and completion conditions. Check every source-required result is retained and every written obligation has source support, with unchanged conditions and scope. Locate the worked final observations for the identified interactions and affected compatibility guarantees; complete any missing case. Recalculate their results from the sources and existing final-consumer behavior. Check that the observations distinguish required behavior from a plausible violation, and that prose, tables, types, and examples agree. Resolve source-answerable gaps before readiness.

- `ready`: the body passes these checks; ordinary implementation choices may remain
- `draft`: a material decision or missing fact prevents establishing required behavior
- `blocked`: an actual external prerequisite prevents progress; transient tool/runtime/reviewer failures do not change status

## Save and report

Before writing, read [document operations](references/document-operations.md) for the requested operation. Compare contract, metadata, status, and links; if unchanged, report `no-op` without a write, snapshot, or revision.

Keep drafting actions and reports outside the contract body. Report operation, ID/title/path/revision/status, separate write/registration results, any snapshot, and material decisions or blockers. No product implementation occurs here. Return to `../figure-it-out/SKILL.md` when it owns the explicit request; otherwise end. Implementation requires a separate request.
