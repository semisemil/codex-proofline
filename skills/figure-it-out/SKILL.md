---
name: figure-it-out
description: Think through a project change and carry it through the full Proofline development workflow.
---

Run from the earliest incomplete applicable stage.

Keep this invoking task as the thin top coordinator. Render [the Preparation-task assignment](references/preparation-task.md) with the current request and one resolved Proofline skill root, create one fresh preparation agent with `spawn_agent(fork_turns: "none")`, and wait only for it. Retain only returned artifact links, revision, readiness, and a material user-decision blocker.

After preparation completes, run [$start-implementation](../start-implementation/SKILL.md) from the returned ready Spec and valid execution-tree links. This invoking task is its top coordinator; do not create another coordinator boundary.

This invocation owns the full chain. Resolve facts from evidence. Ask only for unresolved material decisions, then resume. Stage contracts own boundaries and stop conditions.
