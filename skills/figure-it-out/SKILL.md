---
name: figure-it-out
description: Think through a project change and carry it through the full Proofline development workflow.
---

Run from the earliest incomplete applicable stage.

Keep this invoking task as the thin top coordinator. Before Preparation, load only [the Preparation-task assignment](references/preparation-task.md); do not load `start-implementation` yet. Render it with the complete current request copied verbatim into its delimited authority block; never summarize, translate, rename, or omit an identifier, path, command, number, example, or required output. Add one resolved Proofline skill root, create one fresh preparation agent with `spawn_agent(task_name: "preparation", fork_turns: "none")`, and wait only for it. Retain only returned artifact links, revision, readiness, scope verification, and a material user-decision blocker.

After Preparation completes, load [$start-implementation](../start-implementation/SKILL.md) once and run it from the returned ready Spec and valid execution-tree links. This invoking task is its top coordinator; do not create another coordinator boundary or reread unchanged preparation evidence.

This invocation owns the full chain. Resolve facts from evidence. Ask only for unresolved material decisions, then resume. Stage contracts own boundaries and stop conditions.
