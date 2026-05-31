# Refactor Proof

Use for refactor, restructuring, responsibility split, dependency cleanup, architecture change, module boundary change, or state/data flow change.

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
