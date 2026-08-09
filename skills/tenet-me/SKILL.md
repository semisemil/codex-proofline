---
name: tenet-me
description: "Review, using current evidence, the reverse paths to the outcomes stated by an implementation Spec, plan, design, or workflow with state transitions. Use when the user explicitly invokes $tenet-me to find and resolve, one at a time, the earliest link that prevents an outcome from holding."
---

# Tenet Me

Conduct the review as a conversation without changing the review target. Work backward from the outcomes stated by the document to the required paths, then reconstruct them forward using current evidence. Resolve, one at a time, what must be decided or revised for the outcomes to hold.

Before the review, read the project's domain glossary (`CONTEXT.md`) and the ADRs for the area under review.

When project-specific terminology is ambiguous or conflicts with an existing definition, or when a new canonical term or important design decision is confirmed, maintain the domain model with the available `domain-modeling` skill.

## Review paths

- Identify every outcome the document claims, without limiting their number, while preserving the strength of each original claim. In an implementation Spec, treat `Outcome` and each requirement's observable `Done when` as outcomes, and treat `Behavior` and cited source material as transition candidates.
- Trace the conditions and transitions required for each outcome backward until they connect to the initial state, current state, or evidence boundary. Then reconstruct the path forward from the earliest evidence-backed state. Do not invent unsupported links to fill gaps.
- In a pre-implementation specification, do not treat the absence of code that will be created later as a break. Instead, determine whether the specification sufficiently addresses implementable transitions, observable success conditions, and conflicts with the existing system. When reviewing an existing implementation or completed outcome, missing required implementation or verification may be treated as a break.
- Directly inspect facts that can be confirmed from the repository or provided materials instead of asking the user.

Use path states for internal judgment.

- `closed`: Evidence supports every required link, and forward reconstruction reaches the outcome.
- `broken`: A critical link contradicts the source or cannot exist within the boundary defined by the document.
- `undetermined`: The evidence is insufficient to determine whether the path holds or fails.

## Conduct the conversation

- Pass over internally any closed path or path that requires no user action, and address only the earliest gap that requires a decision or revision.
- In the user's terms, explain the intended outcome, the link currently blocking it, why it matters, and the confirming evidence, then recommend a direction. Do not fabricate facts; recommend evidence-based resolutions or decisions.
- When a user decision is required, ask one question with a recommended answer and wait. Apply the answer to update the same path or discard a reconstruction that cannot hold, then proceed to the next gap.
- When no path has a remaining gap to address, summarize the result briefly.

Do not impose a fixed report format, list of candidate outcomes, complete status table, or internal state names on the default response. Unless the user requests them, do not output a whole-document `pass` or `changes_required` verdict or internal reasoning.

## Scope

Do not combine this skill with subagent use, code-change review, causal proof of business impact, or changes to the document under review.
