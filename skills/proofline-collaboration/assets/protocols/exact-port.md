# Exact Port Protocol

Use this when the user asks to port, migrate, copy, transplant, or preserve behavior exactly.

## Core rule

The source is authoritative.

Do not simplify, rewrite, omit, rename, or change behavior unless the user approved it.

## Before editing

Create a source-target mapping:

| Source | Target | Expected relation | Notes |
|---|---|---|---|

## Deviations

Any intentional difference must be listed as a deviation:

| Deviation | Reason | User approved? | Evidence |
|---|---|---|---|

## Completion

Do not say the port is equivalent unless there is comparison evidence.

Final report must separate:

1. confirmed equivalent parts
2. deviations
3. not verified parts
4. checks run

## Evidence examples

- same input/output test against source and target
- fixture comparison
- API response comparison
- snapshot comparison
- search for missing source functions, constants, or branches
- typecheck/build/test results
