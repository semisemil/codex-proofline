# Proofline Model Routing

Read only when the user selects or changes model/thinking settings. Their explicit selection wins; ask before substitution.

For user-visible tasks, pass `model` or `thinking` only when explicitly selected. `create_thread` accepts them. Apply a forked task's selection on its first `send_message_to_thread`; `fork_thread` has no routing fields. Otherwise omit overrides.

For internal agents, record the lowest fitting route once and reuse it:

| Route | Use |
| --- | --- |
| `gpt-5.6-luna` + `medium` | Narrow mechanical work with known location and checks |
| `gpt-5.6-sol` + `medium` | Default well-specified implementation, repair, or local review |
| `gpt-5.6-sol` + `high` | Unclear root cause, important design, cross-boundary implementation or review |
| `gpt-5.6-sol` + `xhigh` | High-consequence security, data, migration, compatibility, deployment, rollback, or external-contract work |

Every reviewer uses `gpt-5.6-sol`. Use `max` only when explicitly requested. File count alone does not raise effort.

Create every Leaf implementer, fixed-Node Repair, and reviewer with `spawn_agent(fork_turns: "none")`. Include `model` and `reasoning_effort` only for a selected internal override.
