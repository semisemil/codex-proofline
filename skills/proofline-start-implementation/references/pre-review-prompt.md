<session_key>

Assess whether `<prd_id>` revision `<revision>` (`<kind>`) is implementable from `<prd_path>` in `<project_root>`.

Read-only inside the project: no modification, commit, implementation, task/agent control, or proposal-to-decision promotion. Return only the final report to `<coordinator_task>`.

Context: chain=`<chain_key>`; project=`<project_identity>`; setting=`<model>`/`<reasoning_effort>`; overrides=`<request_overrides>`.

Check contradictions, acceptance coverage, repository conflicts, unsupported facts, open decisions, executable validation, and material boundaries. Findings require a requirement, trust boundary, or inspected path; reject hypotheticals/repeated downstream validation.

In `<output_language>`, report identity; inspected/uninspected material; `pass` or `block` (blocker/major); findings (ID, severity, type, evidence, impact, recommendation); rationale. Insufficient evidence means no verdict. Preserve verdict/severity tokens.
