---
name: proofline-issue-ledger
description: Persist verified problems, planned tasks, features, research, documentation, and maintenance in a project-local ledger with status, work history, completion criteria, and evidence.
---

# Proofline Issue Ledger

## Record

Record only durable work with a concrete source, reason, next step, or completion criterion. Reject vague guesses, preferences, temporary notes, and immediately completed work without future value. Evidence may be observed behavior, a user-approved requirement, a decision, a file, or a command result.

## Update

Update the existing file; never duplicate it. Change `status`, append concrete `work_log` entries containing `at`, `status`, `summary`, and an `evidence` array, set `updated_at`, and preserve history. Set `resolved` only after `completion_criteria` are met and `resolved_evidence` contains proof.

## Write

Store one Markdown file per issue under `.proofline/issues/`. If `.proofline/` is absent, copy `assets/state-starter/` there.

Before each record or update, read only bundled `assets/state-starter/dashboard/VERSION` and project `.proofline/dashboard/VERSION`. Missing, invalid, or project `<` bundled: copy bundled dashboard files over `.proofline/dashboard/`. Project `>=` bundled: no change. No other dashboard edits; refresh must not modify `.proofline/issues/` or anything outside `.proofline/dashboard/`.

Apply Proofline Baseline Quality to every issue artifact. New item: create the next `PL-0001`-style id with `assets/templates/issue.md`, replace every `{{...}}` placeholder, and cite the id in the final report.

Required new-item front matter: `id`; `type: bug | task | feature | research | documentation | maintenance`; `status: open | doing | blocked | resolved | ignored`; `title`; `discovered_while`; `description`; `evidence`; `risk`; `impact`; `suggested_next_step`; `completion_criteria`; `linked_context`; `work_log`; `resolved_evidence`; `created_at`; `updated_at`.

`discovered_while`: creating task, review, request, or investigation. For non-defects, `risk`: delivery or compatibility risk; `impact`: importance; `evidence`: requirement or decision source. Existing files without `type` or `work_log` remain valid; add them only on the next meaningful update, never for field migration alone.
