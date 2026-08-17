---
name: dashboard-server
description: Open, inspect, or stop the running Proofline dashboard server without starting it or changing registered projects.
---

# Proofline Dashboard Server

Accept exactly one action: `open`, `status`, or `stop`.

Run `node <plugin-root>/dashboard/control.js <action>` and report its JSON result. Resolve `<plugin-root>` from this SKILL.md; do not substitute a project-local script.

- `open`: Open the verified running server with the current plugin version in `expected_version`. If stopped, report `stopped`; do not start it.
- `status`: Report the verified running URL and identity, or the stopped reason.
- `stop`: Stop only the process whose PID and health `instance_id` match the current server state.

Never register, add, remove, discover, or mutate projects. Never create project `.proofline` state. Only the SessionStart hook may call the internal `start` action.
