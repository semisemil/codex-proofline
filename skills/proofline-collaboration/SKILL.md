---
name: proofline-collaboration
description: Use for large coding tasks, refactors, exact ports, scope integrity, issue ledger, completion evidence, human-friendly reporting, and context hygiene.
---

# Proofline Collaboration

This skill helps Codex preserve user scope, prove real refactors, perform exact ports, record unfixed side issues, verify before completion, and produce clear reports.

## Core rules

1. Treat the user's stated goal as the work contract.
2. Do not silently reduce scope.
3. Split large work into checkpoints instead of shrinking the goal.
4. Completion requires current evidence from this task.
5. If blocked, report blocked instead of complete.
6. Record real unfixed side issues only when they affect future work.
7. Use the user's language and write clear, readable code.
8. Keep final artifacts clean. Do not copy temporary chat wording into them.

## Load only what is needed

- Large or risky task:
  - Read `assets/protocols/scope-integrity.md`
  - Use `assets/templates/work-contract.md`

- Blocked task:
  - Read `assets/protocols/completion-evidence.md`
  - Use `assets/templates/blocker-report.md`

- Refactor, restructuring, dependency cleanup, responsibility split:
  - Read `assets/protocols/refactor-proof.md`
  - Use `assets/templates/refactor-proof-plan.md`
  - Use `assets/templates/refactor-proof-report.md`

- Exact port, migration, copy behavior exactly, source-to-target transplant:
  - Read `assets/protocols/exact-port.md`
  - Use `assets/templates/exact-port-plan.md`
  - Use `assets/templates/exact-port-report.md`

- Side issue found and not fixed now:
  - Read `assets/protocols/issue-ledger.md`
  - If needed, initialize from `assets/state-starter/`
  - Create one Markdown issue under `.proofline/issues/`
  - Do not edit dashboard frontend files during normal issue registration

- Final report:
  - Read `assets/protocols/completion-evidence.md`
  - Use `assets/templates/final-report.md`

- Human-facing writing or final artifact:
  - Read `assets/protocols/human-friendly-cooperation.md`
  - Read `assets/protocols/context-hygiene.md`
