---
name: start-implementation
description: "Explicit-only coordination of one ready Spec through recursive execution, mechanical Gates, and fresh blind boundary review."
---

# Proofline Start Implementation

Implement one ready Spec in one isolated Spec worktree. `execute(node)` is the only execution operation.

## Prepare and hand off

Resolve one current `ready` Spec and its revision, project instructions, domain document, ADRs, requirements, and authorized implementation scope. Apply [the work-link contract](../issue-ledger/references/work-link.md) once. Record the original checkout's HEAD, exact dirty state, and overlap with the target scope; overlapping pre-existing changes require `need_confirm` unless explicitly accepted as the baseline.

Run the v3 tree inspector. Reuse a complete valid tree. If no tree exists, apply [spec-slice](../spec-slice/SKILL.md) internally; it chooses root-only or bounded recursive decomposition and validates all Gates before fan-out. Stop on invalid artifacts, v1/v2 artifacts (`explicit re-slice required`), changed revision, or missing prerequisites. Read [model routing](assets/model-routing.md) only when the user selected or changed routing.

The original task calls `create_thread` once to create the user-visible Spec coordinator in a new worktree, sends this fixed preparation evidence in its initial assignment, then ends its turn. It performs no implementation or review.

## Task topology and callbacks

The Spec coordinator owns the one Spec worktree and calls `execute(root)`.

- For each selected runnable root-direct Slice, call `fork_thread(environment: { type: "same-directory" })`, then `send_message_to_thread` with that Slice's fixed subtree assignment. The fork shares the Spec worktree. Never use `create_thread` for a Slice or create a per-Slice worktree.
- A Slice task calls `execute(slice)` for its complete subtree. Deeper SubSlices stay recursive inside that task; they are not user-visible tasks.
- A root-only Spec stays in the Spec task and creates no Slice task.
- After sending an assignment, end the current turn. Do not poll, wait for a user reply, or follow progress. The receiving task sends one terminal callback with `send_message_to_thread` to the task that sent its current assignment, using the message sender metadata already available; briefs carry no callback `threadId` or `report_destination`. Then it ends its turn.

On callback, verify actual tree, task, worktree, and Gate state instead of trusting the report. Choose any runnable subset safe under `blocked_by`, `run_after`, effective-scope overlap, shared-worktree interaction, checks, and capacity; no numeric cap. Serialize unsafe work and every Git-index/review/commit operation.

## `execute(node)`

Leaf: the owning coordinator records a pre-wave snapshot, creates a fresh Leaf implementer with `spawn_agent(fork_turns: "none")`, and waits with `wait_agent`. Verify the actual wave delta is wholly inside the fixed Leaf `write_scope`, then run that Leaf Gate. Parallel Leaves require disjoint attributable deltas and non-interfering checks.

Branch: call `execute(child)` for currently runnable children. A child is complete only after its recursive result closes. When all children complete, run the Branch Gate. A direct Slice task runs its Slice Gate but leaves the direct Slice pending, sends its callback, and ends its turn. Only the Spec coordinator closes direct Slices and the root.

Give implementers only the fixed Node/root contract, linked Spec sections and Context, relevant project/domain/ADR instructions, parent-run Gate paths, current constraint delta, checkout root, and required changed-path/check/blocker report. Leaf and Repair agents never stage, commit, edit frozen Spec/Node/Gate definitions, or return design, scope, Gate, review, or whole-Spec verdicts.

Any `ABANDON` stops that path incomplete and cannot satisfy dependencies or ancestors.

## Boundary review and integration

After a direct-Slice callback and passing subtree Gates, the Spec coordinator alone:

1. stages only that Slice's exact product paths with `scripts/prepare-review.js stage`, recording the fingerprint; the index must otherwise be empty;
2. creates a fresh blind, read-only Slice reviewer with `spawn_agent(fork_turns: "none")` and waits with `wait_agent`;
3. on `pass`, verifies the fingerprint, commits only the reviewed staged paths locally in the same Spec worktree, and marks the direct Slice completed;
4. on `fail`, unstages those paths, assigns the deepest existing owning Node to the same Slice task with `send_message_to_thread`, then ends the turn; on `need_confirm` or no owning Node, stops for the decision or explicit re-slicing.

The reviewer receives only the boundary contract and linked context, exact reviewed diff, current Gate evidence, constraint delta, and report schema. Exclude implementation/repair history, self-judgment, prior verdicts, and expected verdict. Accept `pass | fail | need_confirm`; observations never block and durable non-duplicates go through [issue-ledger](../issue-ledger/SKILL.md).

After every direct Slice is reviewed and committed, the Spec coordinator runs the root Gate and full Spec checks, then creates and waits for one fresh Spec Integration reviewer over the complete base-to-current product diff. A root-only Spec has only this final review. No Slice task or implementer creates a reviewer.

## Repair

Assign a Gate or review failure to the deepest fixed Node/root that owns the violated contract. Its owning task creates a fresh Repair with `spawn_agent(fork_turns: "none")` and waits. Scope is that Node's effective execution scope; frozen definitions stay unchanged.

After code changes, invalidate the repaired Node and subtree, reverse-transitive `blocked_by` dependents and their subtrees, every ancestor, and affected Slice/root reviews. `run_after` changes order only. Re-close the affected set bottom-up with fresh Gates and boundary reviews. Stop if the same evidenced failure recurs after repair or a fixed Node reaches its third failure.

## Finish

After final review `pass`, the Spec coordinator marks the Spec completed and callbacks the original task, then ends its turn. The original task rechecks its recorded HEAD, dirty state, and non-overlap; applies only the exact product diff to the original checkout as uncommitted changes; and reruns destination Gates/checks. A failed destination check preserves both workspaces and reports incomplete. Never push; a final commit requires explicit authorization.

Report fresh tree/task/worktree state, changed paths, Gate totals, `ABANDON`, Slice and final judgments, local integration SHAs, destination evidence, or the exact stop reason. Archive terminal Slice and Spec tasks and remove the single Spec worktree only when its expected state makes non-forced removal safe; otherwise preserve its exact path.
