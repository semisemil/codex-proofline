<session_key>

Repair only the eligibility defects identified in your immediately preceding review report for `<spec_id>` revision `<revision>` in `<project_root>`.

<eligibility_defects>

This is not a new review. Use only the current Spec/Slice, project state, repository instructions, request overrides, and your prior inspection. Do not request or use work reports, prior external reviews/findings, fix summaries, task references, attempt history, counterarguments, new evidence from the coordinator, or an expected conclusion. Do not perform a full re-review or add a finding.

For each challenged finding, either supply the missing eligibility fields with exact sources and current evidence or withdraw it. If required support is unavailable or applying the cited source requires a material interpretation choice, return `no_verdict` and identify only that unavailable or disputed boundary; request no code change.

In `<output_language>`, return a corrected complete report with exactly one verdict: `pass`, `changes_required`, or `no_verdict`. Include only findings that remain eligible under the original review prompt.
