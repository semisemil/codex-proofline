---
name: start-implementation
description: "Explicit-only coordination of one ready Spec through isolated Worktrees, mechanical Gates, and fresh boundary review."
---

# Proofline Start Implementation

Implement one ready Spec through isolated Root Slice Worktrees. The invoking task is the top coordinator; it does not implement, Repair, or review.

## Prepare

Resolve the ready Spec, revision, authorized scope, and original request. Reject a Plan or Spec that adds outcomes outside the request. When this invocation immediately follows its own `figure-it-out` Preparation result with `scope=verified-to-original-request`, reuse that fresh scope evidence; a direct `start-implementation` call must read the Spec once against the request. Run the v3 tree inspector once and reuse its output until a control artifact changes.

Run:

`node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js capture --cwd <checkout> --spec <spec-directory> --node <spec-id>`

Only when it returns `action=dispatch`, retain its HEAD, destination fingerprint, active Spec relative path, control fingerprint, and dispatch descriptor locally. The descriptor is generated from that validated tree and is valid only with its embedded control fingerprint. Use its exact boundary and Gate paths, owner, mode, and single/multi-root finalization; do not scan the Spec directory to rediscover them. Unaccepted product overlap requires `need_confirm`. Invalid artifacts, changed revision, or missing prerequisites stop before task creation.

Every child receives the Proofline baseline through `SessionStart` or `SubagentStart`. In hooks-disabled benchmark transport, inject that same baseline at child start. Do not copy the baseline into assignments.

## Roles and task identity

One task or agent has one immutable execution role for its lifetime. A new role requires a fresh task or a history-free agent. Never send a different `PROOFLINE_EXECUTION_ROLE` marker to an existing task.

- Top coordinator: orchestration only; no execution role marker
- Root-only or Root-Slice Leaf owner: `root-implementer`
- Branch owner: `slice-coordinator`
- Leaf work-packet agent: `implementer`
- Reviewer agent: `reviewer`

A same-directory fork is permitted only from one Branch coordinator to another Branch coordinator. Leaf work-packet implementers and Reviewers use `spawn_agent(fork_turns: "none")`. A Leaf packet is implementation itself, not a coordinator that creates another session.

Keep the inherited model unless the user selected another one. Use `low` reasoning for Preparation, Slice coordinators, and Reviewers; use `medium` for Implementation and Repair. Repository breadth alone never raises effort. Raise to `high` only for an evidenced unclear root cause, a material unresolved decision, or high-consequence security, data, migration, compatibility, deployment, rollback, or external-contract work. Use `xhigh` or `max` only when the user explicitly selects it; ask before substituting an unavailable explicit selection.

## Worktree preparation

For each runnable direct Root target in the capture descriptor, create a Worktree task at the captured HEAD with its stated final owner assignment:

- root-only or direct Root Slice with no children: [direct review-boundary implementer](references/root-only-implementation.md)
- direct Root Slice with children: [Branch coordinator](references/slice-coordinator.md)

The owner first runs `prepare-worktree.js`. It validates the exact Worktree root and HEAD using process-local `safe.directory`, copies only the active Spec directory into the same repository-relative location, validates its revision and immutable definitions, and verifies Gate writes. All later execution uses that Worktree-local Spec and Gate path.

Do not create a holder task, copy all of `.proofline`, add global Git configuration, retry an environment failure as Repair, or pass the original Spec path to descendants. `environment_blocked` is returned once before implementation, Repair, or review starts.

## Recursive execution

Read an assignment only when rendering it and use its code block as the complete prompt.

A Branch coordinator dispatches only direct children:

- Branch: same-role, same-directory fork with [Branch coordinator](references/slice-coordinator.md)
- Leaf cohort: the fewest reliable history-free agents with [Leaf work-packet implementation](references/implementation-task.md)

One ready direct-sibling Leaf cohort may be partitioned across implementers for parallel long work, but one implementer receives every cohesive Leaf that fits a reliable continuous pass. Never default to one agent per Leaf. Each implementer stages its whole packet without intermediate reports and returns one terminal envelope to the assigning coordinator. After every packet in the cohort is stable, the coordinator runs one `coordinator-state.js close-batch --nodes <leaf-id,leaf-id,...>`. The helper checks the complete ready sibling cohort on one product snapshot and changes every Leaf status atomically only when all Gates pass.

A nested Branch coordinates its children, then callbacks only its Node ID and terminal state; the assigning coordinator runs one `close --mode subslice`. Root Slice owners callback only after review. Do not send Worktree paths, fingerprints, base SHAs, artifact links, Gate evidence, or helper output except that the terminal Root owner must send its reviewed commit and current Worktree root for final application.

History-free Preparation, Leaf-packet, and Reviewer agents return to their waiting parent through one terminal agent result and never message a task or send progress reports. A Worktree owner or same-directory Branch task instead must send exactly one accepted terminal callback to its assigning parent before ending. Its final response is not parent transport and cannot substitute for `send_message_to_thread`; the assigning parent alone owns the user-facing result. Use `state=completed` for a nested Branch, `state=reviewed` for a terminal Root owner, or `state=failed|environment_blocked|need_confirm` with the exact blocker. Only the reviewed Root callback may add the commit and current Worktree root required for application.

Stage product and mapped test paths only through `prepare-review.js stage`; Proofline Git helpers supply exact process-local `safe.directory`. A Leaf packet may run at most one already-frozen Gate item through `run-gates.js feedback` when it materially guides the whole packet or its Repair. A direct Root owner never uses feedback: it stages once and runs `coordinator-state.js close`, whose failed executions return bounded transient diagnostics. Completion checks run only through `coordinator-state.js close` or `close-batch`.

## Repair

Route each evidenced failure to its deepest existing owner. Resume the implementer that owns the affected Leaf packet through `followup_task`; resume a Branch in that same Branch task. The owner and role do not change. After a packet Repair, re-close its complete ready Leaf cohort on one stable snapshot, then only affected dependents and ancestors. Use a fresh Reviewer for every changed review snapshot.

Stop on a repeated identical evidenced failure after Repair, a repair outside the frozen contract, missing ownership, or `environment_blocked`. Do not turn environment errors such as Gate `EPERM`/`EACCES`, dubious ownership, missing Worktree-local Spec, revision drift, or missing nested repository into implementation Repair.

## Root review

After the Root Slice or root-only completion Gates pass, retain the review fingerprint locally. Render [Reviewer](references/reviewer.md) only in memory as the `spawn_agent` message, with paths, change counts, boundary link, plugin root, original request, and the exact safe read command. The template is not an output path: never write a Reviewer prompt or manifest into the Spec or Worktree. The fresh Reviewer reads a Root boundary through `prepare-review.js diff`; it runs no verification and changes no state.

On `pass`, `coordinator-state.js review-pass` verifies the retained fingerprint, completes a Root Slice when present, commits the reviewed product state, and returns `state=reviewed`; it never completes the root Spec. A root-only Spec then callbacks. A direct Root Slice in a one-Root tree runs `coordinator-state.js finalize --mode single-root` with the captured base and retained Root review fingerprint; this runs the root Gate and proves the committed range without another review. In a multi-Root tree, the Root owner callbacks after its own review. The callback contains only boundary ID, `state=reviewed`, commit, and current Worktree root.

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

This revalidates both checkouts, the reviewed product range, the unchanged original Spec, and immutable Worktree definitions. It applies the reviewed product range as uncommitted changes, merges only monotonic Slice status plus Gate state and evidence, then completes the original Spec. It never overwrites Spec requirements, Gate definitions, Slice structure, dependencies, or write scope. Any validation or write failure rolls back the application and leaves the original control artifacts unchanged. An apply failure never returns the reviewed owner to `close` or `review-pass`; retry only this apply after its stated precondition is restored, or report the blocker.

Never push. A final commit requires explicit authorization. Remove terminal Worktrees only when ordinary non-forced removal is safe; otherwise report the remaining path.
