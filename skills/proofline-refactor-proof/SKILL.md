---
name: proofline-refactor-proof
description: Use for refactors, restructuring, responsibility splits, dependency cleanup, architecture or module-boundary changes, and state or data flow changes. Prove that the intended structure changed rather than only names or surface code.
---

# Proofline Refactor Proof

Use `assets/templates/refactor-proof-plan.md` before substantial work and `assets/templates/refactor-proof-report.md` for detailed evidence.

## Before

State current -> intended responsibility owner, call path, dependency direction, and state/data flow. Mark a field `N/A` only when it is outside the requested change.

## Complete

Complete only when every non-`N/A` intended structure is implemented and evidenced.

Evidence must include at least one real structure change:

- call path changed
- responsibility moved
- dependency direction changed
- state/data owner changed
- old coupling was removed or reduced

Check old imports, paths, names, or direct calls that should be gone. Check every non-`N/A` new call path and dependency direction. Run relevant tests, build, typecheck, or lint. If a check cannot run, report not verified.

## Never

Do not call the refactor complete when only names changed, old code still owns the work, old imports remain without explanation, the new dependency direction is unused, or current verification evidence is missing.
