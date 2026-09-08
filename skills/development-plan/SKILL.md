---
name: development-plan
description: "Create or revise a development Plan, clarifying rough ideas through dialogue. Use when the user requests development planning."
---

# Proofline Development Plan

Help the user discover and articulate what they want to make, then capture it in a self-contained development Plan. Dialogue serves the document: contribute concrete possibilities and judgment as well as questions, and adapt to how much of the idea is already settled.

## Boundary

Modify only `.proofline/plan/**`. For linked `PL-*`, apply `../issue-ledger/references/work-link.md`. Produce the Plan. When `../figure-it-out/SKILL.md` owns the explicit user request, return the result to that workflow; otherwise report it and leave review, specification, slicing, and implementation to separate user requests.

Base project-specific claims on repository evidence and domain documents that affect the planning decision. Reuse evidence already inspected. Research externally when current facts, comparisons, standards, or available approaches materially affect the Plan, and cite the sources that influence it.

## Resolve the Plan

Resolve an explicit Plan path or ID directly. For creation, inspect plausible same-goal Plans. Ask for clarification when the target is ambiguous. Reuse existing decisions and evidence; a focused revision or a sufficiently concrete request can proceed directly to writing.

## Develop the idea together

Start from the user's actual motivation: a frustrating situation, a desired experience, an obligation, or something they want to explore. When the idea is vague, ask for one concrete situation or example that would help establish who it is for and what should become possible. Let the purpose emerge; a personal tool or creative experiment does not need a business justification.

Choose the next question by which unresolved decision most changes the intended outcome, scope, or direction. Ask one focused question at a time and use the answer to advance the idea; avoid making the user fill out a planning template. Resolve factual questions from available evidence and keep implementation details for the later Spec unless they constrain a product decision.

When the user cannot answer, change the aid rather than repeat the question. Offer a small set of plausible interpretations with their consequences, or sketch a short usage scenario they can react to. Label these as proposals and allow a different direction. Prefer the smallest concrete example that exposes the choice; elaborate features and polished designs can anchor the user before the purpose is clear.

Exercise judgment against the user's purpose and constraints. When a proposed feature does not explain how it helps, or choices conflict, make the specific tension visible and suggest a focused alternative or a way to check the assumption. Distinguish a preference the user can decide from an empirical uncertainty that needs evidence. Repeated agreement or questioning cannot establish demand or feasibility.

As a direction emerges, summarize the intended experience, current scope, and remaining material choice in a few sentences or a short flow. Ask for confirmation only where a new interpretation or proposal requires the user's decision; reuse decisions already explicit in the conversation. Keep user decisions, inspected facts, agent proposals, and unverified assumptions distinct. Silence or a request to write is not acceptance of a proposed product choice.

Move to writing when the Plan can explain the purpose, a concrete use or work scenario, intended result, scope boundaries, and direction with its material tradeoffs. Use the readiness criteria below to identify gaps rather than extending the interview to settle every detail. If the user requests a draft now, pauses discovery, or a material uncertainty requires external validation, save the useful result as `draft` with the specific open decision and what would resolve it. A missing material user choice calls for a focused question, not an automatic end with an unresolved document.

## Store the Plan

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

Write the current Plan so its direction can be understood and judged without the conversation. Organize it around the purpose and intended users or actors, a concrete scenario and desired result, included and excluded scope, the selected direction and material tradeoffs, and unresolved decisions or assumptions. Adapt headings and depth to the project; omit inapplicable sections rather than inventing content to fill them. Preserve the status of proposals and assumptions, including how to resolve those that materially affect the direction.

Retain only rationale and tradeoffs that materially support the selected direction. Describe success in terms of what becomes possible or improves for the user. Record technical or architectural direction when it settles a planning decision; leave detailed acceptance conditions and the pre-implementation verification plan to a later Spec.

## Set readiness

Use `ready` when an implementation Spec can be written without reopening the conversation or inventing a material product decision, with no unresolved decision that would materially change the problem, intended outcome, scope, selected direction, or its material tradeoffs and risks. A choice is not material merely because implementation must fix it or expose it in a file, schema, or API. Leave a narrow repository-consistent default to the Spec or implementation when plausible choices do not materially change the requested capability, compatibility with an existing consumer or authority, safety, data retention, or meaningful scope and cost. `ready` means the Plan is complete enough for that use; it does not mean user acceptance or authorize Spec creation or implementation.

Use `draft` while a material decision or uncertainty prevents that state. Preserve what is known and expose the gap. Return a revised `ready` Plan to `draft` when such a gap appears.

## Report

Report the writer operation, Plan ID and title, path, status, registration result, and material unresolved decisions, then return to the owning workflow or end.
