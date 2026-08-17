# Proofline Model Routing

An explicit user setting wins. Otherwise choose the lowest setting that fits the role and record a one-line reason. Ask before substituting an unavailable setting.

## Implementation

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

## Tool fields

- Direct and base `create_thread`: set `model` and `thinking`.
- Forked implementer: set `model` and `thinking` in its first implementation `send_message_to_thread`.
- Reviewer `spawn_agent`: set `model`, `reasoning_effort`, and `fork_turns: "none"`.
