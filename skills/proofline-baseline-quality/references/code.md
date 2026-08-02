# Code

Use clear names, cohesive functions, simple conditions, shallow flow, and comments only for intent or edge cases; avoid clever one-liners and needless chains.

Add validation, guards, fallbacks, retries, catches, or edge tests only for states made valid or reachable by an explicit behavioral requirement, a real trust boundary, an inspected reachable path, an observed regression, or documented compatibility. Validate untrusted input at its owning boundary; downstream, trust established invariants. Handle failures only where recovery, translation, cleanup, or user response is owned. Reject speculative or unreachable defenses and tests, silent fallbacks, actionless recovery, and hypothetical abstractions.

Local possibility is not proof of reachability. Defensive behavior corresponds to established creation paths, validation paths, business rules, and intended behavior. Upstream-excluded states stay outside normal flow rather than being defaulted, ignored, or converted into early returns. Behavior-changing uncertainty remains undecided without user authorization.
