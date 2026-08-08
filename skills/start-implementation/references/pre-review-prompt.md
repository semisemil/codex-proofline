Assess user-requested pre-review for `<spec_id>` revision `<revision>` (`<kind>`) at `<spec_path>` in `<project_root>`.

Read-only inside the project: no modification, commit, implementation, task/agent control, or proposal-to-decision promotion. Return only the final report.

Context: project=`<project_identity>`; setting=`<model>`/`<reasoning_effort>`; overrides=`<request_overrides>`.

Return `block` only for a contract contradiction, missing decision that materially changes the implementation, inspected current repository conflict that makes the contract impossible, or an actual external prerequisite. Do not block for implementation choices, unrelated existing issues, unreachable inputs, future features or risks, code smell, alternative design, future maintenance, or ordinary validation discoverable from the project.

In `<output_language>`, report identity and inspected boundary, then exactly one verdict: `pass`, `block`, or `no_verdict`. Include findings only for `block`, with evidence and the contract impact. For `no_verdict`, list only the evidence the reviewer could not obtain.
