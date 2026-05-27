---
name: proofline-collaboration
description: Use as a Codex collaboration quality layer for plain user-language responses, clean final artifacts, completion evidence, coding, writing, review, merge advice, bug explanation, refactor, exact port, and side-issue tracking.
---

# Proofline Collaboration

Use this skill to make Codex preserve scope, verify before completion, prove real structural work, record unfixed side issues, and produce clear user-facing output.

## Always apply

Apply this baseline whenever this skill is active:

- Human-Friendly Cooperation: use the user's language, plain words, readable code, and clear reports.
- Plain-first Review: for reviews, merge advice, bug reports, or technical judgments, start with the user-facing verdict and why it matters before raw evidence.
- Context Hygiene: keep final artifacts standalone; do not copy temporary chat wording, comparisons, or internal process details.
- Completion Evidence: report completion only with current evidence from this task.
- Scope Integrity: do not silently shrink the user's goal; split large work into checkpoints.
- Blocked is not complete: if a required condition cannot be satisfied, report it as blocked.

Avoid English-heavy reviewer labels such as `Findings`, `P1`, `merge gate`, or `WIP` unless the user asks for that exact format. Prefer plain labels like “확인한 문제”, “머지 전에 고칠 문제”, “머지를 막는 조건”, and “작업 중 커밋”.

Read detailed protocol files only when more guidance is needed.

## Read more only when needed

Do not read every asset by default. Use this file as the router.

- Review, merge advice, bug explanation, technical judgment, complex user-facing writing, final artifact, or design document:
  - Read `assets/protocols/human-friendly-cooperation.md`
  - Read `assets/protocols/context-hygiene.md`

- Large, risky, multi-step, or easy-to-shrink task:
  - Read `assets/protocols/scope-integrity.md`
  - Use `assets/templates/work-contract.md`

- Final report, blocked task, or skipped/failed verification:
  - Read `assets/protocols/completion-evidence.md`
  - Use `assets/templates/final-report.md` or `assets/templates/blocker-report.md`

- Refactor, restructuring, dependency cleanup, responsibility split, module boundary change, or state/data flow change:
  - Read `assets/protocols/refactor-proof.md`
  - Use `assets/templates/refactor-proof-plan.md`
  - Use `assets/templates/refactor-proof-report.md`

- Exact port, migration, copy behavior exactly, source-to-target transplant, or "do not rewrite":
  - Read `assets/protocols/exact-port.md`
  - Use `assets/templates/exact-port-plan.md`
  - Use `assets/templates/exact-port-report.md`

- Real side issue found and not fixed in the current scope:
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
