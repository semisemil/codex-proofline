# Completion Evidence Protocol

Do not report completion before checking the current work.

## Valid evidence

Use evidence from this task only:

- tests
- build
- typecheck
- lint
- code search
- dependency check
- call path check
- source-target comparison
- actual app, CLI, API, or UI behavior

## Invalid evidence

Do not use these as completion evidence:

- intention
- memory
- past success
- "looks right"
- indirect confidence
- unrun checks

## Report rules

Separate:

1. Completed
2. Verified
3. Not verified
4. Blocked
5. Issues recorded

If verification cannot be run, say why.

## Small report rule

Keep verification short but concrete. Prefer one line per check:

- `pnpm test parser`: passed
- `rg "LegacyParser" src/ui`: no matches
- Not verified: real payment token flow, no test credentials available
