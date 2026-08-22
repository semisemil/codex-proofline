---
name: start-implementation
description: "Explicit-only coordination of one ready Spec through recursive execution, mechanical Gates, and fresh blind boundary review."
---

# Proofline Start Implementation

Coordinate one ready Spec through user-visible tasks and fresh internal agents. The single execution operation is `execute(node)`.

## Prepare

1. Resolve one current `ready` Spec. Confirm its identity, revision, project, requirements, domain document, applicable ADRs, and linked-issue state. Apply [the work-link contract](../issue-ledger/references/work-link.md) once; issue content stays out of agent briefs.
2. Read and apply [spec-slice](../spec-slice/SKILL.md) internally, including its execution-tree contract. Run its inspector and consume the accepted v3 result for tree position, runnable work, order, scope, and Gate paths. Stop on v1, v2, or invalid artifacts; require explicit re-slicing where that contract does.
3. At run start, read [model routing](assets/model-routing.md) once, record task settings and internal-agent routes with reasons, and reuse them. Do not reread or re-select unless the user changes a routing setting.
4. Before fan-out, read [the execution loop](references/execution-loop.md). Read [Git integration](references/git-integration.md) only when Git or worktree handling applies.

Stop if a prerequisite is missing, the Spec is no longer `ready`, or its revision changes.

## `execute(node)`

Call `execute(root)` using only the accepted inspector result.

- **Root:** the user-visible Spec integration task is the Spec coordinator and calls `execute(root)`. For every runnable root-direct Slice, create or fork an actual user-visible Slice task through the platform task/thread equivalent; never substitute a `spawn_agent` implementation worker. That Slice task calls `execute(slice)` and coordinates its entire subtree. Deeper SubSlices recurse inside the same Slice task. A root-only Spec stays in the Spec integration task and creates no Slice task.
- **Leaf:** the owning execution coordinator creates a fresh implementer with `spawn_agent` and `fork_context: false`. Normal implementation agents are Leaf-only. Send only the fixed contract and brief fields defined by the execution loop. The owning coordinator reruns every Leaf `CHECK`; an implementer report never completes the Leaf by itself.
- **Branch:** recursively execute only currently runnable children. The inspector exposes every mechanically safe runnable candidate; the model chooses how many safe Slice tasks or Leaves to run concurrently from dependencies, write-scope safety, shared-workspace safety, task size, and available capacity. There is no numeric concurrency limit. After every child is completed, the owning coordinator runs the Branch Gate.
- **Review:** the Spec coordinator alone creates every fresh blind read-only reviewer with `spawn_agent` and `fork_context: false`. Review positions are each root-direct Slice and the root. A Slice review runs after its subtree Gates pass; final Spec Integration review runs after all direct Slices, the root Gate, and full Spec checks pass. Deeper SubSlices receive no review. A root-only Spec receives only Spec Integration review.
- **Repair:** route a Gate or review failure to the task owning the deepest fixed Node/root contract. That task creates a fresh Repair with `spawn_agent` and `fork_context: false`. Repair cannot expand scope or edit frozen Node, Gate, or Spec definitions. If no existing Node owns the violation, use `need_confirm` or explicit re-slicing. Keep failure count and the repeated-failure stop per fixed Node. After a Repair changes code, invalidate and re-close the accepted-tree affected closure defined by the execution loop; a root Repair invalidates the complete tree.

Accept only `pass | fail | need_confirm` reviewer judgments. Keep an `observation` non-blocking and preserve durable, non-duplicate observations through [issue-ledger](../issue-ledger/SKILL.md).

Any `ABANDON` reported by Gate status is an immediate incomplete stop. Dispatch no work for it, count it as neither resolved nor completed, and never mark its Node or an ancestor completed. A Slice coordinator may close descendants and update subtree Gate evidence, but only the Spec coordinator closes a root-direct Slice after fresh Blind Review and integrated subtree Gates pass. The Spec coordinator owns root Gate/status and marks the Spec `completed` only after final Spec Integration Review passes.

## Report

Re-read current tree, task, workspace, Git, Gate, and review state before reporting. Include the tree; tasks and roots; changed paths; Gate met/total as `N/N`; every `ABANDON`; Slice and Spec Integration judgments; integrated SHAs, or the exact stop reason. Re-measure every number at report time.
