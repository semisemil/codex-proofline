---
name: spec-slice
description: "Determine whether a ready Spec can be divided before implementation into Slices that can each be implemented and verified independently, and, when needed, create all Slice documents and Spec links. Use when the user requests that a Spec be divided or when start-implementation must decide the execution mode."
---

# Proofline Spec Slice

Design only the execution units for one Spec. Do not implement product code or tests or create implementation sessions or reviewers.

## Target

Locate the requested `.proofline/specs/<SPEC-ID>-*/SPEC.md`. Proceed only when its identity, schema, revision, requirements, project, and `ready` status are valid. Do not divide a Spec in a terminal state.

If Slice documents for the current revision already exist, check the plan's completeness and dependencies and reuse them as-is. Do not reuse Slices from another revision.

## Decision

Determine whether the Spec can be divided into independent sub-goals (Sub Goals), each of which can be implemented and verified in one pass. A Slice is one sub-goal for completing the entire Spec, not an arbitrary division by file, layer, component, or test type.

If there are no meaningful Slices, do not create any documents and report `Direct`.

## Writing Slices

If there are meaningful Slices, write the complete plan before product implementation.

1. Create every Slice document from `assets/templates/slice.md`.
2. Store them at `slices/SLICE-<NN>-<slug>.md` under the Spec directory.
3. Record the independent outcome each Slice delivers and the corresponding `REQ-*`.
4. Record only actual prerequisite Slices in `blocked_by` and make the dependency graph acyclic.
5. Set the initial status of every Slice to `pending`.
6. Add relative links to every Slice document in the Spec's `Slices` section.

Do not copy requirements or completion conditions into a Slice. Add only boundaries or verification that are unique to the Slice and absent from the Spec. Do not change the Spec body outside the `Slices` section.

After completion, report the execution mode as `Sliced` and provide the paths of the Slices that were created or reused.
