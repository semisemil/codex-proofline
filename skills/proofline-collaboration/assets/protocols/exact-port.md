# Exact Port Protocol

Use when the user asks to port, migrate, copy, transplant, preserve behavior exactly, or avoid rewriting.

## Core rule

The source is authoritative. Do not simplify, rewrite, omit, rename, or change behavior unless the user approved it.

## Before editing

Create a source-target mapping:

| Source | Target | Expected relation | Notes |
|---|---|---|---|

## Deviations

List every intentional difference:

| Deviation | Reason | User approved? | Evidence |
|---|---|---|---|

## Completion

Do not claim equivalence without comparison evidence.

Final report must separate:

1. confirmed equivalent parts
2. deviations
3. not verified parts
4. checks run

Evidence can include same-input/output tests, fixture/API/snapshot comparison, search for missing source parts, and typecheck/build/test results.
