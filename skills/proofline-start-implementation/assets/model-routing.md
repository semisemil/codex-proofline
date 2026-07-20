# Proofline Model Routing

This file is the source of truth for implementation and review model recommendations used by `proofline-implementation-spec` and `proofline-start-implementation`.

## Implementation selection

Apply this priority in order:

1. the user's current explicit model and reasoning effort
2. the PRD recommendation, when its rationale still matches the current work
3. the table below

| Setting | Use when |
| --- | --- |
| `gpt-5.6-luna` + `medium` | Very narrow mechanical change with known locations, procedure, completion conditions, and validation. |
| `gpt-5.6-luna` + `xhigh` | Narrow repetitive edits, structured transformation, or simple test additions. |
| `gpt-5.6-terra` + `high` | Ordinary implementation, debugging, and multi-file work. |
| `gpt-5.6-sol` + `medium` | Settled design with long execution across modules, tools, and tests. |
| `gpt-5.6-sol` + `high` | Important design judgment, difficult root-cause analysis, or unclear structure. |
| `gpt-5.6-sol` + `xhigh` | Security, data, migration, compatibility, deployment, or rollback with high failure cost. |
| `gpt-5.6-sol` + `max` | An exceptional single hard problem or explicit user request. |

Use `gpt-5.6-sol` + `medium` unless another row has a concrete reason. Do not raise effort merely because many files exist. Never choose `max` automatically.

When writing a PRD, recommend the implementation setting from this table and record the concrete reason. The recommendation is guidance, not a binding product decision.

When starting implementation, re-evaluate whether the PRD recommendation still fits the current project and work. Put the selected setting and rationale in the implementation task request and final report. If task creation fails, report the failure and do not switch settings without explicit user direction.

## Review selection

Choose each review setting independently. Spawn every pre-review and post-review as a fresh subagent with `fork_turns: "none"`, and set both `model` and `reasoning_effort` explicitly.

| Review scope | Setting |
| --- | --- |
| Narrow, low-risk local change | `gpt-5.6-sol` + `medium` |
| Default review | `gpt-5.6-sol` + `high` |
| Security, data, compatibility, migration, or external contract | `gpt-5.6-sol` + `xhigh` |

Use `gpt-5.6-sol` + `high` by default. Lower to `medium` only for a concretely narrow, low-risk local review; raise to `xhigh` only for a listed high-risk scope. Do not raise effort merely because the diff is large.

Pass the compact review prompt, exact PRD path, project root, current constraints, and implementation task reference when applicable. A post-review subagent may not have top-level task-reading tools, so also pass the latest complete implementation report exactly once. Do not fork or copy the coordinator conversation. If the selected model or effort is unavailable, stop and report it instead of silently inheriting or downgrading.
