# Completion Evidence Protocol

Do not report completion before checking the current work.

## Valid evidence

Use current-task evidence only:

- tests, build, typecheck, lint
- code search, dependency check, call path check
- source-target comparison
- actual app, CLI, API, or UI behavior

## Invalid evidence

Do not use intention, memory, past success, "looks right", indirect confidence, or unrun checks as completion proof.

## Report rules

Separate:

1. Completed
2. Verified
3. Not verified
4. Blocked
5. Issues recorded

If verification cannot run, say why.

## Keep it short

Use one concrete line per check:

- `pnpm test parser`: passed
- `rg "LegacyParser" src/ui`: no matches
- Not verified: real payment token flow; no test credentials
