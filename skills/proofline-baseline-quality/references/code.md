# Code

Use clear names, cohesive functions, simple conditions, shallow flow, and comments only for intent or edge cases; avoid clever one-liners and needless chains.

Add validation, guards, fallbacks, retries, catches, or edge tests only for explicit requirements, real trust boundaries, inspected reachable paths, observed regressions, or documented compatibility. Validate untrusted input at its owning boundary; downstream, trust established invariants. Handle failures only where recovery, translation, cleanup, or user response is owned. Reject speculative or unreachable defenses and tests, silent fallbacks, actionless recovery, and hypothetical abstractions.

Treat local possibility as unproven reachability. Before handling it, trace creation and validation paths and business rules until reachability and intended behavior are established. Keep upstream-excluded states outside normal flow rather than defaulting, ignoring failure, or returning early. If repository evidence cannot establish reachability or intent, ask the user first.
