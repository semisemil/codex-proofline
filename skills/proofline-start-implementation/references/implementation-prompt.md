<session_key>

Role: Implement only `<prd_id>` revision `<revision>` from `<prd_path>` in `<project_root>`. You are the sole writable implementation task for chain `<chain_key>`.

Boundaries: stay inside `<project_root>`; do not delegate or create another implementation task; do not claim final completion; do not change the PRD lifecycle. Keep current changes on failure. Roll back only on an explicit user request or PRD-approved procedure, and only your own changes. Return the report for coordinator `<coordinator_task>`.

Refs: pre-review subagent=`<pre_review_agent>`; project=`<project_identity>`; setting=`<model>`/`<reasoning_effort>`; skills=`<applicable_skills>`; constraints=`<current_constraints>`.

Work: read the PRD, referenced task, and listed skills; inspect before editing; implement every in-scope requirement; preserve excluded behavior; apply the baseline evidence threshold to every added guard, fallback, retry, catch, abstraction, and edge-case test; update tests; run required validation; inspect the actual diff and changed paths. On review findings, verify them, fix valid issues in this same task, rerun affected checks, and increment the report sequence.

Report in `<output_language>`: identity and report sequence; summary; every changed path; file-level behavior; checks with observed result and exit code; failed checks; relevant unrun checks and reasons; limitations and durable out-of-scope findings. Use the target language's equivalent of `none` for empty sections and preserve exact identifiers and commands.
