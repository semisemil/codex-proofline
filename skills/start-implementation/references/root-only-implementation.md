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
<BEGIN_ORIGINAL_REQUEST>
{{original_request}}
<END_ORIGINAL_REQUEST>

First run exactly `node <plugin-root>/skills/start-implementation/scripts/prepare-worktree.js --cwd . --source <source-checkout> --spec <spec-relative> --base <base-sha> --control-fingerprint <control-fingerprint>`. Use only the returned Worktree-local Spec path. On `environment_blocked`, create no child or Repair task; callback only `state=environment_blocked` and its error, then end.

Load the boundary, Gate, and exact `Reviewer route` file together once. Do not enumerate its directory or reread unchanged content; if that exact template is missing, callback `state=environment_blocked` before implementation. Treat the commands in this assignment as the complete helper interface; inspect helper source only after an unexpected helper error. Implement the frozen contract in one pass, then stage exact final paths through `prepare-review.js stage`. Do not run a Gate, local feedback, or any direct test, build, lint, type-check, or end-to-end command before `close`.

Run `node <plugin-root>/skills/start-implementation/scripts/coordinator-state.js close --cwd . --spec <spec-relative> --node <boundary-id> --mode <root-only|root-slice>` once. Use a yielding command session or a finite outer timeout long enough for every frozen Gate item; never terminate and restart a still-running `close`. On `action=repair`, use its transient diagnostics before any additional read, inspect only a named failing artifact when the diagnostic is insufficient, repair the failure, restage, and re-close; do not rerun the same check through `feedback` or a direct command. Retain the successful review fingerprint locally. Render the retained `reviewer.md` template only in memory as the message for one fresh Reviewer created with `spawn_agent(fork_turns: "none")`; never create a Reviewer prompt or manifest file. Include only returned paths and change counts plus the exact `prepare-review.js diff` command, then wait without polling.

On `pass`, run `coordinator-state.js review-pass` with the locally retained fingerprint and matching mode. For a root-only Spec, callback immediately. For a direct Root Slice whose Finalization is `single-root`, run `coordinator-state.js finalize --mode single-root` with the Bootstrap base and retained fingerprint, then callback only after it completes. For `multi-root`, callback after `review-pass`. Send only `state=reviewed`, boundary ID, returned commit, and current Worktree root through `send_message_to_thread` without a destination ID, then end. Do not send fingerprints, base SHA, artifact paths, or Gate evidence.

On `action=repair` from `close` or `finalize`, or Reviewer `fail`, repair the blocking findings in this same task, restage, re-close only affected state, and use a fresh Reviewer when the snapshot changes. Keep the root-implementer role. On `environment_blocked`, do not Repair. If the same evidenced failure repeats, Repair would leave the frozen boundary, no valid owner exists, or any other terminal blocker occurs, callback `state=failed`, `state=environment_blocked`, or `state=need_confirm` with that exact blocker before ending.

Every terminal path must produce exactly one accepted `send_message_to_thread` callback to the assigning parent before this task ends. A final response is not that callback and must never replace it. After the callback is accepted, end without addressing the user as though this child owned the request.
```
