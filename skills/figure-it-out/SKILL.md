---
name: figure-it-out
description: Think through a project change and carry it through the full Proofline development workflow.
---

Run from the earliest incomplete applicable stage. This invoking session owns preparation and hands the ready Spec to a new implementation session.

If preparation remains, load [the Preparation assignment](references/preparation-task.md). Render the complete current request copied verbatim into its delimited authority block; never summarize, translate, rename, or omit an identifier, path, command, number, example, or required output. Add the resolved Proofline skill root and create one fresh Preparation agent with `spawn_agent(task_name: "preparation", fork_turns: "none")`. Preserve the invoking session's actual model and reasoning through explicit fields or documented history-free inheritance; model routing does not apply. If the runtime cannot establish those settings, report that limitation instead of guessing. Wait for its result and retain artifact links, revision, readiness, scope verification, and any material user-decision blocker.

From the returned or already ready Spec, load [$start-implementation](../start-implementation/SKILL.md) once to select settings and create the new implementation session in the current project folder. After creation, report the new task and end this workflow without waiting for implementation results. The new session owns implementation, optional parallel work, verification, and completion.

Resolve facts from evidence. Ask only for unresolved material decisions, then resume. Stage contracts own boundaries and stop conditions.
