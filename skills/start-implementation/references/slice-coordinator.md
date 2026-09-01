# Slice coordinator assignment

Replace the placeholders and use this code block as the complete task prompt. `{{assignment_mode}}` is `root-slice`, `subslice`, or `integration-review`.

```text
PROOFLINE_EXECUTION_ROLE: slice-coordinator

Coordinate {{boundary_link}} in Worktree {{worktree}} from {{slice_base}}.

Assignment
- Mode: {{assignment_mode}}
- Direct children: {{direct_children}}
- Gate: {{gate_link}}
- Review boundary: {{review_boundary_link}}
- Plugin root: {{plugin_root}}
- Constraint delta: {{constraint_delta}}
- Assignment directory: {{assignment_directory}}
- Routes: Branch coordinator {{coordinator_route}}; implementation {{implementation_route}}; Reviewer {{reviewer_route}}
- Terminal callback fields: {{callback_fields}}

Product changes belong to child implementation tasks.

Inherited context is authoritative. Load this boundary, its Gate, and only the next assignment files. Reuse successful evidence until mutation. Cap large output at 4,000 tokens; inspect generated, minified, or large sources by exact search and small ranges.

If `Direct children` lacks metadata, run `node <plugin-root>/skills/spec-slice/scripts/inspect-execution-tree.js <spec-directory>` once. Fork runnable Branches with `slice-coordinator.md` and Leaves with `implementation-task.md`, using `fork_thread(environment: { type: "same-directory" })` without `threadId` and the listed route. A Leaf forks one implementation task. For a bare fork, apply route and assignment in its first message. End after dispatch; resume only on a terminal callback; coordinators do not wait or poll.

On callback, run only `node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js close --cwd <worktree> --spec <spec-directory> --node <closing-node-id> --mode <leaf|subslice|root-slice>`; it checks scope, runs every pending Gate, updates a completed Leaf/SubSlice, and returns the next action or review snapshot. Start it once with a sufficient execution window and resume the same process if it yields; do not restart it only because it has not returned. Do not inspect helper source or repeat its commands.

For a Root Slice, render `reviewer.md` with the returned snapshot. Create one fresh reviewer with `spawn_agent(fork_turns: "none")` using the listed Reviewer route and wait only for it. On `pass`, run only `node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js review-pass --cwd <worktree> --spec <spec-directory> --node <boundary-id> --mode root-slice --fingerprint <returned-fingerprint> --message <one-line-message>`; it marks the boundary complete, commits, and verifies transport. Callback its compact result and end. On `fail`, send each evidenced repair to its deepest existing owner and end. No owner means `explicit re-slice required`.

Repair reuses the owning task. Invalidate only affected Gates and reviews; after its callback, re-close them and review the changed snapshot once.
```
