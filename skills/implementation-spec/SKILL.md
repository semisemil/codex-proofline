---
name: implementation-spec
description: "Create, revise, complete, cancel, or supersede an implementation Spec under .proofline/specs without implementing it. Use for explicit Spec work, including invocation with an ID, path, or proposed contract."
---

# Implementation Spec

Produce a standalone implementation contract. Modify only `.proofline/specs/**`, except domain documentation through available `domain-modeling` and named `PL-*` links through `../issue-ledger/references/work-link.md`. Legacy `.proofline/prds/**` is excluded.

## Resolve

Identify creation, revision, or lifecycle work. Resolve an explicit path or ID directly; for creation inspect only plausible active same-goal Specs. Ask on identity ambiguity. For lifecycle-only work, go to [document operations](references/document-operations.md).

Use the request and confirmed decisions, a supplied or linked ready Plan as the primary planning source, and relevant project/domain evidence; apply later confirmed user corrections. Read `CONTEXT.md` and relevant ADRs. Use available `domain-modeling` for ambiguous or conflicting terms, canonical definitions, or settled important design decisions.

## Establish the contract

Inspect facts affecting the outcome, scope, compatibility, or completion judgment. Batch independent reads and reuse unchanged evidence; reread targeted portions when output is truncated or a concrete fact remains unresolved, including in an already-read source. Prefer focused searches and excerpts over full implementation files.

Ask only for unresolved material user decisions: choices affecting capability, compatibility, safety, privacy, retention, or meaningful scope/cost. Names of algorithms, policies, standards or formats, examples, current code, and model familiarity do not settle omitted result-changing semantics. Leave ordinary implementation choices to the implementer using narrow repository-consistent defaults, without promoting them into requirements.

Write the current contract so implementation and review need neither the conversation nor a Plan or issue. Preserve explicit identifiers, fields, paths, commands, quantities, examples, and conditions. The requested outcome and boundaries cap scope; include supporting work only when necessary to deliver that outcome or preserve an existing contract on the changed path.

Make the change, boundaries, fixed decisions, material prerequisites/order, state/data semantics, compatibility obligations, and observable completion conditions clear where relevant. Choose structure to fit the content; no required headings, repeated outcome sections, or diagrams. Keep existing reference targets identifiable. Leave execution decomposition and repository-discoverable build mechanics to execution.

Use concise, target-language telegraphic phrasing: key facts rather than extended sentences. Use sentences when needed to preserve conditions, exceptions, or causality. Prefer tables when equally suitable; omit terminal periods. Bullets are optional.

Plan minimum-sufficient evidence capable of deciding every required result on the real production path. Reuse existing checks; one may cover multiple conditions. Add checks only for otherwise undecidable required results or reproduced regressions. Use review evidence when automation would be indirect or unrealistic. Preserve explicit artifact/test obligations separately from commands to run. Candidate-derived expectations cannot establish correctness independently. Leave execution-time commands, reruns, and review/fix procedures to `implement`.

## Check readiness

Compare with the sources for omissions, altered intent, or added obligations. Confirm the implementer can proceed without inventing a material product decision and each completion condition has sufficient planned evidence.

- `ready`: these checks pass; ordinary implementation choices may remain
- `draft`: expose a material decision or unverified fact that could change the contract
- `blocked`: an actual external prerequisite prevents progress; transient tool/runtime/reviewer failures do not change status

## Save and report

Before writing, read [document operations](references/document-operations.md) for the requested operation. Compare contract, metadata, status, and links; if unchanged, report `no-op` without a write, snapshot, or revision.

Keep drafting actions and reports outside the contract body. Report operation, ID/title/path/revision/status, separate write/registration results, any snapshot, and material decisions or blockers. No product implementation occurs here. Return to `../figure-it-out/SKILL.md` when it owns the explicit request; otherwise end. Implementation requires a separate request.
