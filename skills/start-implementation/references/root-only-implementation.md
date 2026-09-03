# Direct review-boundary implementation assignment

Use for a root-only Spec or a direct Root Slice that is itself a Leaf. Replace the placeholders and use this code block as the complete task prompt.

```text
PROOFLINE_EXECUTION_ROLE: root-implementer

Implement {{boundary_link}} in this Worktree.

Bootstrap
- Source checkout: {{source_checkout}}
- Spec: {{spec_relative}}
- Base: {{base_sha}}
- Control fingerprint: {{control_fingerprint}}

Assignment
- Mode: {{boundary_mode}}
- Finalization: {{root_finalization}}
- Gate: {{gate_link}}
- Plugin root: {{plugin_root}}
- Constraint delta: {{constraint_delta}}
- Reviewer route: {{reviewer_route}}

Original request authority (verbatim)
{{original_request}}

First run exactly `node <plugin-root>/skills/start-implementation/scripts/prepare-worktree.js --cwd . --source <source-checkout> --spec <spec-relative> --base <base-sha> --control-fingerprint <control-fingerprint>`. Use only the returned Worktree-local Spec path. On `environment_blocked`, create no child or Repair task; callback only `state=environment_blocked` and its error, then end.

Load the boundary and Gate once. Implement only the frozen contract. Optional local Gate feedback is allowed only through `run-gates.js feedback`; it is not completion. Do not run arbitrary checks. Stage exact final paths through `prepare-review.js stage`.

Run `node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js close --cwd . --spec <spec-relative> --node <boundary-id> --mode <root-only|root-slice>` once. Resume the same process if it yields. Retain its review fingerprint locally. Render `reviewer.md` with only returned paths and change counts plus the exact `prepare-review.js diff` command, create one fresh Reviewer with `spawn_agent(fork_turns: "none")`, and wait for it.

On `pass`, run `coordinator-state.js review-pass` with the locally retained fingerprint and matching mode. For a root-only Spec, callback immediately. For a direct Root Slice whose Finalization is `single-root`, run `coordinator-state.js finalize --mode single-root` with the Bootstrap base and retained fingerprint, then callback only after it completes. For `multi-root`, callback after `review-pass`. Send only `state=reviewed`, boundary ID, returned commit, and current Worktree root through `send_message_to_thread` without a destination ID, then end. Do not send fingerprints, base SHA, artifact paths, or Gate evidence.

On `fail`, repair the blocking findings in this same task, restage, close, and use a fresh Reviewer. Keep the root-implementer role. Stop only on the same evidenced failure after Repair, a repair outside the frozen boundary, or no valid owner.
```
