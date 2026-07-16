---
name: proofline-completion-evidence
description: Use when reporting task completion, verification results, blockers, failed checks, or unverified work. Require current-task evidence and clearly separate completed, verified, unverified, blocked, and recorded issues.
---

# Proofline Completion Evidence

Use `assets/templates/final-report.md` when a detailed report helps. For concise reports, include only non-empty sections.

## Complete

Use current-task evidence before reporting completion:

- tests, build, typecheck, or lint
- code search, dependency check, or call path check
- source-target comparison
- actual app, CLI, API, or UI behavior

Report an explicit overall status, then separate completed work, passed checks, failed checks, checks not run or otherwise unverified, blockers, issues recorded, and the next action or decision needed. Omit empty sections.

Completed work and verification results are independent. Do not omit work that was performed because a check failed.

A failed check makes the task incomplete, not blocked. Mark work blocked only when progress cannot continue without user input, approval, permission, or an external state change.

If any check failed, was not run, or remains unverified, always state a concrete next action or explicitly say why no further action is needed.

If verification cannot run, say why.

Use one concrete line per check.

## Never

Never use intention, memory, past success, "looks right", indirect confidence, or unrun checks as completion proof.
