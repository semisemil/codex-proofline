# Record durable context

Preserve information whose absence could change a future project decision: goals/non-goals, actual physical or organizational operating conditions, constraints, accepted choices and reasons, quality tradeoffs and consequential unknowns. Record only project-relevant detail; credentials, incidental personal data and temporary debugging history do not belong here.

Attribute claims to the user, inspected code or inference, retaining scope, conditions, exceptions and decision status. Code proves structure, not motives. Silence, a proposal and successful implementation establish no user acceptance. A stated operating fact needs attribution, not another approval round. Use available message references or date/speaker/distinguishing wording; never invent quotations, transcript IDs, dates or alternatives.

## Canonical record

Reuse a known canonical section or search the concept before adding one. Keep an independently useful item in a level-2 section with its conditions and exceptions. Split materially different scopes. Follow local form for existing records; use [record format](record-format.md) for new routing, state changes or required links. Section IDs survive renames; update affected path mappings.

For replacement decisions, retire the old current effect while retaining material reasons. An unresolved conflict retains both sources. Code changes cannot prove that a plan was accepted or completed. Check a code-dependent claim against relevant current code before relying on it.

Partial patches preserve manifest `verified_at` and `source_revision`; only whole-document evidence review refreshes them. Conversation provenance belongs beside its claim. Explicit Git update owns `git_checkpoint`.

## Write boundary

After opt-in, patch once per established decision or meaningful work boundary, including conversations without code changes. Combine repeated discussion before context is lost. Read-only and no-memory requests suppress writes. With no new durable information, make no patch, timestamp refresh or activity log.

Load [base templates](base-templates.md) only for structural base-document changes, [component templates](component-templates.md) for selected L3, or [decision templates](decision-templates.md) for significant explicit choices with rationale. Ordinary operating facts need no ADR. Keep tables and Mermaid consistent; register new documents.

During init/update, write to the operation's draft and let `apply` validate it. For ordinary conversation capture, patch the registered document and run `memory.js check --project-root <project>` once; correct reported problems before reporting completion. Retire resolved questions and obsolete effects while preserving relevant reasons and conditions.
