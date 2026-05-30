# Refactor Proof

Use for refactor, restructuring, responsibility split, dependency cleanup, architecture change, module boundary change, or state/data flow change.

## Before

State current -> intended responsibility owner, call path, dependency direction, and state/data flow.

## Complete

Evidence that at least one real structure changed:

- call path changed
- responsibility moved
- dependency direction changed
- state/data owner changed
- old coupling was removed or reduced

Check old imports, paths, names, or direct calls that should be gone. Check the new call path and dependency direction where possible. Run relevant tests, build, typecheck, or lint. If a check cannot run, report not verified.

## Never

Do not call the refactor complete when only names changed, old code still owns the work, old imports remain without explanation, the new dependency direction is unused, or current verification evidence is missing.
