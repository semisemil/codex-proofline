# Parallel planning

Use one flat plan only when independent work can proceed alongside the main implementer's own task. Each assignment must own a coherent Spec result with clear change boundaries and available interfaces. Keep tightly dependent implementation together; neither file count nor a target agent count establishes independence.

Write `PARALLEL.md` beside `SPEC.md`. Identify the Spec and revision once, then describe the main task and each delegated task using [the template](../assets/templates/parallel.md). For every task, retain its goal, linked Spec requirements, authorized change scope, and only the original context and interface definitions needed to implement it. Include completion conditions without inventing new acceptance requirements.

Before dispatch, check that concurrent write scopes do not overlap and each input or interface is available. If one task requires another's unfinished design or changes, the main implementer handles that dependency sequentially or revises the split before dispatch. Other independent work can continue.

The plan is an assignment aid, not another source of product requirements. It creates no recursive Nodes, parent/child execution states, or per-task Gate files. Implementation tests remain selectable as the change develops, subject to the Spec and user-required verification.

When no independent task justifies parallel execution, report that the main session should implement directly and create no plan. Preserve existing documents and records. The new workflow does not resume or automatically convert an in-progress legacy execution.
