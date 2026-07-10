---
name: proofline-issue-ledger
description: Use when a real side issue is found but will not be fixed within the current approved scope. Record only evidence-backed issues that can affect future work and have a concrete suggested next step.
---

# Proofline Issue Ledger

## Record

Only record when there is concrete evidence, the issue is not fixed in the current task, it can affect future work, and there is a suggested next step.

Never record vague guesses, preferences, temporary notes, or issues fixed immediately.

## Write

Each issue is one Markdown file under `.proofline/issues/`.

If `.proofline/` does not exist, copy `assets/state-starter/` into `.proofline/`. Create the next `PL-0001`-style issue under `.proofline/issues/`, use `assets/templates/issue.md`, and mention the issue id in the final report.

Apply Proofline Baseline Quality to issue artifacts. Replace every `{{...}}` placeholder in the template before saving.

Required front matter:

- id
- status: open | doing | blocked | resolved | ignored
- title
- discovered_while
- description
- evidence
- risk
- impact
- suggested_next_step
- completion_criteria
- linked_context
- resolved_evidence
- created_at
- updated_at

Resolved issues must include resolved evidence.

Never edit dashboard files during normal issue registration.
