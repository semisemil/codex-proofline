---
name: proofline-exact-port
description: Use when the user asks to port, migrate, copy, or transplant an implementation while preserving behavior exactly or forbidding a rewrite. Keep the source authoritative and require approval for every deviation.
---

# Proofline Exact Port

Use `assets/templates/exact-port-plan.md` to track source-target mapping and `assets/templates/exact-port-report.md` to report equivalence evidence.

## Before

The source is authoritative. Do not simplify, rewrite, omit, rename, or change behavior unless the user approved it.

If an unapproved deviation is needed, stop before editing and ask approval or report blocked.

Track source-target mapping and every approved deviation with reason, approval, and evidence.

## Complete

Treat equivalence as a gated claim.

Count a command-based check as passed only when current-task tool evidence shows that it completed with exit code `0`. Treat `declined`, blocked, interrupted, not run, failed, or nonzero-exit checks as not verified or failed. A planned command, expected output, reasoning, or unrecorded run is not observed evidence and must not be reported as `PASS` or counted as passed.

Behavior evidence must independently exercise or compare the authoritative source and the actual target artifact. Defining both implementations from the same copied logic in a temporary check does not verify the port. User-provided comparison results support only the cases they explicitly cover. If either artifact cannot be inspected or a required comparison cannot run, report equivalence as not verified.

Do not claim equivalence while a required check is failed or not verified, or while an unapproved deviation remains.

Report:

1. overall equivalence status
2. confirmed equivalent parts
3. deviations
4. not verified parts
5. checks and their observed status, exit code, and result

Evidence can include independently run same-input/output tests, fixture/API/snapshot comparison, search for missing source parts, and typecheck/build/test results.
