---
name: implement
description: "Implement a ready Spec, optionally in parallel, and verify until complete. Explicit invocation only."
---

# Implement

Implement the unique ready `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md` in this session with its current model and reasoning. Report a missing, ambiguous or non-ready Spec. `start-implementation` owns session creation; the Spec and required sources are the implementation contract.

## Implement and verify

Inspect existing staged, unstaged and untracked changes before editing. Preserve them and keep enough starting-state context to distinguish this run's changes. Implement the Spec and run the checks needed for its completion conditions, including user-required tests. Read focused code and concise output; inspect full logs only when needed. Reuse successful checks while their relevant state is unchanged and rerun affected checks after edits.

When independent assignments can shorten the work, use [model routing](../start-implementation/assets/model-routing.md) to select each worker's model and reasoning. Give each fresh `spawn_agent(fork_turns: "none")` a `PROOFLINE_EXECUTION_ROLE: parallel-implementer` assignment containing its goal, Spec sections, owned files/interfaces and required checks. Workers implement, diagnose and verify their scope, then return changes and test results; they do not delegate or complete the Spec. Supply common Proofline instructions if hooks are disabled.

Keep writes non-overlapping and dependent work sequential. Continue your own implementation while workers run; use `send_message` or same-role `followup_task` as needed, then collect and integrate results. End a worker's writes before replacing it. No separate assignment document is required. Escalate missing decisions or persistent blockers with evidence.

Finish implementation after integration and verification when all Spec conditions are met and material verification questions are resolved. This run has no separate review stage or reviewer. Complete authorized delivery obligations at their required stage before reporting completion.

## Finish

Set the Spec status to `completed`, preserving its body, identity and revision, through the existing document writer:

`node <plugin-root>/writers/document-writer.js write --kind spec --project-root <root> --relative-path <SPEC.md> --change-kind operational`

Pass the complete updated Markdown on stdin. Report the implementation and verification results, plus any write or registration failure. Commit or push only when authorized.
