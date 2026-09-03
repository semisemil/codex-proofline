---
name: development-plan
description: "Create or revise a project development Plan under .proofline/plan from a rough concept for a product, feature, software system, or work system. Use when the user explicitly requests development planning or invokes this skill with a concept, Plan ID, or Plan path; produce the planning document without creating an implementation Spec or starting implementation."
---

# Proofline Development Plan

## Boundary

Modify only `.proofline/plan/**`. For linked `PL-*`, apply `../issue-ledger/references/work-link.md`. Produce the Plan. When `../figure-it-out/SKILL.md` owns the explicit user request, return the result to that workflow; otherwise report it and leave review, specification, slicing, and implementation to separate user requests.

Base project-specific claims on repository evidence and domain documents that affect the planning decision. Reuse evidence already inspected. Research externally when current facts, comparisons, standards, or available approaches materially affect the Plan, and cite the sources that influence it.

## Resolve the Plan

Resolve an explicit Plan path or ID directly. For creation, inspect plausible same-goal Plans. Stop on target ambiguity; otherwise preserve unresolved choices in a `draft` instead of starting an interview.

Store each Plan at `.proofline/plan/<PLAN-ID>-<slug>/PLAN.md`. Keep its ID and location stable, update it in place without revision snapshots, and never overwrite a collision. Report `no-op` when the requested planning state already matches.

Write Plan files only through `node <plugin-root>/writers/document-writer.js write --kind plan --project-root <absolute-project-root> --relative-path <project-relative-plan-path>`, passing the complete UTF-8 Markdown on stdin in one tool call. Report its separate `write` and `registration` results.

Use only this frontmatter:

```yaml
---
id: PLAN-0001
title: <stable title>
status: draft
---
```

Use only `id`, `title`, `status`, and optional nonempty `related_issues` for explicit `PL-*` targets; omit it for standalone Plans. Serialize YAML safely and set `status` to `draft | ready`.

## Write the Plan

Develop the user's rough idea and current planning conversation only far enough to choose a concrete direction inside the requested outcome. Treat the requested outcome and every explicit boundary as the Plan's scope ceiling. Preserve explicit identifiers, output field names, paths, commands, quantities, and examples as contract terms; do not generalize, translate, or rename them. Repository evidence constrains delivery; it does not add adjacent features, generic hardening, cleanup, migration, future extensibility, or new product goals. Include supporting work only when omitting it would leave a requested result incomplete or break an existing contract on the changed path. Treat the initial idea, later clarifications, corrections, and confirmed choices as sources; synthesize their current effect rather than recounting the conversation.

Write the current Plan so its direction can be understood and judged without the conversation. Retain only rationale and tradeoffs that materially support the selected direction. Record technical or architectural direction when it settles a planning decision; leave observable acceptance conditions and the pre-implementation verification plan to a later Spec.

## Set readiness

Use `ready` when an implementation Spec can be written without reopening the conversation or inventing a material product decision, with no unresolved decision that would materially change the problem, intended outcome, scope, selected direction, or its material tradeoffs and risks. A choice is not material merely because implementation must fix it or expose it in a file, schema, or API. Leave a narrow repository-consistent default to the Spec or implementation when plausible choices do not materially change the requested capability, compatibility with an existing consumer or authority, safety, data retention, or meaningful scope and cost. `ready` means the Plan is complete enough for that use; it does not mean user acceptance or authorize Spec creation or implementation.

Use `draft` while a material decision or uncertainty prevents that state. Preserve what is known and expose the gap. Return a revised `ready` Plan to `draft` when such a gap appears.

## Report

Report the writer operation, Plan ID and title, path, status, registration result, and material unresolved decisions, then return to the owning workflow or end.
