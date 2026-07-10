---
name: proofline-completion-evidence
description: Use when reporting task completion, verification results, blockers, failed checks, or unverified work. Require current-task evidence and clearly separate completed, verified, unverified, blocked, and recorded issues.
---

# Proofline Completion Evidence

Use `assets/templates/final-report.md` for a detailed completion report and `assets/templates/blocker-report.md` when work is blocked.

## Complete

Use current-task evidence before reporting completion:

- tests, build, typecheck, or lint
- code search, dependency check, or call path check
- source-target comparison
- actual app, CLI, API, or UI behavior

Separate completed, verified, not verified, blocked, and issues recorded.

If verification cannot run, say why.

Use one concrete line per check.

## Never

Never use intention, memory, past success, "looks right", indirect confidence, or unrun checks as completion proof.
