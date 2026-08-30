---
name: start-implementation
description: "Explicit-only coordination of one ready Spec through recursive execution tasks, mechanical Gates, and fresh blind boundary review."
---

# Proofline Start Implementation

Implement one ready Spec through Root Slice Worktrees. The invoking task is the top coordinator; it owns no execution Node, implementation, Repair, or review.

## Prepare

Resolve the current `ready` Spec, revision, and authorized scope. Build one bounded evidence manifest after discovery and retain successful evidence until a relevant mutation. Potentially large command output is capped at 4,000 tokens and narrowed on truncation; generated, minified, binary, and large diff evidence is inspected by exact search, stats, and small ranges. Apply [the work-link contract](../issue-ledger/references/work-link.md) only for a named issue target. Record the invoking checkout's HEAD, exact dirty state, and target-scope overlap; unaccepted overlap requires `need_confirm`.

Run [the v3 tree inspector](../spec-slice/scripts/inspect-execution-tree.js) and reuse a complete valid tree. Use [the Gate runner](../spec-slice/scripts/run-gates.js) for every Gate `run` or `status` command. If no complete tree exists, apply [spec-slice](../spec-slice/SKILL.md) internally. Stop on invalid artifacts, v1/v2 artifacts (`explicit re-slice required`), changed revision, or missing prerequisites. Unless the user selected another route, use `gpt-5.6-luna` with `low` reasoning for holders and Slice coordinators, and `gpt-5.6-sol` with `medium` reasoning for implementation, Repair, and review. Read [model routing](assets/model-routing.md) only for a user-selected route or a listed risk escalation.

For an existing valid tree, the top coordinator reads the Spec and direct Root Slice documents once. Inspector output supplies descendant state; descendant coordinators read their own boundaries. Pass one plugin root and artifact links rather than copied contracts or repeated helper paths.

The required transport is `create_thread` Worktree creation, same-directory `fork_thread`, sender-metadata callbacks, and task-local reviewer agents. Stop incomplete when any required primitive is unavailable; no coordinator substitutes itself for a missing holder, child task, or reviewer.

## Fixed assignments

Read an assignment only when this task will render it, retain it, and use its code block as the complete prompt. Its fixed role marker arms the execution guard for that task. Assignment placeholders carry links or deltas; linked Spec, Node, Gate, environment, and inherited instructions are never copied into prompts.

Created and forked tasks inherit system, developer, and project instructions. Prompts contain only the role contract and information absent from inherited context or linked artifacts.

- Top coordinator: [Worktree holder](references/worktree-holder.md), then [Root-only implementation](references/root-only-implementation.md) for a root-only tree or [Slice coordinator](references/slice-coordinator.md) for a Root Slice
- Slice coordinator: [implementation task](references/implementation-task.md); Root Slice or integration review also uses [Reviewer](references/reviewer.md)
- SubSlice coordinator: reuse the Slice coordinator assignment with its own fixed boundary fields

The top coordinator reads only the holder and selected boundary assignment. A Slice coordinator receives the assignment directory and loads implementation or review prompts only when needed.

## Worktree handoff

For each selected runnable Root Slice, or once for a root-only tree:

1. The top coordinator calls `create_thread` at the recorded Spec base with the Worktree-holder assignment and the holder route.
2. On its ready callback, the top coordinator forks that holder with `fork_thread(threadId: <holder-task-id>, environment: { type: "same-directory" })`. Only this holder handoff supplies `threadId`.
3. For a root-only tree, assign the forked task the Root-only implementation prompt and implementation route. Otherwise assign it the Root Slice coordinator prompt and coordinator route. A bare `fork_thread` receives the assignment and route on its first `send_message_to_thread` turn.
4. The top coordinator ends every dispatch turn without `wait_threads`, `wait_agent`, polling, or progress reads.

The holder owns no Node or product work. Its separate task is required because Codex cannot create the target Worktree and directly return a ready same-directory execution owner in one primitive.

## Recursive tasks

A non-root-only Slice coordinator follows its fixed assignment and creates same-directory child tasks from its own task:

- Assigned Leaf boundary: fork one task with the implementation assignment.
- Assigned Branch: fork direct Branch children with the Slice-coordinator assignment and direct Leaf children with the implementation assignment.

After dispatch, end the coordinator turn. A coordinator never waits for or polls a child task. Every child sends one terminal `send_message_to_thread` callback to its assigning task using sender metadata, then ends its turn. Briefs contain no callback `threadId` or `report_destination`.

Choose a safe runnable subset from the frozen tree and capacity. On callback, use one [coordinator-state helper](scripts/coordinator-state.js) invocation instead of reconstructing Git, Gate, and tree state with separate reads. After accepting a Root Slice callback, synchronize only its permitted Node `status` and Gate evidence before dispatching dependents.

## Leaf implementation

Fill the implementation assignment with the Leaf link, Gate link, plugin root, current constraint delta, and Worktree. The Leaf document owns scope, Spec links, and Context.

The implementation task works directly from the frozen Leaf contract. After staging its final state, it may run one fixed Gate item through the Gate runner's `feedback` action; that action records evidence for coordinator reuse. It never runs a Gate command directly or adds a check. Test changes must map directly to the Leaf or linked Spec evidence. It callbacks only its Node ID and terminal state. Coordinator state runs only Gate items still unmet for that staged fingerprint and supplies every other fact.

A failed Gate or review returns only the evidenced failure to the deepest existing task that owns it. Resume that implementation task for a Leaf-owned Repair; a Branch coordinator routes a broader owned failure to its affected descendants. No owner means `explicit re-slice required`. The assigning coordinator ends its turn after sending the Repair.

For root-only, the task forked from the holder implements the Spec directly, stages the final state, closes the root Gate, creates and waits for the fresh Reviewer, repairs its own blocking findings, and commits only through `coordinator-state review-pass`. It sends the top coordinator one terminal result. There is no separate Slice coordinator or implementation callback for this shape.

After a Repair, invalidate the repaired Node and subtree, reverse-transitive `blocked_by` dependents and their subtrees, every ancestor, and affected reviews. `run_after` changes order only. Re-close the affected set bottom-up. Stop when the same evidenced failure recurs after Repair or a fixed Node reaches its third failure.

Any `ABANDON` leaves that path, its dependents, and ancestors incomplete.

## Close and review a Slice

On a completion callback, the coordinator-state `close` action verifies staged scope, reuses matching feedback evidence, runs only still-unmet items for that boundary, marks a completed Leaf or SubSlice, and returns the next action. The Root Slice closes bottom-up. Branch Gates decide combined behavior at the earliest completed boundary. Root-only uses its root Gate. Review begins only after every applicable completion check is met for the staged snapshot.

All Leaf changes in one Root Slice form one staged final state. `scripts/prepare-review.js snapshot` returns its paths, per-file change counts, and fingerprint; pass that compact manifest and the review boundary to the Reviewer without copying the Spec or diff. The Reviewer result is `pass | fail`; observations never affect it.

- `pass`: coordinator-state `review-pass` verifies the fingerprint, marks the permitted Root Slice or root-only Spec completed, commits the reviewed staged state, and returns the verified commit, paths, Gates, and unlocked dependents in one invocation. Callback that compact result. For root-only or the only direct Root Slice, this review is also the final Spec review.
- `fail`: keep the combined staged state, assign each blocking finding to the deepest existing owner, and end the coordinator turn. After callback and fresh Gates, snapshot and review the whole staged Slice again with a fresh Reviewer.

## Integration

Before a Root Slice with completed prerequisites starts, its coordinator integrates only the ordered reviewed prerequisite commits and records the resulting Slice base. Its review covers that base-to-staged product delta.

The top coordinator verifies each Root Slice callback mechanically with one `coordinator-state.js inspect` invocation containing the callback's `--commit` and `--fingerprint`, selects one compatible completed Root Slice Worktree as the integration Worktree, and cherry-picks only missing reviewed Slice commits in dependency order. It does not repeat semantic review or reopen the Spec after a passing boundary review. Stop on an unexpected commit, path, conflict, revision, or Worktree state.

For root-only, reuse its root Gate and final review. For exactly one direct Root Slice, verify its reviewed commit, fingerprint, and met subtree Gates, then reuse its Spec-boundary review without another Gate or reviewer. For two or more direct Root Slices, run only the root checks that prove their integration, then create one integration review. A successful check is reused while the integrated fingerprint is unchanged.

On final-review `fail`, assign the evidenced failure to the deepest existing owning task and repeat its affected Gates, Slice review, transport, integration checks, and fresh final review. No owner means `explicit re-slice required`.

## Finish

After final review `pass`, recheck the invoking checkout's recorded HEAD, dirty state, and non-overlap, then apply only the reviewed product diff as uncommitted changes. Preserve every successful Gate bound to the unchanged fingerprint. Run only still-unmet destination-specific root checks; descendant and already-met integration checks are not rerun. Failure preserves every workspace and reports incomplete. Never push; a final commit requires explicit authorization.

Report fresh tree/task/Worktree state, changed paths, Gate totals, `ABANDON`, Slice and final judgments, reviewed transport SHAs, destination evidence, or the exact stop reason. Archive terminal execution tasks and remove Worktrees only when expected state makes non-forced removal safe; otherwise preserve each exact path.
