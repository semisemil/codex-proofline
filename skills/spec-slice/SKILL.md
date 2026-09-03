---
name: spec-slice
description: "Explicit-only planning for one ready Spec: build and validate its complete v3 execution tree and Gates without implementing it."
---

# Proofline Spec Slice

Plan only. End before implementation, review, or fan-out.

## Inspect

Confirm one target Spec's identity, revision, project, requirements, and `ready` status. Before inspecting or creating execution artifacts, read [the execution-tree contract](references/execution-tree.md); it owns decomposition, schema, invariants, legacy stop, freeze boundary, and commands. Obey any stop it requires without editing artifacts.

## Build

Choose root-only or recursively decompose the work using the contract's decomposition judgment. Node count and parallelism are not goals. Write the complete v3 Node tree and every root/Node Gate for the current revision before fan-out, including a Spec with no child Node. Map only the Spec's fixed completion set across the Gates without renaming its identifiers, output fields, paths, commands, or quantities. When the Spec explicitly requires adding or changing an artifact and its exact file path appears in the Spec body or fixed verification command, assign that path once as one Gate's `REQUIRES`. A directory, a discovered repository boundary, an inferred output file, or the same path on another Gate is invalid; omit `REQUIRES` when the exact file is not fixed. A boundary without a mechanical check uses `CHECK: NONE`; it does not receive a substitute test. Use the templates and link rules in the execution-tree contract. Do not implement, review, or dispatch work.

## Validate

Run [the execution-tree inspector](scripts/inspect-execution-tree.js); it must exit 0. Then use [the Gate runner](scripts/run-gates.js) for a read-only `status` check. Newly pending Gates normally make status exit 1, and that expected pending result does not invalidate planning. The successful inspector result remains final tree evidence after this expected pending status; report it directly. Exit 2 or any parse failure blocks planning. Never run project Gate checks during planning.

## Report

Report the Spec path, every Node and Gate path, and the exact validation commands and results, or the exact stop reason. State that no implementation, review, or fan-out was performed.
