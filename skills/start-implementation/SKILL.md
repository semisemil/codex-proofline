---
name: start-implementation
description: "Explicit-only coordination of one ready Spec through recursive execution, mechanical Gates, and fresh blind boundary review."
---

# Proofline Start Implementation

Coordinator only. Implement and review through fresh agents. The single execution operation is `execute(node)`.

## Prepare

1. Resolve one current `ready` Spec. Confirm its identity, revision, project, requirements, domain document, applicable ADRs, and linked-issue state. Apply [the work-link contract](../issue-ledger/references/work-link.md) once; issue content stays out of agent briefs.
2. Read and apply [spec-slice](../spec-slice/SKILL.md) internally, including its execution-tree contract. Run its inspector and consume the accepted v3 result for tree position, runnable work, order, scope, and Gate paths. Stop on v1, v2, or invalid artifacts; require explicit re-slicing where that contract does.
3. At run start, read [model routing](assets/model-routing.md) once, record the selected routes and reasons, and reuse them. Do not reread or re-select unless the user changes a routing setting.
4. Before fan-out, read [the execution loop](references/execution-loop.md). Read [Git integration](references/git-integration.md) only when Git or worktree handling applies.

Stop if a prerequisite is missing, the Spec is no longer `ready`, or its revision changes.

## `execute(node)`

Call `execute(root)` using only the accepted inspector result.

- **Leaf:** normal implementation agents are Leaf-only. Create a fresh implementer with `spawn_agent` and `fork_context: false`. Send only the Node/root contract, linked Spec sections, Context docs, Gate file, constraint delta, and report contract defined by the execution loop. Use the fixed Leaf scope from the execution-tree contract; Proofline Node, Gate, and Spec definitions remain coordinator-owned. The parent reruns every Leaf `CHECK` with `run-gates.js run`; an implementer report never completes the Leaf by itself.
- **Branch:** recursively execute only runnable children. Keep at most two safe Leaves active across the run, and use one at a time in a shared workspace. After every child is completed, run the Branch's own Gate.
- **Review:** reviewer positions are exactly each root direct child and the root. Give every root direct child exactly one fresh blind Slice review per attempt, only after its subtree Gates pass, including a direct child that is also a Leaf. Give the root only a fresh Spec Integration review after all descendants and the root Gate pass. Leaf status alone creates no reviewer, and deeper SubSlices receive none. When the Spec has no child Nodes, execute the root as the root Leaf, run its root Gate, then run exactly one Spec Integration review; run no Slice review.
- **Repair:** assign a mechanical Gate or reviewer failure to the same fixed failing Node/root contract that owns the violation, whether Leaf, Branch, or root. A reviewer `fail` names the deepest existing owning Node. Create every Repair as a fresh `spawn_agent` with `fork_context: false`; its allowed paths are exactly that contract's effective execution scope. Repair cannot expand scope or edit Node, Gate, or Spec definitions. If no existing Node owns the violation, use `need_confirm` or an explicit re-slice. Keep failure count and the repeated-failure stop per fixed Node. After a Repair changes code for its fixed Node/root, invalidate and re-close the accepted-tree affected closure defined by the execution loop; a root Repair invalidates the complete tree.

Accept only `pass | fail | need_confirm` reviewer judgments. Keep an `observation` non-blocking and preserve durable, non-duplicate observations through [issue-ledger](../issue-ledger/SKILL.md).

Any `ABANDON` reported by Gate status is an immediate incomplete stop. Dispatch no work for it, count it as neither resolved nor completed, and never mark its Node or an ancestor completed. Mark a Node `completed` only after its mechanical Gates and any review required by its position pass. Mark the Spec `completed` only after the root Spec Integration review passes.

## Report

Re-read current tree, task, workspace, Git, Gate, and review state before reporting. Include the tree; tasks and roots; changed paths; Gate met/total as `N/N`; every `ABANDON`; Slice and Spec Integration judgments; integrated SHAs, or the exact stop reason. Re-measure every number at report time.
