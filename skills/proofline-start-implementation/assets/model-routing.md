# Proofline Model Routing

Explicit user setting wins. Otherwise choose the lowest setting that fits the role, record one-line reason, and ask before substituting an unavailable setting.

## Implementation

| Setting | Trigger |
| --- | --- |
| `gpt-5.6-sol` + `medium` | Default well-specified work, including routine multi-file changes with known boundaries and validation |
| `gpt-5.6-luna` + `medium` | Narrow mechanical, repetitive, or structured change with known location and validation; simple focused tests |
| `gpt-5.6-sol` + `high` | Unclear-root-cause debugging; integration across module or state boundaries; important design or unclear structure |
| `gpt-5.6-sol` + `xhigh` | Difficult, high-consequence security/data/migration/compatibility/deployment/rollback work requiring cross-system reasoning |

Use `max` only on explicit request. Raise effort for complexity, ambiguity, or verification depth; file count alone never raises effort.

## Review

| Setting | Trigger |
| --- | --- |
| `gpt-5.6-sol` + `medium` | Default/local |
| `gpt-5.6-sol` + `high` | Difficult root cause, broad state flow, cross-Slice integration, or important design |
| `gpt-5.6-sol` + `xhigh` | High-consequence security/data/compatibility/migration/deployment/rollback/external-contract review requiring cross-system reasoning |

Each reviewer: fresh, `fork_turns: "none"`, explicit model/effort. Pass once only the matching role prompt, Spec path, active Slice when applicable, root, overrides, task reference, and latest report. Copy no conversation or repository instruction text; each reviewer reads applicable repository instructions from root.
