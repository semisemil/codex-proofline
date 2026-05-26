# Codex Proofline

Codex Proofline is a lightweight collaboration quality layer for Codex.

It is not a separate CLI, runtime, daemon, server, or web app. It is a small set of Codex-native skills, templates, and repo-local state files that help Codex preserve scope, prove work before reporting completion, and keep side issues from being lost in chat.

## Why this exists

Codex is strong at development work, but long collaboration can still fail in avoidable ways:

- a large user request may be silently narrowed;
- a refactor may only rename files while the real structure stays the same;
- an exact port may become a similar rewrite;
- side issues found during work may disappear into the conversation;
- completion may be reported before real verification;
- final output may contain temporary chat wording instead of clean requirements.

Proofline gives Codex a small, repeatable set of rules for those moments.

The core idea is simple:

> Do not call work complete until there is current evidence from this task.

## What Proofline does

Proofline currently contains two skills.

### `proofline-collaboration`

Use this for day-to-day work quality.

It covers:

- **Scope Integrity**: keep the user's stated goal intact; split large work into checkpoints instead of silently shrinking it.
- **Completion Evidence**: report completion only with current proof such as tests, type checks, code search, call-path checks, or real interface checks.
- **Refactor Proof**: show that a refactor changed real structure, not only names or folders.
- **Exact Port**: treat the source as authoritative and separate confirmed equivalent parts, deviations, and unverified parts.
- **Issue Ledger**: record real unfixed side issues under `.proofline/issues/`.
- **Human-Friendly Cooperation**: prefer clear wording, readable code, and reports that help the user judge what happened.
- **Context Hygiene**: keep final artifacts clean; do not copy temporary chat wording or internal process details into them.

### `proofline-capability-growth`

Use this only when looking for repeated manual work that may deserve automation.

It covers:

- finding repeated, costly, stable manual workflows;
- checking whether an existing tool, script, test, CI job, or skill already solves the problem;
- creating a shortlist of automation candidates;
- rejecting broad or speculative automation;
- preparing an automation registration prompt only after user approval.

## Project structure

```text
skills/
  proofline-collaboration/
    SKILL.md
    assets/
      protocols/
      templates/
      state-starter/
        STATE.md
        config.json
        issues/
          PL-0000.example.md
          index.json
        dashboard/
          index.html
          style.css
          app.js

  proofline-capability-growth/
    SKILL.md
    assets/
      protocols/
      prompts/
      templates/

snippets/
  AGENTS.repo.minimal.md
  AGENTS.global.example.md
```

## Quick start

### 1. Install the skills

Clone this repository, then copy the skills into your Codex skills directory:

```bash
mkdir -p ~/.agents/skills
cp -R skills/proofline-collaboration ~/.agents/skills/
cp -R skills/proofline-capability-growth ~/.agents/skills/
```

### 2. Add the minimal repo instruction

For a project that should use Proofline, add the minimal instruction from:

```text
snippets/AGENTS.repo.minimal.md
```

The intended repo-level instruction is intentionally small:

```md
For large tasks, refactors, exact ports, or side-issue tracking, use `$proofline-collaboration`.
```

Use the global example only for your personal defaults:

```text
snippets/AGENTS.global.example.md
```

This keeps shared project instructions small and avoids turning `AGENTS.md` into a tool-specific rule dump.

### 3. Use the collaboration skill

In Codex, call the skill directly when needed:

```text
$proofline-collaboration
```

You can also mention the kind of work naturally:

```text
Refactor this module and prove that the call path actually changed.
```

```text
Port this implementation exactly from source to target. Do not rewrite it.
```

```text
Record any real side issues you find but do not fix in this task.
```

### 4. Use the capability growth skill only when needed

```text
$proofline-capability-growth
Review recent repeated manual work and propose automation candidates only if there is enough evidence.
```

This skill should not create automation immediately. It first makes a shortlist and waits for user approval.

## Repo-local state

Proofline keeps project state in a dedicated folder:

```text
.proofline/
  STATE.md
  config.json
  issues/
    PL-0001.md
    PL-0002.md
    index.json
  dashboard/
    index.html
    style.css
    app.js
```

This folder should be created only when needed:

- when the first real side issue is recorded;
- or when the user explicitly asks to initialize Proofline state.

By default, Proofline does not store work contracts, raw chat logs, long reasoning traces, or every verification note. It stores only issue information that should change future work.

## Issue ledger

Each issue is stored as one Markdown file under:

```text
.proofline/issues/
```

The source of truth is:

```text
.proofline/issues/*.md
```

The dashboard files are fixed frontend files and should not be edited during normal issue registration:

```text
.proofline/dashboard/index.html
.proofline/dashboard/style.css
.proofline/dashboard/app.js
```

A valid issue should include at least:

- `id`
- `status`
- `title`
- `discovered_while`
- `evidence`
- `risk`
- `suggested_next_step`
- `linked_context`
- `resolved_evidence`, when resolved
- `created_at`
- `updated_at`

## Dashboard

The issue dashboard is a static HTML/CSS/JS viewer.

It supports two loading modes.

### Local folder mode

Open:

```text
.proofline/dashboard/index.html
```

Then choose the `.proofline/issues` folder in the dashboard.

This mode does not need Python, Node, a server, or any build step.

### Manifest mode

When the dashboard is served over HTTP, it can load issue files from:

```text
.proofline/issues/index.json
```

This mode is useful for GitHub Pages, a local static server, or an internal documentation site.

## Design principles

Proofline follows these principles:

- Make the work contract visible before risky work.
- Treat current evidence as the only completion proof.
- Separate blocked from complete.
- Convert requirements into checkable conditions.
- Verify through the interface the user actually uses when possible.
- Keep the write surface small.
- Store only information that changes future work.
- Prefer clear words and readable code over clever output.
- Keep final artifacts independent from chat history.

## What Proofline is not

Proofline is not:

- a replacement for Codex;
- a standalone CLI;
- a runtime;
- a background daemon;
- a server;
- a project management app;
- a full issue tracker;
- a place to archive raw conversations.

It is a small harness that helps Codex act as a more careful, honest, and useful coding partner.
