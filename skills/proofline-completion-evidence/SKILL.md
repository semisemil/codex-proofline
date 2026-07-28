---
name: proofline-completion-evidence
description: Use when reporting task completion, verification results, blockers, failed checks, or unverified work. Require current-task evidence and clearly separate completed, verified, unverified, blocked, and recorded issues.
---

# Proofline Completion Evidence

Use `assets/templates/final-report.md` when a detailed report helps. For concise reports, include only non-empty sections.

## Complete

Use evidence inspected in this task, including earlier turns while relevant state is unchanged:

- tests, build, typecheck, or lint
- code search, dependency check, or call path check
- source-target comparison
- actual app, CLI, API, or UI behavior

Answer follow-up questions about a reported result directly from that unchanged task evidence.

Report an explicit overall status, then separate completed work, passed checks, failed checks, checks not run or otherwise unverified, blockers, issues recorded, and the next action or decision needed. Omit empty sections.

Completed work and verification results are independent. Do not omit work that was performed because a check failed.

An implementation-caused failed check makes the task incomplete. A confirmed pre-existing or unrelated failure stays under failed checks with its attribution but does not make current-task work incomplete. Treat uncertain attribution as unverified. Mark work blocked only when progress cannot continue without user input, approval, permission, or an external state change.

If any check failed, was not run, or remains unverified, always state a concrete next action or explicitly say why no further action is needed.

If verification cannot run, say why.

Use one concrete line per check.

## Proof boundary

Completion proof is observed task evidence, including unchanged evidence from earlier turns. Intention, unsupported recollection, another task's past success, "looks right", indirect confidence, and unrun checks are not proof.
