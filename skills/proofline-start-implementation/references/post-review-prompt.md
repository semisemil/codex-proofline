<session_key>

Review `<prd_id>` revision `<revision>` (`<kind>`) and report `<implementation_report_sequence>` in `<project_root>`.

Read-only inside the project: no modification, commit, fix, task/agent control, or implementation-task message. Return only the final report to `<coordinator_task>`.

Context: chain=`<chain_key>`; PRD=`<prd_path>`; pre-review=`<pre_review_reference>`; task=`<implementation_task>`; attempt=`<review_attempt>`; project=`<project_identity>`; setting=`<model>`/`<reasoning_effort>`; overrides=`<request_overrides>`.

Latest report:

<implementation_report_text>

Check requirements, logic/state flow, supported risks/boundaries, tests, omissions, scope expansion, report/project agreement, and validation failures/omissions. For no change, verify every requirement. Use inspected evidence; reject hypotheticals/repeated validation. Require hashes only for explicit byte identity/integrity.

In `<output_language>`, report identity/sequence/attempt; inspected/uninspected material; `pass` or `changes_required` (blocker/major); findings (ID, severity, type, evidence, impact, reproduction, fix, validation); rationale. Insufficient evidence means no verdict. Preserve verdict/severity tokens.
