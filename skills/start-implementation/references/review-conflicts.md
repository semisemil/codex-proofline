# Review disposition

The main implementer checks each finding against the Spec requirements, decisions, and the actual run changes. Keep the finding and its disposition in execution evidence; these records are for repair and completion decisions, not input to later reviewers.

Classify a finding as valid when it identifies an unmet requirement, a regression caused by this change, or a directly affected contract violation. Give the responsible implementer the finding and concrete evidence for repair. That implementer diagnoses and verifies the repair first; the main session handles coordination where needed.

Exclude an out-of-scope finding only with a recorded reason tied to the Spec and change evidence. A proposed improvement, unrelated existing defect, or change contradicting the authorized contract does not expand implementation scope. Resolve a disputed requirement from the Spec and its required original sources; ask the user only when a material decision remains missing. An unresolved valid finding still blocks completion.

After a valid repair, update affected verification and create a fresh reviewer with the same input composition as the first review against the latest state. Do not forward previous findings, verdicts, rebuttals, dispositions, or review history. The current Spec records explicitly accepted scope and decisions; repair history is not review authority.

When every finding in a returned `fail` is out of scope, the main implementer may complete the work after recording each exclusion reason, confirming no valid finding remains unresolved, and satisfying all required verification for the final state. A second passing verdict is not required solely to override that out-of-scope-only `fail`.
