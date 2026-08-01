# Code

Use clear names, cohesive functions, simple conditions, shallow flow, and comments only for intent or edge cases; avoid clever one-liners and needless chains.

Add validation, guards, fallbacks, retries, catches, or edge tests only for states made valid or reachable by an explicit behavioral requirement, a real trust boundary, an inspected reachable path, an observed regression, or documented compatibility. Validate untrusted input at its owning boundary; downstream, trust established invariants. Handle failures only where recovery, translation, cleanup, or user response is owned. Reject speculative or unreachable defenses and tests, silent fallbacks, actionless recovery, and hypothetical abstractions.

Treat local possibility as unproven reachability. Before handling it, trace creation and validation paths and business rules until reachability and intended behavior are established. Keep upstream-excluded states outside normal flow rather than defaulting, ignoring failure, or returning early. If repository evidence cannot establish reachability or intended behavior and that uncertainty changes the implementation, ask the user before changing behavior.
