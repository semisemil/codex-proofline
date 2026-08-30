# Proofline Model Routing

Read only when the user selects or changes model/thinking settings. Their explicit selection wins; ask before substitution.

For user-visible tasks, pass `model` or `thinking` only when explicitly selected. `create_thread` accepts them. Apply a forked task's selection on its first `send_message_to_thread`; `fork_thread` has no routing fields. Otherwise omit overrides.

Default internal routes:

| Role | Route |
| --- | --- |
| Worktree holder, Slice coordinator | `gpt-5.6-luna` + `low` |
| Preparation, implementation, Repair, Reviewer | `gpt-5.6-sol` + `medium` |

Escalate only for the listed risk:

| Route | Use |
| --- | --- |
| `gpt-5.6-sol` + `high` | Unclear root cause, important design, cross-boundary implementation or review |
| `gpt-5.6-sol` + `xhigh` | High-consequence security, data, migration, compatibility, deployment, rollback, or external-contract work |

Every reviewer uses `gpt-5.6-sol`. Use `max` only when explicitly requested. File count alone does not raise effort.

Create each reviewer with `spawn_agent(fork_turns: "none")`. Holder, coordinator, implementation, and Repair work keeps the task transport in the fixed assignments. Pass the default internal route unless the user selected another route.
