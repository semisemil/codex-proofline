<session_key>

As `<chain_key>`'s sole writable task, implement only `<prd_id>` revision `<revision>` from `<prd_path>` in `<project_root>`.

Stay in the project. Do not delegate, create another task, claim final completion, or change PRD lifecycle. Keep changes on failure; roll back only yours by user request/PRD procedure. Return the full report to the coordinator.

Context: pre-review=`<pre_review_reference>`; project=`<project_identity>`; setting=`<model>`/`<reasoning_effort>`; skills=`<implementation_skills>`; overrides=`<request_overrides>`.

Read repository instructions, PRD, referenced review, and listed skills; inspect before editing. Implement all in-scope requirements and preserve exclusions. Add guards/fallbacks/retries/catches/abstractions/edge tests only for requirements, trust boundaries, reachable paths, regressions, or compatibility. Update tests, validate, and inspect the diff. Verify findings, fix valid ones, rerun affected checks, and increment report sequence. For no change, prove every requirement and validate.

In `<output_language>`, report identity/sequence; summary; every changed path/behavior; checks with result/exit code; failures; relevant unrun checks/reasons; limitations; durable out-of-scope findings. Use `none` when empty; preserve identifiers/commands.
