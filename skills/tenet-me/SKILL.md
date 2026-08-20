---
name: tenet-me
description: "Review intent, outcome, and verification paths in a Spec, Plan, design, or stateful workflow using current evidence. Use only when the user explicitly invokes $tenet-me or $figure-it-out owns the explicit workflow."
---

# Tenet Me

Review the target as a conversation. Read `CONTEXT.md` and the reviewed area's ADRs first. If terminology conflicts or the user confirms a canonical term or important decision, maintain the domain model with `domain-modeling`.

## Dependency graph

Build one internal directed graph containing every current intended result at its original strength, its decisions, constraints, prerequisites, transitions, verification paths, and evidence boundaries.

- For a Plan, trace each intended result through the selected direction and the material decisions and constraints that shape it
- For an implementation Spec, trace source intent to each acceptance condition and planned verification, then trace every acceptance condition back to its source intent and forward to verification capable of deciding it

For every required result:

- trace backward to an initial or current state or evidence boundary;
- reconstruct forward over the same edges;
- leave unsupported edges unresolved.

For a pre-implementation Spec, judge whether its acceptance conditions are implementable, its planned verification can decide them, and its paths conflict with the existing system; future code and results are not missing evidence. For an existing implementation or completed result, require current evidence and treat missing required implementation or verification as a possible gap.

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

- affected result;
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

When `../figure-it-out/SKILL.md` owns the workflow, return the final result to it for the next revision or stage.
