---
name: implement
description: "Implement a ready Spec, optionally in parallel, then review and fix until complete. Explicit invocation only."
---

# Implement

Implement the unique ready `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md` in this session with its current model and reasoning. Report a missing, ambiguous or non-ready Spec. `start-implementation` owns session creation; the Spec and required sources are the implementation contract.

## Implement and verify

Inspect existing staged, unstaged and untracked changes before editing. Preserve them and keep enough starting-state context to distinguish this run's changes for review. Implement the Spec and run the checks needed for its completion conditions, including user-required tests. Read focused code and concise output; inspect full logs only when needed. Reuse successful checks while their relevant state is unchanged and rerun affected checks after edits.

When independent assignments can shorten the work, use [model routing](../start-implementation/assets/model-routing.md) to select each worker's model and reasoning. Give each fresh `spawn_agent(fork_turns: "none")` a `PROOFLINE_EXECUTION_ROLE: parallel-implementer` assignment containing its goal, Spec sections, owned files/interfaces and required checks. Workers implement, diagnose and verify their scope, then return changes and test results; they do not delegate or complete the Spec. Supply common Proofline instructions if hooks are disabled.

Keep writes non-overlapping and dependent work sequential. Continue your own implementation while workers run; use `send_message` or same-role `followup_task` as needed, then collect and integrate results. End a worker's writes before replacing it. No separate assignment document is required. Escalate missing decisions or persistent blockers with evidence.

## Review and fix

After integration and verification, create a fresh reviewer with `fork_turns: "none"`, the main session's actual model and reasoning, and this assignment:

```text
PROOFLINE_EXECUTION_ROLE: reviewer
Review {{spec_path}} against {{this_run_changes}} and {{verification_results}}.
Read the actual changes and relevant code. Check Spec compliance, regressions
introduced by this change and directly affected contracts. Check that the
verification proves the required behavior, not merely the implementation's own
assumptions. Give concrete evidence for findings; distinguish unrelated issues
and optional improvements. Read only: do not edit, run tests or delegate.
End with pass or fail; fail only for a valid in-scope defect.
```

Provide current Spec/source paths, this run's changes and actual verification results, without implementation conversation, self-assessment or prior review history. Use guaranteed fresh-context setting inheritance only if explicit settings are unavailable; report a limitation if neither works.

Fix valid findings, rerun affected checks and request a fresh review. Explain out-of-scope exclusions against the Spec; an out-of-scope-only fail does not require another review. Finish only when all Spec conditions are met and no valid finding remains on the final reviewed state.

## Finish

Set the Spec status to `completed`, preserving its body, identity and revision, through the existing document writer:

`node <plugin-root>/writers/document-writer.js write --kind spec --project-root <root> --relative-path <SPEC.md> --change-kind operational`

Pass the complete updated Markdown on stdin. Report the implementation and verification results, plus any write or registration failure. Commit or push only when authorized.
