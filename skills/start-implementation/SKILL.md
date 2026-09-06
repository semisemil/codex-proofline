---
name: start-implementation
description: "Select model and reasoning and launch a new local implementation session for a ready Spec. Explicit invocation only."
---

# Start Implementation

Read the unique ready `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md` and use [model routing](assets/model-routing.md) to select model and reasoning. Respect user settings and limits. Report missing, ambiguous or non-ready Specs. Explain the selected settings and task-based reason in one sentence.

Resolve the saved project matching the current folder. Check the runtime supports and permits the selected settings; when the creation tool requires an explicit user model choice, obtain it before dispatch. Do not substitute another project, model or location when these requirements cannot be met.

Build the creation arguments with:

`node <plugin-root>/skills/start-implementation/scripts/prepare-launch.js --cwd <current-folder> --spec <SPEC-ID> --project-root <matching-project-folder> --project-id <project-id> --model <model> --reasoning <effort>`

Pass the returned JSON unchanged to `create_thread` once. It uses the matching project with an explicit `local` environment, including for Git repositories. The new prompt is exactly `$proofline:implement <SPEC-ID>` on one line; settings and location are separate arguments. Add no conversation history or handoff summary.

Report the returned task link and end. Do not wait for implementation results, send follow-up work or monitor completion. If the runtime requires an initial status confirmation, take one nonblocking snapshot only when a real task ID is available. Report creation failures; an uncertain result is not a reason to create a duplicate task. The new session owns implementation, parallel work and the review/fix loop.
