# Refactor Proof Protocol

Use this for refactors, restructuring, responsibility split, dependency cleanup, state flow changes, or architecture changes.

## Before editing

Define the intended structural change.

At minimum, identify:

1. current responsibility owner
2. intended responsibility owner
3. current call path
4. intended call path
5. current dependency direction
6. intended dependency direction
7. current state/data flow
8. intended state/data flow

## Structural proof

A refactor is not complete if only names, files, or folders changed.

Completion needs evidence that at least one meaningful structure changed:

- call path changed
- responsibility moved
- dependency direction changed
- state/data owner changed
- old coupling was removed or reduced

## Required checks

Before reporting completion:

1. Search for old imports, paths, names, or direct calls that should be gone.
2. Check the new call path.
3. Check dependency direction where possible.
4. Run relevant tests, build, typecheck, or lint.
5. If a check cannot be run, report it as not verified.

## Failure cases

Do not call the refactor complete when:

- only names changed;
- a new wrapper exists but old code still owns the work;
- old imports remain without explanation;
- the new dependency direction is not actually used;
- no current verification evidence exists.
