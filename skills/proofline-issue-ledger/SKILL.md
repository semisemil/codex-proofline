---
name: proofline-issue-ledger
description: Record and update concrete bugs, tasks, features, research, documentation, and maintenance in a project-local ledger. Use when the user asks to register or update project work, or when durable out-of-scope work should be preserved.
---

# Proofline Issue Ledger

## Record

Record durable work with a source, reason, next step, or completion criterion. When the user explicitly requests a new item, treat the request and current task context as sufficient source material; do not investigate solely to register it. Reject vague guesses, preferences, temporary notes, and immediately completed work without future value when registration was not explicitly requested.

## Update

For an update request, change the matching existing file. Change `status`, append concrete `work_log` entries containing `at`, `status`, `summary`, and an `evidence` array, set `updated_at`, and preserve history. Set `resolved` only after `completion_criteria` are met and `resolved_evidence` contains proof.

## Write

Store one Markdown file per issue under `.proofline/issues/`. If `.proofline/` is absent, copy `assets/state-starter/` there.

Before writing or updating an issue, read `../proofline-baseline-quality/SKILL.md` completely and apply it to the entire issue artifact.

For a new item, read existing front matter only for ids and titles, avoid only obvious title duplicates, create the next `PL-0001`-style id with `assets/templates/issue.md`, replace every `{{...}}` placeholder, and cite the id in the final report. Infer fields from the current context; use empty values or `unknown` when information is unavailable. Ask only when the item's identity or scope cannot be stated accurately.

Required new-item front matter: `id`; `type: bug | task | feature | research | documentation | maintenance`; `status: open | doing | blocked | resolved | ignored`; `title`; `discovered_while`; `description`; `evidence`; `risk: critical | high | medium | low`; `impact`; `suggested_next_step`; `completion_criteria`; `linked_context`; `work_log`; `resolved_evidence`; `created_at`; `updated_at`.

`discovered_while`: creating task, review, request, or investigation. `risk` is severity only; put consequences in `impact`. For non-defects, rate delivery or compatibility risk; `evidence`: requirement or decision source. Existing files without `type` or `work_log` remain valid; add them only on the next meaningful update, never for field migration alone.
