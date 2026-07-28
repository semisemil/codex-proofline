# Proofline Model Routing

Explicit user setting wins. Otherwise choose per role, record one-line reason, and ask before substituting an unavailable setting.

## Implementation

| Setting | Trigger |
| --- | --- |
| `gpt-5.6-sol` + `medium` | Default well-specified work |
| `gpt-5.6-luna` + `medium` | Narrow mechanical change; known location/validation |
| `gpt-5.6-luna` + `xhigh` | Repetitive/structured edits or simple tests |
| `gpt-5.6-terra` + `high` | Debugging or multi-file integration |
| `gpt-5.6-sol` + `high` | Important design, hard root cause, unclear structure |
| `gpt-5.6-sol` + `xhigh` | High-cost security/data/migration/compatibility/deployment/rollback |

Use `max` only on explicit request; file count alone never raises effort.

## Review

| Setting | Trigger |
| --- | --- |
| `gpt-5.6-sol` + `medium` | Default/local |
| `gpt-5.6-sol` + `high` | Difficult design/root cause or broad state flow |
| `gpt-5.6-sol` + `xhigh` | Security/data/compatibility/migration/deployment/rollback/external contract |

Each reviewer: fresh, `fork_turns: "none"`, explicit model/effort. Pass once only the matching role prompt, Spec path, active Slice when applicable, root, overrides, task reference, and latest report. Copy no conversation/repository instructions.
