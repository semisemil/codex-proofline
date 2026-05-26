# Issue Ledger Protocol

Use when a real side issue is found and will not be fixed in the current approved scope.

## Record only when all are true

- There is concrete evidence.
- The issue is not fixed in the current task.
- The issue can affect future work.
- There is a suggested next step.

Do not record vague guesses, preferences, temporary notes, or issues fixed immediately.

## Source of truth

Each issue is one Markdown file:

`.proofline/issues/*.md`

Dashboard files are static and must not be edited during normal issue registration:

- `.proofline/dashboard/index.html`
- `.proofline/dashboard/style.css`
- `.proofline/dashboard/app.js`

## First issue flow

1. If `.proofline/` does not exist, copy `assets/state-starter/` into `.proofline/`.
2. Create the next `PL-0001`-style issue under `.proofline/issues/`.
3. Use `assets/templates/issue.md`.
4. Mention the issue id in the final report.

## Required JSON front matter

- id
- status: open | doing | blocked | resolved | ignored
- title
- discovered_while
- evidence
- risk
- suggested_next_step
- linked_context
- resolved_evidence
- created_at
- updated_at

Resolved issues must include resolved evidence.
