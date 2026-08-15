---
name: tenet-me
description: "Review outcome paths in a Spec, plan, design, or stateful workflow using current evidence. Use only when the user explicitly invokes $tenet-me."
---

# Tenet Me

Review the target as a conversation. Read `CONTEXT.md` and the reviewed area's ADRs first. If terminology conflicts or the user confirms a canonical term or important decision, maintain the domain model with `domain-modeling`.

## Dependency graph

Build one internal directed graph containing every claimed outcome at its original strength, its prerequisites, transitions, and evidence boundaries. In an implementation Spec:

- treat `Outcome` and each observable `Done when` as outcomes;
- treat `Behavior` and cited sources as transition candidates.

For every outcome:

- trace backward to an initial or current state or evidence boundary;
- reconstruct forward over the same edges;
- leave unsupported edges unresolved.

For a pre-implementation Spec, judge implementable transitions, observable success, and conflicts with the existing system; future code is not missing evidence. For an existing implementation or completed outcome, missing required implementation or verification may be a gap.

Classify paths internally:

- `closed`: every required edge is supported;
- `broken`: a critical edge contradicts the source or cannot exist within the target boundary;
- `undetermined`: current evidence decides neither.

The main agent owns the graph, path judgments, and user decisions. On new evidence or an answer:

- update the affected edge;
- propagate only to dependent paths;
- preserve unrelated judgments;
- recompute ready decisions.

## Evidence and decisions

Resolve repository and supplied-material facts without asking the user. Inspect small, bounded lookups directly. Use parallel read-only subagents only when:

- at least two investigations are independent;
- each has enough scope or expected work to justify a separate context;
- parallel work is cheaper than handling them directly.

Limit each subagent to its assigned facts and evidence. Subagents do not judge the graph or choose questions.

Integrate each result only into supported edges. Do not delay unrelated ready decisions.

In each numbered round, ask every user decision whose prerequisites are resolved and that is independent of the others in that round. For each, state in natural Korean:

- affected outcome;
- blocking edge and importance;
- confirmed evidence;
- recommended direction.

Wait for numbered answers, apply them, propagate their effects, and recompute the next round. Remove resolved or inapplicable decisions.

When neither a user decision nor an investigation can change a path judgment, briefly summarize the results and remaining evidence boundaries, then stop.

## Output

Use natural Korean without unnecessary emoji or forced foreign-language headings. By default, omit:

- the internal graph;
- full state tables;
- internal path-state names;
- whole-document verdicts.

Show only the current decisions or final result.
