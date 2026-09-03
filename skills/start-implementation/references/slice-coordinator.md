# Branch coordinator assignment

Use only for a Slice with direct children. Replace the placeholders and use this code block as the complete task prompt.

```text
PROOFLINE_EXECUTION_ROLE: slice-coordinator

Coordinate {{boundary_link}} in the current Worktree.

Bootstrap
{{bootstrap}}

Assignment
- Mode: {{assignment_mode}}
- Root finalization: {{root_finalization}}
- Base: {{base_sha}}
- Direct children: {{direct_children}}
- Gate: {{gate_link}}
- Plugin root: {{plugin_root}}
- Constraint delta: {{constraint_delta}}
- Routes: Branch {{coordinator_route}}; Leaf {{implementation_route}}; Reviewer {{reviewer_route}}

Original request authority (verbatim)
{{original_request}}

For a Root Slice, first run the supplied `prepare-worktree.js` command exactly once. Use only its Worktree-local Spec path. On `environment_blocked`, create no child, Reviewer, or Repair task; callback only that state and error, then end. A nested Branch receives `already prepared` and must not bootstrap again.

Load this boundary, its Gate, and the direct-child metadata once. A direct Leaf gets `implementation-task.md` directly through a fresh `spawn_agent(fork_turns: "none")`; that Leaf agent implements the Leaf itself. A direct Branch gets this coordinator assignment in a same-directory `fork_thread`; this is a same-role fork and must never be reused for an implementer or Reviewer. Schedule only a runnable subset supported by capacity.

Wait for fresh Leaf agents with `wait_agent`; their final result is the Leaf result and needs no callback. Branch tasks callback only `<node-id> complete` or one blocker. For each completed child, run `coordinator-state.js close` once with mode `leaf` or `subslice`. Reuse current evidence and do not reconstruct helper checks.

When every direct child is completed:
- A nested Branch callbacks only `<boundary-id> complete`; its parent owns that SubSlice close.
- A Root Slice runs `coordinator-state.js close --mode root-slice`, retains the returned fingerprint locally, creates one fresh history-free Reviewer from `reviewer.md`, and waits.

On Root Slice review `pass`, run `coordinator-state.js review-pass --mode root-slice`. If Root finalization is `single-root`, run `coordinator-state.js finalize --mode single-root` with Base and the retained review fingerprint before callback. If it is `multi-root`, callback after `review-pass`. Callback only `state=reviewed`, boundary ID, returned commit, and current Worktree root. On `fail`, route each blocking finding to the deepest existing owner: use `followup_task` for a Leaf agent and a new turn in the same Branch task for a Branch. Roles never change. Re-close only affected boundaries and use a fresh Reviewer. No owner means `explicit re-slice required`.

Do not edit product files, run checks directly, create an intermediate Leaf coordinator, switch roles, or send paths, fingerprints, base SHA, Gate evidence, or copied helper output in callbacks.
```
