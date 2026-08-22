# Proofline Model Routing

Read this once at run start. Record real-task settings separately from internal-agent routes and reuse both for the run. Do not reread or re-select unless the user changes a routing setting. Ask before substituting an unavailable setting.

## User-visible tasks

For the Spec integration task and every Slice coordinator task, pass task-creation `model` or `thinking` only when the user explicitly selected that field. Otherwise omit both and use the configured task default. Creating or forking a real task is not an internal routing override.

## Internal agents

An explicit user setting wins. Otherwise select the lowest setting that fits each internal role needed by the accepted execution tree and record the choice with a one-line reason. Mechanical Leaves may use the lower setting. Design, cross-boundary integration, and every reviewer use the strong model.

## Implementation and repair

| Setting | Trigger |
| --- | --- |
| `gpt-5.6-sol` + `medium` | Default well-specified work, including routine multi-file changes with known boundaries and validation |
| `gpt-5.6-luna` + `medium` | Narrow mechanical, repetitive, or structured change with known location and validation; simple focused tests |
| `gpt-5.6-sol` + `high` | Unclear-root-cause debugging; integration across module or state boundaries; important design or unclear structure |
| `gpt-5.6-sol` + `xhigh` | Difficult, high-consequence security, data, migration, compatibility, deployment, or rollback work |

Use `max` only on explicit request. Raise effort for complexity, ambiguity, or verification depth; file count alone never raises effort.

## Review

| Setting | Trigger |
| --- | --- |
| `gpt-5.6-sol` + `medium` | Default or local review |
| `gpt-5.6-sol` + `high` | Difficult root cause, broad state flow, cross-Slice integration, or important design |
| `gpt-5.6-sol` + `xhigh` | High-consequence security, data, compatibility, migration, deployment, rollback, or external-contract review |

## Spawn fields

Every Leaf implementer, fixed-Node Repair, and reviewer is a fresh `spawn_agent` call with `fork_context: false`. Internal `spawn_agent` overrides must follow the recorded role route: include `model` and `reasoning_effort` when that route selects an override; otherwise omit both fields.
