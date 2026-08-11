---
name: development-plan
description: "Create or revise a project development Plan under .proofline/plan from a rough concept for a product, feature, software system, or work system. Use when the user explicitly requests development planning or invokes this skill with a concept, Plan ID, or Plan path; produce the planning document without creating an implementation Spec or starting implementation."
---

# Proofline Development Plan

## Boundary

Modify only `.proofline/plan/**`. Produce and report the Plan; leave review, specification, slicing, and implementation to separate user requests.

Base project-specific claims on repository evidence and domain documents that affect the planning decision. Reuse evidence already inspected. Research externally when current facts, comparisons, standards, or available approaches materially affect the Plan, and cite the sources that influence it.

## Resolve the Plan

Resolve an explicit Plan path or ID directly. For creation, inspect Plan IDs and plausible same-goal Plans, then allocate the next unused `PLAN-0001`-form ID. Stop on target ambiguity; otherwise preserve unresolved choices in a `draft` instead of starting an interview.

Store each Plan at `.proofline/plan/<PLAN-ID>-<slug>/PLAN.md`. Keep its ID and location stable, update it in place without revision snapshots, and never overwrite a collision. Report `no-op` when the requested planning state already matches.

Use only this frontmatter:

```yaml
---
id: PLAN-0001
title: <stable title>
status: draft
---
```

Use only `id`, `title`, and `status`; serialize YAML safely and set `status` to `draft | ready`.

## Write the Plan

Write one coherent development-planning document that stands without the conversation. Choose its structure, length, examples, tables, and diagrams for the subject instead of filling a fixed outline.

Make the current problem, affected people or work, intended outcome, scope, and current solution direction concrete enough to judge. Supply the rationale and tradeoffs that support the direction. Include alternatives, risks, constraints, architecture, workflows, operational effects, and research only when they improve that judgment.

Keep facts, decisions, proposals or assumptions, material open questions, and out-of-scope work distinguishable. Preserve uncertainty at the resolution supported by the evidence; do not turn it into an invented fact, decision, or requirement.

Synthesize the current planning state rather than its discussion or investigation history. Link to authoritative detail instead of duplicating it. Record technical or architectural direction when it resolves a planning decision; leave the observable implementation contract and requirement identifiers to a later Spec.

## Set readiness

Use `ready` when the problem, intended outcome, scope, selected direction, and material tradeoffs and risks are clear enough to write an implementation Spec, with no unresolved decision that would materially change them. `ready` means the Plan is complete enough for that use; it does not mean user acceptance or authorize Spec creation or implementation.

Use `draft` while a material decision or uncertainty prevents that state. Preserve what is known and expose the gap. Return a revised `ready` Plan to `draft` when such a gap appears.

## Report

Report the operation, Plan ID and title, path, status, and material unresolved decisions, then end.
