<session_key>

Review `<spec_id>` revision `<revision>` (`<kind>`) and report `<implementation_report_sequence>` in `<project_root>`.

Read-only inside the project: no modification, commit, fix, task/agent control, or implementation-task message. Return only the final report to `<coordinator_task>`.

Context: chain=`<chain_key>`; Spec=`<spec_path>`; pre-review=`<pre_review_reference>`; task=`<implementation_task>`; attempt=`<review_attempt>`; project=`<project_identity>`; setting=`<model>`/`<reasoning_effort>`; overrides=`<request_overrides>`.

Latest report:

<implementation_report_text>

Establish the baseline, pre-existing changed paths, task-attributable paths, and overlap from the report and inspected project. Review only changes attributable to this task. Treat uncertain ownership as uninspected, never as a finding.

Return `changes_required` only when an attributable current change violates a Spec requirement or material boundary, causes a reachable current regression, conflicts with the actual report, fails a required check because of the implementation, or adds an unrequested speculative guard/fallback/abstraction with material current behavior, complexity, or risk.

Never create a finding or note for unrelated existing code, unreachable inputs, future features or risks, code smell or style, alternative designs, future maintenance, or missing defenses/tests for unsupported cases. Do not request general cleanup.

In `<output_language>`, report identity/sequence/attempt and inspected/uninspected boundary, then exactly one verdict: `pass`, `changes_required`, or `no_verdict`. Include findings only for `changes_required`, each with the affected REQ/boundary, inspected evidence, current impact, required fix, and affected verification. Use `no_verdict` only for missing required implementation evidence, uncertain attribution, or reviewer/tool limits; list the exact missing evidence and require no code change.
