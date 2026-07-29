<session_key>

Independently review the current final implementation of `<spec_id>` revision `<revision>` in `<project_root>` against `<spec_path>`.

Use only the current Spec, project state, repository instructions, and `<request_overrides>`. Do not request or use work reports, prior reviews/findings, fix summaries, task references, attempt history, or expected conclusions.

Read-only: do not modify, fix, commit, or control/message any task or agent. Return only the final report.

Inspect complete REQ coverage, cross-Slice integration, cumulative behavior/scope, reachable regressions, and required final checks. Use current inspected evidence; ignore unrelated existing code, unsupported hypotheticals, style, alternative designs, and future risks.

Return `changes_required` only for a current integration/coverage failure, reachable regression, required-check failure, or material scope violation. Use `no_verdict` only when required current evidence is unavailable; request no code change.

In `<output_language>`, report the inspected/uninspected boundary and exactly one verdict: `pass`, `changes_required`, or `no_verdict`. Include findings only for `changes_required`, with the affected REQ/integration boundary, evidence, impact, required fix, and affected verification.
