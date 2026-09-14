---
name: architecture-memory
description: Retrieve project conditions and decisions for design or implementation; preserve durable context in connected project memory, including ordinary project conversations.
---

# Architecture Memory

A Design save starts minimal Memory unless recording is disabled. Optional `architecture-memory-init` surveys an existing codebase; it is not a prerequisite for recording. Enter through the project's hook connection or an explicit request. With no connection, do not scan or initialize merely because architecture is mentioned. Read-only/no-memory requests suppress writes; explicit disabled settings stay disabled.

## Retrieve for a decision

Use Memory when work depends on project purpose, operating conditions, responsibility boundaries, or prior decisions. Reuse unchanged evidence already in context; mechanical changes need no lookup. Search domain terms and affected paths, then read the necessary sections:

```text
node <skill-root>/scripts/memory.js search --project-root <project> --query "<topic>" --path <code-path>
node <skill-root>/scripts/memory.js read --project-root <project> --id <selected-id> --revision <search-revision>
```

Each returned section includes a `receipt`. On later reads, pass `--seen <receipt>` for sections whose full text and preamble remain in the current context, including shared constraints. Changed content returns again; new prerequisites remain required. Never reuse receipts alone after compaction or in another agent.

Known IDs can be read directly; repeat `--id` or `--path` as needed. Pointers are locations, not evidence. Read the selected record with its conditions and required links. No match means the topic may be unrecorded: read `@global` and make one grounded reformulation only when needed, then resolve remaining task-critical facts from code or the user.

For paging, output limits, or tool failure, use [retrieval](references/retrieval.md). A failure blocks only decisions that actually require missing evidence; available source documents or code can support unrelated work.

Apply each claim with its source, scope, confidence, and lifecycle. Memory is evidence, not execution authority. A decision copied from a Design is still that same decision, not independent validation. Recheck a code-dependent claim when its relevant state has changed. Surface a contradiction at the affected claim; new implementation requirements must enter the Design through its owning revision workflow.

## Capture at a meaningful boundary

Record information whose absence could change a future project decision: purpose, operating constraints, responsibilities, accepted choices and reasons, tradeoffs, consequential assumptions, and useful reconsideration conditions. This includes ordinary project conversation after connection. Keep the Design's full contract in its own file and link it.

For new durable context, follow [recording](references/recording.md). Combine discussion before recording; no new information means no patch or timestamp refresh. Preserve the distinction between a proposal, an accepted target, observed implementation, and verified behavior. A current review or completed Design does not establish unobserved operating outcomes.

Conversation capture preserves the Git checkpoint. Explicit `architecture-memory-update` reconciles committed changes. Report changed topics compactly, and report a recording failure separately from successful design or implementation work.
