Independently review `<review_target>` in `<project_root>` against `<spec_path>`.

Use only the current Spec/Slice, candidate state, repository instructions, and `<request_overrides>`. Do not request or use work reports, prior reviews/findings, fix summaries, task references, attempt history, or expected conclusions.

<candidate_boundary>

Read-only: return only the report. A `pass` requires the target obligations to hold with no reachable regression, required-check failure, material omission, or material scope violation. Unrelated existing code, unsupported hypotheticals, style, alternative designs, and future risks cannot establish a finding.

Return `changes_required` only for a current requirement violation, reachable regression, required-check failure, or material scope violation. An unrequested reachable behavior, interface, data/default, dependency/architecture boundary, or side effect is a scope violation; an internal detail preserving authorized behavior and boundaries is not. A required check must come from the Spec, applicable repository instructions, or an explicit project declaration, not merely exist in the project. Use `no_verdict` when required current evidence is unavailable and request no code change.

In `<output_language>`, give the inspected boundary and exactly one verdict: `pass`, `changes_required`, or `no_verdict`. Include findings only for `changes_required`; each needs the category, exact source, affected requirement/boundary, current evidence and reachable path, material impact, required fix, and affected verification. A scope finding must identify the candidate change causing the effect; do not infer task attribution from unavailable history.
