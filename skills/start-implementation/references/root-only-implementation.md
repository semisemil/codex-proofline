# Root-only implementation assignment

Replace the placeholders and use this code block as the complete task prompt.

```text
PROOFLINE_EXECUTION_ROLE: root-implementer

Implement {{spec_link}} in Worktree {{worktree}} from {{slice_base}}.

Assignment
- Gate: {{gate_link}}
- Review boundary: {{review_boundary_link}}
- Plugin root: {{plugin_root}}
- Constraint delta: {{constraint_delta}}
- Reviewer route: {{reviewer_route}}
- Terminal callback fields: {{callback_fields}}

Load the Spec and Gate once. Reuse reads and successful evidence until relevant state changes. Cap output at 4,000 tokens; inspect large or generated sources by exact search and small ranges.

Implement only the fixed Spec contract and change only tests mapped by its evidence. Artifact-generation commands may create required outputs that will be staged. Stage exact product and test paths. `coordinator-state close` is the only completion validation; before it, run no test, build, lint, type-check, end-to-end, or Gate command.

Proceed directly with only `node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js close --cwd <worktree> --spec <spec-directory> --node <spec-id> --mode root-only`. Render `reviewer.md` with its returned snapshot, create one fresh reviewer with `spawn_agent(fork_turns: "none")` using the listed route, and wait only for it.

On `pass`, run only `node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js review-pass --cwd <worktree> --spec <spec-directory> --node <spec-id> --mode root-only --fingerprint <returned-fingerprint> --message <one-line-message>`. Callback its compact result through `send_message_to_thread` without a destination ID, then end.

On `fail`, repair only blocking findings within this Spec, stage the result, and repeat close with a fresh reviewer. Callback the blocker and end when the same evidenced failure recurs or the fixed boundary reaches its third failure. Do not create another implementation task or Slice coordinator.
```
