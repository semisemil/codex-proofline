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

Do not claim equivalence without comparison evidence.

Report:

1. confirmed equivalent parts
2. deviations
3. not verified parts
4. checks run

Evidence can include same-input/output tests, fixture/API/snapshot comparison, search for missing source parts, and typecheck/build/test results.
