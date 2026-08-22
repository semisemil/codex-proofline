# Proofline Model Routing

Read this once at run start. An explicit user setting wins. Otherwise select the lowest setting that fits each role needed by the accepted execution tree, record each selection with a one-line reason, and reuse that routing map for the run. Do not reread or re-select unless the user changes a routing setting. Ask before substituting an unavailable setting.

Mechanical Leaves may use the lower setting. Design, cross-boundary integration, and every reviewer use the strong model.

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

## Agent fields

Every implementer, repairer, and reviewer is a fresh `spawn_agent` call with `fork_context: false`. Include `model` and `reasoning_effort` only when the recorded route selects an override; otherwise omit both fields.
