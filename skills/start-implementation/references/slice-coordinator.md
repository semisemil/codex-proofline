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
<BEGIN_ORIGINAL_REQUEST>
{{original_request}}
<END_ORIGINAL_REQUEST>

For a Root Slice, first run the supplied `prepare-worktree.js` command exactly once. Use only its Worktree-local Spec path. On `environment_blocked`, create no child, Reviewer, or Repair task; callback only that state and error, then end. A nested Branch receives `already prepared` and must not bootstrap again.

Load this boundary, its Gate, and direct-child metadata once. A direct Branch gets this coordinator assignment in a same-directory `fork_thread`; this is a same-role fork and must never be reused for implementation or review.

Treat every currently ready direct Leaf sibling as one closure cohort. Partition that entire cohort up front into the fewest reliable work packets. Put cohesive Leaves that fit one continuous pass in one packet; split only when a packet would be unreliable or parallel execution of independently long work materially shortens the critical path. Never default to one agent per Leaf. Give each packet directly to one fresh `spawn_agent(fork_turns: "none")` using `implementation-task.md`, and retain the Leaf-to-agent ownership map for Repair. When a later related cohort becomes ready, reuse an idle implementer with `followup_task` only when its existing context directly applies; otherwise create a fresh implementer.

Wait without polling. Leaf packet agents send no progress message and return one terminal envelope through their agent result. Do not close a cohort until every mutating descendant task in the shared Worktree has terminated. Once the whole cohort is staged, run exactly one `coordinator-state.js close-batch --cwd . --spec <spec-relative> --nodes <leaf-id,leaf-id,...>`. It executes the complete ready sibling cohort plus only the completed Leaf Gates whose write scopes overlap it and those Leaves' completed ancestor Gates. It marks every current Leaf completed only if every Gate passes on one unchanged snapshot. On failure, every current Leaf status stays pending. Route a revalidated predecessor failure to the current cohort owner first because the current change invalidated it; otherwise route each failure to its retained owner. Then rerun the whole cohort once after Repairs settle. A Branch task uses `send_message_to_thread` instead. Close a completed direct Branch once with `coordinator-state.js close --mode subslice`. Reuse current evidence and do not reconstruct helper checks.

When every direct child is completed:
- A nested Branch callbacks only `state=completed` and its boundary ID; its parent owns that SubSlice close.
- A Root Slice runs `coordinator-state.js close --mode root-slice`, retains the returned fingerprint locally, creates one fresh history-free Reviewer from `reviewer.md`, and waits.

On Root Slice review `pass`, run `coordinator-state.js review-pass --mode root-slice`. If Root finalization is `single-root`, run `coordinator-state.js finalize --mode single-root` with Base and the retained review fingerprint before callback. If it is `multi-root`, callback after `review-pass`. Callback only `state=reviewed`, boundary ID, returned commit, and current Worktree root. On `action=repair` from any close or finalize, or Reviewer `fail`, route each blocking finding to the deepest existing owner: use `followup_task` for the implementer that owns the Leaf packet and a new turn in the same Branch task for a Branch. Roles never change. Re-close the complete affected Leaf cohort, then its affected dependents and ancestors; use a fresh Reviewer when the snapshot changes. Do not Repair `environment_blocked`; no owner means `explicit re-slice required`.

If a terminal failure cannot be repaired inside an existing owner, callback `state=failed`, `state=environment_blocked`, or `state=need_confirm` with the boundary ID and exact blocker. Every terminal path must produce exactly one accepted `send_message_to_thread` callback to the assigning parent before this task ends. A final response is not that callback and must never replace it. Do not edit product files, run checks directly, create an intermediate Leaf coordinator, switch roles, or send paths, fingerprints, base SHA, Gate evidence, or copied helper output in callbacks.
```
