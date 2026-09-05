---
name: start-implementation
description: "Explicit-only launch of a new implementation session for one ready Spec, selecting model and reasoning in the current project folder."
---

# Proofline Start Implementation

Resolve a ready Spec, select model and reasoning, and create one new implementation session. The new session owns implementation through completion; this session ends after reporting the creation result and task link.

## Resolve and select

Resolve the supplied Spec ID or path in the current project's `.proofline/specs/<SPEC-ID>-<slug>/SPEC.md`. Read the unique matching document and require `ready`. Report a missing, ambiguous, or non-ready Spec without creating a task. Use the Spec and only the relevant code to understand the implementation work.

Read [model routing](assets/model-routing.md). Respect explicit model, reasoning, and usage limits; select only unspecified settings. Tell the user the selected settings and task-based reason in one sentence before dispatch. Keep that explanation in this session, outside the new task's prompt.

## Create the implementation session

Discover the task creation and project listing tools. Resolve the saved project whose actual directory is the current project folder. Use that project with an explicit `local` environment, including for a Git repository, so the new session sees the existing work and uncommitted Spec.

Check the runtime's available model IDs, reasoning levels, and rules for setting them at task creation. If the creation tool requires an explicit user model choice, present the selected model and obtain that choice before creation. A routing decision alone does not satisfy that tool requirement. If project matching, task creation, or applying the selected settings is unavailable, report the specific limitation; do not substitute another project, model, working directory, or implementation in this session.

Prepare the exact tool arguments with the read-only [launch request helper](scripts/prepare-launch.js):

`node <plugin-root>/skills/start-implementation/scripts/prepare-launch.js --cwd <current-project-root> --spec <SPEC-ID> --project-root <saved-project-root> --project-id <saved-project-id> --model <selected-model-id> --reasoning <selected-effort>`

The helper resolves and validates the ready Spec and matching project folder; it does not determine model support, grant permission, or create a task. Pass its JSON unchanged to `create_thread` once. The prompt is exactly `$proofline:implement <SPEC-ID>` on one line. Model, reasoning, project, and location are separate creation arguments. No conversation history, request transcript, handoff summary, decisions, work state, or test results are appended to the prompt.

## Finish dispatch

Report the creation result and new task link, using the returned task ID or pending-creation ID as supported by the app. Creation acceptance is not implementation completion. If creation fails, report the failure; if its outcome is uncertain, do not issue a duplicate creation. If the runtime requires initial progress confirmation, obtain one nonblocking status snapshot (`wait_threads` with `timeoutMs: 0`) when a real task ID is available, then end; a pending-creation ID is not a task ID. Do not wait for implementation results, collect them, send follow-up prompts, or create a callback or monitor. Implementation, parallel assignments, evidence capture, review, and Spec completion belong to the new `$implement` session.
