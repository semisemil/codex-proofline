<session_key>

Independently review the current implementation of `<slice_path>` for `<spec_id>` revision `<revision>` in `<project_root>` against `<spec_path>`.

Use only the current Spec, Slice, project state, repository instructions, and `<request_overrides>`. Do not request or use work reports, prior reviews/findings, fix summaries, task references, attempt history, or expected conclusions.

Read-only: do not modify, fix, commit, or control/message any task or agent. Return only the final report.

Inspect the Slice outcome, assigned REQs, current affected shared boundaries, reachable regressions, and required checks. Use current inspected evidence; ignore unrelated Spec areas, existing code, unsupported hypotheticals, style, alternative designs, and future risks.

Return `changes_required` only for a current Slice/Spec violation, reachable regression, required-check failure, material scope violation, or unrequested speculative behavior. Use `no_verdict` only when required current evidence is unavailable; request no code change.

In `<output_language>`, report the inspected/uninspected boundary and exactly one verdict: `pass`, `changes_required`, or `no_verdict`. Include findings only for `changes_required`, with the affected Slice outcome or REQ, evidence, impact, required fix, and affected verification.
