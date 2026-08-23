---
name: spec-slice
description: "Explicit-only planning for one ready Spec: build and validate its complete v3 execution tree and Gates without implementing it."
---

# Proofline Spec Slice

Plan only. End before implementation, review, or fan-out.

## Inspect

Confirm one target Spec's identity, revision, project, requirements, and `ready` status. Before inspecting or creating execution artifacts, read [the execution-tree contract](references/execution-tree.md); it owns decomposition, schema, invariants, legacy stop, freeze boundary, and commands. Obey any stop it requires without editing artifacts.

## Build

Choose root-only or recursively decompose the work using the contract's decomposition judgment. Node count and parallelism are not goals. Write the complete v3 Node tree and every root/Node Gate for the current revision before fan-out, including a Spec with no child Node. Use the templates and link rules in the execution-tree contract. Do not implement, review, or dispatch work.

## Validate

Run the execution-tree inspector; it must exit 0. Then run Gate status as a read-only parse/status check. Newly pending Gates normally make status exit 1, and that expected pending result does not invalidate planning. Exit 2 or any parse failure blocks planning. Never run project Gate checks during planning.

## Report

Report the Spec path, every Node and Gate path, and the exact validation commands and results, or the exact stop reason. State that no implementation, review, or fan-out was performed.
