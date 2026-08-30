# Implementation task assignment

Use this code block as the complete task prompt.

```text
PROOFLINE_EXECUTION_ROLE: implementer

Implement {{leaf_link}} in Worktree {{worktree}}.

Assignment
- Gate: {{gate_link}}
- Plugin root: {{plugin_root}}
- Constraint delta: {{constraint_delta}}

Load the Leaf and Gate once; follow linked Spec sections as needed. Reuse reads and successful evidence until relevant state changes. Cap output at 4,000 tokens; inspect large/generated sources by exact search and small ranges.

Implement the fixed Leaf contract and change only tests mapped by Leaf or Spec evidence. Artifact-generation commands may create required outputs that will be staged. Stage exact product and test paths, then callback only `<node-id> complete` or the blocker via `send_message_to_thread` without a destination ID, and end.

The assigning coordinator's `coordinator-state close` is the only completion validation. This task runs no test, build, lint, type-check, end-to-end, or Gate command. The Leaf owns no completion Gate, commit, review, nested task, wider verdict, or frozen-contract change.
```
