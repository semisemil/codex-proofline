---
name: proofline-collaboration
description: Use as a Codex collaboration quality layer for plain user-language responses, clean final artifacts, completion evidence, coding, writing, review, merge advice, explanation, refactor, exact port, and side-issue tracking.
---

# Proofline Collaboration

Use this skill to make Codex preserve scope, verify before completion, prove real structural work, record unfixed side issues, and produce clear user-facing output.

## Always apply

Always Apply Human-Friendly Cooperation and Context Hygiene.

Apply this baseline whenever this skill is active:
- Plain-first Review: for reviews, merge advice, bug reports, or technical judgments, start with the user-facing verdict and why it matters before raw evidence.
- Completion Evidence: report completion only with current evidence from this task.
- Scope Integrity: do not silently shrink the user's goal; split large work into checkpoints.
- Blocked is not complete: if a required condition cannot be satisfied, report it as blocked.

Read detailed protocol files only when more guidance is needed.

## Read more only when needed

Do not read every asset by default except Human-Friendly Cooperation and Context Hygiene. Use this file as the router.

- Review, merge advice, explanation, technical judgment, complex user-facing writing, final artifact, or design document:
  - Human-Friendly Cooperation
    - Read `assets/protocols/human-friendly-cooperation.md`
  - Context Hygiene
    - Read `assets/protocols/context-hygiene.md`

- Large, risky, multi-step, or easy-to-shrink task:
  - Scope Integrity
    - Read `assets/protocols/scope-integrity.md`
    - Use `assets/templates/work-contract.md`

- Final report, blocked task, or skipped/failed verification:
  - Completion-Evidence: 
    - Read `assets/protocols/completion-evidence.md`
    - Use `assets/templates/final-report.md` or `assets/templates/blocker-report.md`

- Refactor, restructuring, dependency cleanup, responsibility split, module boundary change, or state/data flow change:
  - Refactor-Proof:
    - Read `assets/protocols/refactor-proof.md`
    - Use `assets/templates/refactor-proof-plan.md`
    - Use `assets/templates/refactor-proof-report.md`

- Exact port, migration, copy behavior exactly, source-to-target transplant, or "do not rewrite":
  - Exact Port:
    - Read `assets/protocols/exact-port.md`
    - Use `assets/templates/exact-port-plan.md`
    - Use `assets/templates/exact-port-report.md`

- Real side issue found and not fixed in the current scope:
  - Issue Ledger:
    - Read `assets/protocols/issue-ledger.md`
    - If needed, initialize from `assets/state-starter/`
    - Create one Markdown issue under `.proofline/issues/`
    - Do not edit dashboard frontend files during normal issue registration

## Combined triggers

If triggers overlap, read the matching files together.

Examples:

- Large refactor: `scope-integrity.md`, `refactor-proof.md`, `completion-evidence.md`
- Exact port with a side issue: `exact-port.md`, `issue-ledger.md`, `completion-evidence.md`
- Final design document: `human-friendly-cooperation.md`, `context-hygiene.md`
