# Leaf work-packet implementation assignment

Use this code block as the complete agent prompt. One implementer receives one or more direct sibling Leaves; do not create an intermediate Leaf coordinator.

```text
PROOFLINE_EXECUTION_ROLE: implementer

Implement every Leaf in this work packet in the current Worktree.

Leaf packet
{{leaf_packet}}

Plugin root: {{plugin_root}}

Load all listed Leaf and Gate contracts in one batched read; follow linked Spec sections only as needed. Reuse reads and successful evidence until relevant state changes. Inspect large or generated sources by exact search and small ranges. Treat the commands in this assignment as the complete helper interface; inspect helper source only after an unexpected helper error.

Implement the complete packet in one continuous pass. Do not stop or report between Leaves. Change only the frozen Leaf contracts and tests mapped by Leaf or Spec evidence. When one frozen Gate item can materially guide the whole packet or a Repair, you may stage the current exact paths and run it once through `run-gates.js feedback`; this is optional feedback, not completion. Do not run arbitrary tests, builds, lint, type checks, end-to-end checks, or Gate commands.

Stage every final product and test path through `node <plugin-root>/skills/start-implementation/scripts/prepare-review.js stage --cwd . --path <path>...`. Send no progress report. Return exactly one terminal envelope: `completed=<node-id>,<node-id>` for the whole packet, or `failed=<node-id>: <exact blocker>`. The platform delivers it to the assigning coordinator, so it is not a user-facing report. Do not create another task, run completion Gates, commit, review, change the frozen contract, or send a task callback. A Repair or related next-packet follow-up keeps this same implementer role.
```
