---
name: start-implementation
description: "Explicit-only coordination of one ready Spec through isolated Worktrees, mechanical Gates, and fresh boundary review."
---

# Proofline Start Implementation

Implement one ready Spec through isolated Root Slice Worktrees. The invoking task is the top coordinator; it does not implement, Repair, or review.

## Prepare

Resolve the ready Spec, revision, authorized scope, and original request. Reject a Plan or Spec that adds outcomes outside the request. Run the v3 tree inspector once and reuse its output until a control artifact changes.

Run:

`node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js capture --cwd <checkout> --spec <spec-directory> --node <spec-id>`

Retain its HEAD, destination fingerprint, active Spec relative path, and control fingerprint locally. Unaccepted product overlap requires `need_confirm`. Invalid artifacts, changed revision, or missing prerequisites stop before task creation.

Every child receives the Proofline baseline through `SessionStart` or `SubagentStart`. In hooks-disabled benchmark transport, inject that same baseline at child start. Do not copy the baseline into assignments.

## Roles and task identity

One task or agent has one immutable execution role for its lifetime. A new role requires a fresh task or a history-free agent. Never send a different `PROOFLINE_EXECUTION_ROLE` marker to an existing task.

- Top coordinator: orchestration only; no execution role marker
- Root-only or Root-Slice Leaf owner: `root-implementer`
- Branch owner: `slice-coordinator`
- Leaf agent: `implementer`
- Reviewer agent: `reviewer`

A same-directory fork is permitted only from one Branch coordinator to another Branch coordinator. Leaf implementers and Reviewers use `spawn_agent(fork_turns: "none")`. A Leaf assignment is implementation itself, not a coordinator that creates another session.

## Worktree preparation

For each runnable direct Root Slice, or once for a root-only Spec, create a Worktree task at the captured HEAD with its final owner assignment:

- root-only or direct Root Slice with no children: [direct review-boundary implementer](references/root-only-implementation.md)
- direct Root Slice with children: [Branch coordinator](references/slice-coordinator.md)

The owner first runs `prepare-worktree.js`. It validates the exact Worktree root and HEAD using process-local `safe.directory`, copies only the active Spec directory into the same repository-relative location, validates its revision and immutable definitions, and verifies Gate writes. All later execution uses that Worktree-local Spec and Gate path.

Do not create a holder task, copy all of `.proofline`, add global Git configuration, retry an environment failure as Repair, or pass the original Spec path to descendants. `environment_blocked` is returned once before implementation, Repair, or review starts.

## Recursive execution

Read an assignment only when rendering it and use its code block as the complete prompt.

A Branch coordinator dispatches only direct children:

- Branch: same-role, same-directory fork with [Branch coordinator](references/slice-coordinator.md)
- Leaf: one fresh history-free agent with [Leaf implementation](references/implementation-task.md)

The Leaf agent implements and stages its Leaf directly, then returns its terminal result to the assigning coordinator. It sends no callback. The coordinator waits for it and runs one `coordinator-state.js close --mode leaf`.

A nested Branch coordinates its children, then callbacks only its Node ID and terminal state; the assigning coordinator runs one `close --mode subslice`. Root Slice owners callback only after review. Do not send Worktree paths, fingerprints, base SHAs, artifact links, Gate evidence, or helper output except that the terminal Root owner must send its reviewed commit and current Worktree root for final application.

Stage product and mapped test paths only through `prepare-review.js stage`; Proofline Git helpers supply exact process-local `safe.directory`. A Leaf may run one already-frozen Gate item through `run-gates.js feedback` for useful local feedback. Completion checks run only through `coordinator-state.js close`.

## Repair

Route each evidenced failure to its deepest existing owner. Resume a Leaf through `followup_task`; resume a Branch in that same Branch task. The owner and role do not change. Re-close only the affected Node, its dependents, and ancestors, and use a fresh Reviewer for every changed review snapshot.

Stop on a repeated identical evidenced failure after Repair, a repair outside the frozen contract, missing ownership, or `environment_blocked`. Do not turn environment errors such as Gate `EPERM`/`EACCES`, dubious ownership, missing Worktree-local Spec, revision drift, or missing nested repository into implementation Repair.

## Root review

After the Root Slice or root-only completion Gates pass, retain the review fingerprint locally. Render [Reviewer](references/reviewer.md) with only paths, change counts, boundary link, plugin root, original request, and the exact safe read command. The fresh Reviewer reads a Root boundary through `prepare-review.js diff`; it runs no verification and changes no state.

On `pass`, `coordinator-state.js review-pass` verifies the retained fingerprint, marks the boundary complete, commits the reviewed product state, and returns the commit. A root-only Spec then callbacks. A direct Root Slice in a one-Root tree runs `coordinator-state.js finalize --mode single-root` with the captured base and retained Root review fingerprint; this runs the root Gate, proves the committed range is exactly the reviewed snapshot, and completes the Spec without another review. In a multi-Root tree, the Root owner callbacks after its own review. The callback contains only boundary ID, `state=reviewed`, commit, and current Worktree root.

On `fail`, Repair within the same owners, rerun affected Gates, and review the new whole Root snapshot with a fresh Reviewer.

## Integration

For one direct Root Slice, finalization already reused its Root review. For multiple direct Root Slices, resume one reviewed Root owner in the same task and role as the integration owner. Send it only the reviewed commits and source Worktree roots required for integration. In dependency order:

1. Verify every callback with `coordinator-state.js inspect --commit`.
2. Merge completed Node status and Gate evidence with `sync-control-state.js`; immutable definitions must match.
3. Apply missing reviewed commits with `integrate-reviewed.js`, which uses process-local Git trust and aborts cleanly on conflict.
4. Run `coordinator-state.js finalize --mode multi-root`; it runs only the frozen root Gate and returns the exact integrated range snapshot.
5. Give one fresh Reviewer the returned paths and a `prepare-review.js diff-range` command. On `pass`, run `coordinator-state.js finalize-review-pass` with the retained base, commit, and fingerprint.

The integration owner keeps its existing role. Do not assign an integration-only role marker, rerun already-current descendant checks, or send the final review fingerprint through task callbacks. A changed commit, path, definition, revision, or Worktree state stops integration.

## Finish

After final review passes, run:

`node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js apply-reviewed --cwd <checkout> --source <terminal-worktree> --spec <worktree-local-spec> --node <spec-id> --base <captured-head> --commit <reviewed-commit> --destination-fingerprint <captured-destination-fingerprint> --control-fingerprint <captured-control-fingerprint>`

This revalidates both checkouts, the reviewed product range, the unchanged original Spec, and immutable Worktree definitions. It applies the reviewed product range as uncommitted changes and merges only monotonic Spec/Slice status plus Gate check state, evidence, and execution metadata. It never overwrites Spec requirements, Gate definitions, Slice structure, dependencies, or write scope. Any validation or write failure rolls back the application and leaves the original control artifacts unchanged.

Never push. A final commit requires explicit authorization. Remove terminal Worktrees only when ordinary non-forced removal is safe; otherwise report the remaining path.
