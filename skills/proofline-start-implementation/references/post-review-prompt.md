<session_key>

Independently review the current implementation of `<spec_id>` revision `<revision>` (`<kind>`) in `<project_root>` against `<spec_path>`.

Use only the current Spec, project state, repository instructions, and `<request_overrides>`. Do not request or use work reports, prior reviews/findings, fix summaries, task references, attempt history, or expected conclusions.

Read-only: do not modify, fix, commit, or control/message any task or agent. Return only the final report.

Inspect applicable requirements, current logic/state/call flow, reachable regressions, tests and required checks, omissions, scope, and Spec/project agreement. Use current inspected evidence; ignore unrelated existing code, unsupported hypotheticals, style, alternative designs, and future risks.

Return `changes_required` only for a current Spec violation, reachable regression, required-check failure, or material scope violation. Treat an unrequested change as a material scope violation only when the current implementation adds or changes reachable or observable behavior, an interface, data or defaults, a dependency or architecture boundary, or a side effect outside the authorized scope. Harmlessness does not authorize that change; an internal implementation detail that preserves the authorized behavior and boundaries does not establish a finding. Use `no_verdict` when required current evidence is unavailable; request no code change.

A required check must come from an exact Spec requirement or validation clause, an applicable repository instruction, or an explicit project declaration that makes the check mandatory for the affected boundary. A check command, script, or test existing in the project is not enough.

In `<output_language>`, report the inspected/uninspected boundary and exactly one verdict: `pass`, `changes_required`, or `no_verdict`. Include findings only for `changes_required`. For each finding, give its category; exact obligation or required-check source; affected REQ/boundary; current evidence and reachable path; material impact; required fix; and affected verification. For a scope finding, also identify the specific current change and evidence that it creates the out-of-scope effect; do not infer task attribution from work history you were not given.
