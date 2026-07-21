---
name: proofline-implementation-spec
description: Create, revise, complete, cancel, or supersede implementation PRDs under .proofline/prds without implementing them. Use for durable implementation specifications or explicit invocation.
---

# Proofline Implementation Spec

## Boundaries

- Modify only `.proofline/prds/**`; never implement.
- Do not copy `AGENTS.md` or system/developer/formatting/build policy. Record only behavior, scope, acceptance, or validation constraints.
- Cite only necessary `path:line` evidence. Record hashes only when byte identity or artifact integrity is required.

## Resolve

Resolve explicit path/ID directly. For creation, inspect IDs and active same-goal candidates; read only plausible bodies. Prefer one active `draft | ready | blocked` PRD; stop on ambiguity.

Before writing, compare meaning, metadata, lifecycle, and links. If already matched, report `no-op`; do not rewrite, snapshot, revise, or retimestamp.

Path: `.proofline/prds/<PRD-ID>-<slug>/PRD.md`. Allocate above the largest directory/front-matter ID, recheck before creation, and never overwrite collisions. Keep ID/slug fixed. Snapshots: `revisions/REV-<revision>.md`. Use offset-bearing ISO 8601 timestamps; create no global index.

## Contract

Create from `assets/templates/prd.md`; preserve order, replace every placeholder, and serialize JSON safely. Omit empty optional sections. Retain existing layouts; never revise only for a new convention.

Require `schema_version: 1`; `PRD-0001`-form `id`; stable `title`; `kind` in `feature | bug | refactor | exact_port | maintenance`; `status` in `draft | ready | blocked | completed | cancelled | superseded`; positive `revision`; created/updated timestamps; terminal-only `archived_at`; arrays `supersedes`/`related_issues`; nullable `superseded_by`.

Preserve unknown valid metadata. Use stable `REQ-001`/`AC-001` IDs and map every AC to its REQs. Store no model or reasoning setting.

`blocked` means durable prerequisite; task/tool failure never changes status. Never move/delete/rewrite a terminal PRD body; later product changes require a new PRD.

## Content

Inspect only enough current sources for material claims. Separate facts/assumptions/decisions; state outcome/context, scope, requirements/acceptance, validation, and relevant boundaries. Leave design open unless user-confirmed.

Cover errors, compatibility, data, security, migration, and rollback only when supported by a requirement, trust boundary, reachable path, or obligation. Do not repeat invariants/invent requirements.

## Operations

- **Create:** Allocate the fixed ID/directory, write revision `1`, and apply the ready gate.
- **Major revision:** Before changing goal, behavior, requirements, scope, acceptance/validation, policy, or a blocker-resolving decision, snapshot current. Never overwrite a differing snapshot. Increment once, update time/status, invalidate old evidence.
- **Operational edit:** Do not revise for typo/formatting, evidence/issue/supersession links, timestamps, or lifecycle-only changes.
- **Terminal:** Complete only with same-revision implementation, validation, and fresh passing post-review; cancel only by user; supersede by linking both PRDs. Set terminal timestamps; preserve body/location.

## Ready and report

Set `ready` only when behavior/project are clear, requirements/acceptance agree, scope/material boundaries are explicit, no decision/prerequisite remains, and validation is executable or justifiably omitted.

Never ask for implementation approval. Report operation, ID/title/path, revision/status, created snapshot, confirmed decisions, blockers, and that no implementation occurred.
