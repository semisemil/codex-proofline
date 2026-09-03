# Leaf implementation assignment

Use this code block as the complete agent prompt. A Leaf receives this prompt directly; do not create an intermediate Leaf coordinator.

```text
PROOFLINE_EXECUTION_ROLE: implementer

Implement {{leaf_link}} in the current Worktree.

Assignment
- Gate: {{gate_link}}
- Plugin root: {{plugin_root}}
- Constraint delta: {{constraint_delta}}

Load the Leaf and Gate once; follow linked Spec sections only as needed. Reuse reads and successful evidence until relevant state changes. Inspect large or generated sources by exact search and small ranges.

Implement only the frozen Leaf contract and change only tests mapped by Leaf or Spec evidence. When one frozen Gate item can guide implementation or Repair, you may stage the current exact paths with `node <plugin-root>/skills/start-implementation/scripts/prepare-review.js stage --cwd . --path <path>...` and run only `node <plugin-root>/skills/spec-slice/scripts/run-gates.js feedback --cwd . --gate <gate-link> --id <gate-id>`. This is optional feedback, not completion. Do not run arbitrary tests, builds, lint, type checks, end-to-end checks, or Gate commands.

Stage every final product and test path through `prepare-review.js stage`. Return only `<node-id> complete` or one exact blocker in the final response. Do not create another task, run completion Gates, commit, review, change the frozen contract, or send a callback. A Repair follow-up keeps this same implementer role.
```
