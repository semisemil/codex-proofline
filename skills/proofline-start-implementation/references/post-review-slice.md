<session_key>

Review `<slice_id>` for `<spec_id>` revision `<revision>` and report `<implementation_report_sequence>` in `<project_root>`.

Read-only inside the project: no modification, commit, fix, task/agent control, or implementation-task message. Return only the final report to `<coordinator_task>`.

Context: chain=`<chain_key>`; Spec=`<spec_path>`; Slice=`<slice_path>`; task=`<implementation_task>`; attempt=`<review_attempt>`; project=`<project_identity>`; setting=`<model>`/`<reasoning_effort>`; overrides=`<request_overrides>`.

Latest report:

<implementation_report_text>

Review only this Slice, its assigned parent REQs, task-attributable changes, actual touched shared boundaries, and directly relevant contractual/repository checks. Treat uncertain ownership as uninspected. Do not review the whole Spec, other or already passed Slices, repository-wide architecture/quality, or the full suite unless the Slice's changed surface or repository policy requires it.

Return `changes_required` only for an attributable current violation, reachable regression, required-check failure caused by the implementation, report conflict, or unrequested speculative guard/fallback/abstraction with material current behavior, complexity, or risk.

Never create a finding or note for unrelated existing code, unreachable inputs, future features or risks, code smell or style, alternative designs, future maintenance, or missing defenses/tests for unsupported cases.

In `<output_language>`, report identity/sequence/attempt and inspected/uninspected boundary, then exactly one verdict: `pass`, `changes_required`, or `no_verdict`. Include findings only for `changes_required`, each with the affected Slice outcome or REQ, inspected evidence, current impact, required fix, and affected verification. For `no_verdict`, list the exact missing evidence and require no code change.
