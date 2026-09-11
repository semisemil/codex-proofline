---
name: implement
description: "Implement a ready Spec in the current session. Explicit invocation only."
---

# Implement

Implement the unique ready `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md` in this session with its current model and reasoning. Report a missing, ambiguous or non-ready Spec. `start-implementation` owns session creation; the Spec and required sources are the implementation contract.

## Implement

Complete the Spec across the affected files and layers in this session.

## Finish

Finish when all Spec conditions are met. This workflow has no separate review stage or reviewer. Complete authorized delivery obligations at their required stage before reporting completion.

Set the Spec status to `completed`, preserving its body, identity and revision, through the existing document writer:

`node <plugin-root>/writers/document-writer.js write --kind spec --project-root <root> --relative-path <SPEC.md> --change-kind operational`

Pass the complete updated Markdown on stdin. Report the implementation and verification results, plus any write or registration failure.
