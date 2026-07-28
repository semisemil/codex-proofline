# Work Slicing

Read this only when deciding whether one ready Spec exceeds a single implementation task.

## Decide

Implement directly unless at least one condition holds:

- The Spec has multiple independently verifiable outcomes that can land without leaving a horizontal layer incomplete.
- Work has a real dependency sequence, including an expand-migrate-contract refactor.
- The implementation plus its evidence is unlikely to fit one task context.

Do not Slice a small coherent change. Do not divide by file, component, layer, or test type merely to make smaller units.

## Plan

Before writing, record the VCS HEAD and pre-existing changed paths in coordinator history as the chain baseline. Store Slices at `.proofline/specs/<SPEC-ID>-<slug>/slices/SLICE-<NN>-<slug>.md` using `assets/templates/slice.md`. Create the complete acyclic plan before product edits.

Each Slice must:

- deliver one independently verifiable vertical outcome or one necessary expand/migrate/contract phase;
- fit one implementation task context;
- reference parent `REQ-*` IDs without copying their contract text;
- list only real Slice dependencies in `blocked_by`;
- omit repository policy, generic tests, discussion, and evidence logs.

Use `pending | in_progress | completed`. The frontier is every `pending` Slice whose `blocked_by` entries are `completed`; readiness is derived, not stored. Mark the selected Slice `in_progress` after its task is created successfully and `completed` only after its Slice review passes. Execute one frontier Slice at a time unless the user explicitly requests isolated parallel work.

Keep the body minimal:

```markdown
## Delivers

<unique outcome or refactor phase>

## Covers

- REQ-001
```

Add `Boundaries` or `Verification` only when unique to that Slice and absent from the parent Spec. A REQ may span Slices only when each `Delivers` line makes the distinct portion explicit.

Reuse a valid plan for the same Spec revision. On revision change, replace the plan before implementation and treat all prior Slice status/evidence as stale. If no meaningful plan exists, use direct mode and create no Slice files.
