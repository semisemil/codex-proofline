# Issue Ledger Protocol

Use this when a real side issue is found and it is not being fixed in the current approved scope.

## Record only when all are true

1. There is concrete evidence.
2. The issue is not fixed in the current task.
3. The issue can affect future work.
4. There is a suggested next step.

Do not record vague guesses, style preferences, temporary notes, or issues fixed immediately.

## Source of truth

The source of truth is:

`.proofline/issues/*.md`

Each issue is one Markdown file.

The dashboard files are static:

- `.proofline/dashboard/index.html`
- `.proofline/dashboard/style.css`
- `.proofline/dashboard/app.js`

Do not edit dashboard frontend files during normal issue registration.

## First issue flow

1. If `.proofline/` does not exist, copy `assets/state-starter/` into `.proofline/`.
2. Create the next issue file under `.proofline/issues/`.
3. Use the issue template from `assets/templates/issue.md`.
4. If Manifest Mode is enabled, update `.proofline/issues/index.json`.
5. Do not edit dashboard HTML/CSS/JS.
6. Mention the issue id in the final report.

## Issue id

Use this format:

`PL-0001`

Find the largest existing issue number and use the next one.

## Required fields

Each issue must include JSON front matter with:

- id
- status
- title
- discovered_while
- evidence
- risk
- suggested_next_step
- linked_context
- resolved_evidence
- created_at
- updated_at

## Status values

- open
- doing
- blocked
- resolved
- ignored

Resolved issues must include resolved evidence.
