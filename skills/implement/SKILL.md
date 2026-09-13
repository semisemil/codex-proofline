---
name: implement
description: Implement and verify a ready Design or supported legacy Spec in the current session. Explicit invocation only.
---

# Implement

Resolve the requested contract with:

```text
node <plugin-root>/dashboard/records/development-contracts.js --project-root <current-project> --id <DESIGN-ID-or-legacy-SPEC-ID>
```

Use the returned body and revision as the implementation contract. A missing, ambiguous, replaced, or non-ready contract cannot be implemented by choosing another one silently. `start-implementation` owns session creation; this session retains its model and reasoning.

Implement the returned contract using verification suited to its required behavior, final observations, material failure paths, and affected compatibility.

When implementation evidence invalidates a design assumption, use [development-design](../development-design/SKILL.md) in this session to revise the affected decision/contract. Reuse existing evidence; seek a user decision only for changes to purpose, scope, observable behavior, or consequential constraints and cost. Return to implementation after the revised contract is ready. Review only affected paths; no automatic new session or full preparation restart.

Finish when current evidence establishes every condition of the final revision. Follow [document operations](../development-design/references/document-operations.md) to mark the current Design (or supported legacy Spec) completed without changing its body or revision. Complete authorized delivery obligations before reporting.

At the work boundary, connected [Architecture Memory](../architecture-memory/SKILL.md) may record evidenced structural changes and durable constraints. Implementation, acceptance, and operational verification remain distinct. Report implementation/verification results and separate document, registration, or Memory failures.
