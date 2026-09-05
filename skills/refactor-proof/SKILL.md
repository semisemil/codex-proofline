---
name: refactor-proof
description: Use for refactors, restructuring, responsibility splits, dependency cleanup, architecture or module-boundary changes, and state or data flow changes. Prove that the intended structure changed rather than only names or surface code.
---

# Proofline Refactor Proof

## Before

Record current and intended responsibility owners, call paths, dependency directions, and state/data flows for every aspect of the requested structural change.

Choose a format suited to the task; reuse recorded goals and verification plans. For complex structures or staged work, use `assets/templates/refactor-proof-plan.md` and `assets/templates/refactor-proof-report.md`.

## Complete

Complete only when every intended structure in scope is implemented and evidenced.

Preserve observable behavior. Do not add validation, coercion, defaults, normalization, or error changes unless the source already requires them or the user explicitly approves the deviation.

Evidence must include at least one real structure change:

- call path changed
- responsibility moved
- dependency direction changed
- state/data owner changed
- old coupling was removed or reduced

Check old imports, paths, names, or direct calls that should be gone. Check every new call path and dependency direction in scope. Run relevant tests, build, typecheck, or lint. Treat each result as evidence only for its known coverage; do not claim whole-behavior preservation from an unspecified passing suite. If a check cannot run, report not verified.

If the refactor is incomplete, report the old owner or coupling that remains, the intended owner or path, the required structural change, and the next proof check.

## Never

Do not call the refactor complete when only names changed, old code still owns the work, old imports remain without explanation, the new dependency direction is unused, or current verification evidence is missing.
