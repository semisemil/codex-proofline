---
name: spec-slice
description: "Choose Direct or create a complete dependency-aware Slice plan for one ready Spec."
---

# Proofline Spec Slice

Decide execution units; do not implement product code, tests, or reviews.

## Inspect

Validate the target Spec identity, revision, project, requirements, and `ready` status. When the current revision already has Slice documents, run `node <this-skill>/scripts/inspect-slice-plan.js <slice-directory>`:

- Reuse a valid plan: v1 or mixed is sequential; v2 uses its concurrency limit.
- Stop for an invalid plan. Do not upgrade or replace it unless the user explicitly requests re-slicing.

## Decide

Choose `Direct` when no independent sub-goal can deliver and verify a meaningful outcome. Create no Slice documents or other mode artifact.

Choose `Sliced` when independent outcomes and their prerequisites can be defined before implementation. A Slice is an outcome, not a file, layer, component, or test category.

## Write Slices

Create the complete v2 plan from `assets/templates/slice.md` before implementation:

1. Record each outcome and its authoritative Spec section.
2. Put result prerequisites in `blocked_by`; put unsafe or uncertain concurrent execution in `run_after`.
3. Keep the combined graph acyclic and every initial status `pending`.
4. Record only Slice-unique and integration-only checks; keep shared acceptance in the Spec.
5. Add only the corresponding relative links to the Spec's `Slices` section.

Run the Slice plan inspector. Complete only when it accepts the current revision and every concurrently runnable pair is safe or ordered. Report `Direct`, `Sliced (sequential)`, or `Sliced (max 2)` and the Slice paths when applicable, then return the result to `../figure-it-out/SKILL.md` when it owns the explicit workflow.
