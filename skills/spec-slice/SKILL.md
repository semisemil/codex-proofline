---
name: spec-slice
description: "Explicit-only planning of useful independent parallel work for a ready Spec, without implementation or dispatch."
---

# Proofline Spec Slice

Plan only. This optional step identifies independent work that benefits from parallel execution; a ready Spec can proceed directly to implementation.

## Inspect

Resolve the target Spec's identity, revision, requirements, and `ready` status. Read [parallel planning](references/parallel-plan.md) before choosing assignments. Preserve the Spec's authorized outcomes without renaming its identifiers, output fields, paths, commands, or quantities.

## Plan

Split only when each task has a clear goal, change scope, and interface and can proceed independently while the main session implements another part. Dependent sequential work stays with the main implementer. File count and desired agent count do not justify splitting.

When parallel work is useful, write one `PARALLEL.md` in the same directory as `SPEC.md`, using [the parallel plan template](assets/templates/parallel.md). Record each task's goal, Spec evidence, change boundaries, and necessary context and interfaces, including the main implementer's work. Keep assignments flat and write ownership non-conflicting. Do not generate Node or Gate files or change the Spec's contract.

If no useful independent work exists, report direct implementation and create no parallel plan. Preserve existing documents and records; resuming or converting a legacy execution is outside this operation.

## Validate and report

Check that every planned task traces to the ready Spec, its inputs and interfaces are available, its scope stays authorized, and concurrent writes do not overlap. Resolve a dependent or conflicting assignment by keeping it sequential or revising the split.

Report the Spec path and revision, the optional `PARALLEL.md` path, and the reason for parallel or direct implementation. Planning ends before implementation, project verification, review, or agent dispatch.
