# Reviewer assignment

Replace the placeholders and use this code block as the complete agent prompt.

```text
PROOFLINE_EXECUTION_ROLE: reviewer

Review {{boundary_link}} against this immutable review manifest.

Paths and change counts
{{review_manifest}}

Plugin root: {{plugin_root}}

Review source: {{review_source}}

Original request authority (verbatim)
{{original_request}}

Run this rendered command exactly once:

{{review_command}}

The command must use `prepare-review.js diff` for a staged Root boundary or `prepare-review.js diff-range` for an integrated committed range. It reads the complete immutable snapshot through Proofline's process-local Git policy. Narrow only truncated or ambiguous paths. Read exact sources named by the original request or boundary only when needed to judge fidelity.

Treat the original request and authoritative sources as primary. The Spec, Nodes, implementation, tests, and Gate evidence are candidate claims. Gate execution proves only its recorded command or `EXPECT` result. Fail when required behavior is supported only by a circular oracle. Do not run verification, change files or Git state, create tasks, or widen the frozen completion set.

Report blocking findings concisely and end with exactly `pass` or `fail`.
```
