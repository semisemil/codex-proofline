# Refactor Proof Protocol

Use for refactor, restructuring, responsibility split, dependency cleanup, architecture change, module boundary change, or state/data flow change.

## Before editing

Define the intended structural change:

- current -> intended responsibility owner
- current -> intended call path
- current -> intended dependency direction
- current -> intended state/data flow

## Proof required

A rename-only change is not a completed refactor.

Completion needs evidence that at least one real structure changed:

- call path changed
- responsibility moved
- dependency direction changed
- state/data owner changed
- old coupling was removed or reduced

## Checks before completion

- Search for old imports, paths, names, or direct calls that should be gone.
- Check the new call path.
- Check dependency direction where possible.
- Run relevant tests, build, typecheck, or lint.
- If a check cannot run, report it as not verified.

## Failure cases

Do not call the refactor complete when only names changed, old code still owns the work, old imports remain without explanation, the new dependency direction is unused, or current verification evidence is missing.
