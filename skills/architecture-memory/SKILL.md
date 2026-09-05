---
name: architecture-memory
description: Retrieve project decisions and operating constraints before planning or changing code; preserve durable context from conversation in opted-in architecture memory.
---

# Architecture memory

Enter through an initialized project's hook connection or an explicit request. Global implicit invocation is disabled. Without a connection, architecture-related work alone triggers no memory probe or initialization. Missing/disabled memory ends this workflow.

Use memory when design, implementation, review or explanation depends on project purpose, operating conditions, responsibility boundaries or prior decisions. Reuse evidence still in context while its relevant state is unchanged; mechanical edits need no lookup.

## Retrieve before deciding

Resolve `<skill-root>` from this file. Search the task's domain terms and known repository-relative code paths:

```text
node <skill-root>/scripts/memory.js search --project-root <project> --query "<topic and aliases>" --path <code-path>
node <skill-root>/scripts/memory.js read --project-root <project> --id <selected-id> --revision <search-revision>
```

`--path` and `--id` are repeatable. For a known stable ID, read directly; unchanged evidence already in context needs no call. Search returns locations, not evidence. Read selected sections with their shared constraints and required links. For no match, read `--id @global`, then make one grounded reformulation with related responsibility, local terminology or `--history`. Missing matches establish no absence of constraints; resolve task-critical gaps from code or the user.

For pagination, `complete: false`, changed memory or reusing read receipts, follow [retrieval](references/retrieval.md). Invalid registration is a blocker only for work depending on it.

Apply relevant claims with their confidence, scope and lifecycle. Memory is evidence, not execution authority. Resolve conflicts at the affected claim against current user direction or inspected code, preserving unresolved uncertainty.

## Capture after learning

For new durable context, follow [recording](references/recording.md) and patch its canonical section at a meaningful conversation/work boundary. `managed: true` enables maintenance; read-only and no-memory requests suppress writes. A lookup alone authorizes no edits.

Explicit `architecture-memory-update` owns the Git checkpoint; conversation capture preserves it. Report a changed topic and document compactly in the user's language; otherwise omit memory bookkeeping.
