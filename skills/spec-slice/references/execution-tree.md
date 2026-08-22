# Execution-tree contract

This is the single source of truth for the `spec-slice` Inspect, Build, and Validate branches. Read it before deciding whether existing execution artifacts can be reused and before writing new ones.

## Position defines the tree

`<spec-directory>/SPEC.md` is the ready Spec and the root. Node documents live under `<spec-directory>/slices/`; `parent_id` defines their position regardless of file layout.

- A direct child of the root is a Slice and the review boundary for its whole subtree.
- A deeper Node is a SubSlice.
- A root or Node with no children is a Leaf. Normal implementation agents are Leaf-only. A Node Leaf owns a non-empty `write_scope`; a root Leaf uses the already authorized Spec/project root implementation scope.
- A Node with children is a Branch. It stores `write_scope: []`, owns no direct product writes, and closes through its descendants.

These names are derived only from position. Persist no execution type or mode. A Spec with no child Nodes is still a complete tree: create no Node document and create `<spec-directory>/gates/<SPEC-ID>.md`.

The Spec's `Slices` section links only its direct-child Node documents. Do not link deeper Nodes there. When there are no direct children, add no Slice link.

## Complete definition before fan-out

Before any implementation or review work is dispatched:

1. Define the entire root-to-Leaf tree for the current Spec revision.
2. Write every Node from `../assets/templates/slice.md`.
3. Write one Gate from `../assets/templates/gates.md` for the root and every Node at `<spec-directory>/gates/<root-or-node-id>.md`.
4. Add only the direct-child links to the Spec's `Slices` section.
5. Validate the complete artifact set with the commands below.

Partial trees and partial Gate sets cannot fan out.

## Node schema

Node JSON frontmatter contains exactly these fields:

| Field | Contract |
| --- | --- |
| `schema_version` | Integer `3`. |
| `id` | Unique Node identifier. |
| `spec_id` | Root Spec identifier. |
| `spec_revision` | Current ready Spec revision. |
| `parent_id` | Root Spec ID for a direct child; parent Node ID otherwise. |
| `title` | Concise Node title. |
| `status` | `pending` when written; the only mutable Node field after fan-out. |
| `blocked_by` | Sibling IDs whose successful outcomes are prerequisites. |
| `run_after` | Sibling IDs that impose execution order without asserting a result prerequisite. |
| `write_scope` | Non-empty, minimal project-relative paths for a Leaf Node; exactly `[]` for a Branch Node. |

`blocked_by` and `run_after` are arrays and may reference siblings only. Every reference must exist under the same parent. Self-references, duplicate or overlapping references, and cycles in their combined sibling graph are invalid. Every Node must be reachable from the root, target the same Spec revision, and have exactly one parent.

`acceptance_refs`, `type`, and `mode` are invalid Node frontmatter fields.

The body contains exactly these sections:

- `## Outcome`: one observable result owned by the Node.
- `## Spec sections`: relative links to every authoritative Spec section needed for that result.
- `## Contract`: the Node's owned result boundary and completion contract.
- `## Context`: only the context needed to execute or review the Node.

A Slice remains the review boundary whether it is a Leaf or a Branch. SubSlices decompose its execution; they do not create additional top-level Spec links.

## Effective execution scope

Stored `write_scope` and effective execution scope differ for a Branch and the root. Compute effective execution scope deterministically from the accepted fixed tree:

- Leaf Node: its own `write_scope` array.
- Branch Node: the union of all descendant Leaf `write_scope` arrays; the Branch still stores `write_scope: []`.
- Root with child Nodes: the union of all Leaf `write_scope` arrays in the tree.
- Root-only tree: the already authorized Spec/project root implementation scope.

This effective scope bounds every Repair assigned to that fixed contract. It does not create a normal implementation dispatch for a Branch or a root with descendants, expand authorized paths, or mutate a Node, Gate, or Spec definition.

## Gates

Gate IDs are local to one Gate file. IDs must be unique within that file, while separate root or Node Gate files may each use G1, G2, and so on.

Render the Gate template bindings exactly:

- `{{scope}}` is only the owning root-or-Node ID: the current Spec ID for the root Gate, or the corresponding Node `id` for a Node Gate. It renders as `# Gates: <root-or-node-id>`.
- `{{scope_line}}` is the current Spec binding for every Gate in the tree. It renders as `Scope: <spec-id> revision <spec-revision>` using the current Spec `id` and integer `revision`.

For Spec `SPEC-0001` revision `3`, the root lines are `# Gates: SPEC-0001` and `Scope: SPEC-0001 revision 3`; Node `SLICE-01.02` uses `# Gates: SLICE-01.02` with that same Scope line. The inspector matches both values to the current Spec and corresponding Node before consulting checkbox or evidence state. A wrong owner ID, wrong Spec ID, or stale revision is a structural error and exits 2.

The root Gate covers the whole Spec. Each Node Gate covers that Node's Outcome and Contract; a Branch Gate closes only after its child results are available.

A `CHECK` must be a concrete project command runnable from the checkout root. Put no prose-only assertion, hypothetical command, visual inspection, manual step, or reviewer judgment in `CHECK`. Evidence that needs human or model judgment belongs to Blind Review for the applicable Slice or root boundary; do not disguise it as a command. If no runnable project command exists, invent no `CHECK`.

Every Gate item starts unchecked with `EVIDENCE: pending`. An optional expectation may narrow the command's observable success condition, but it cannot replace a runnable `CHECK`.

Render `{{expect_line}}` as one complete indented `EXPECT` line when an expectation is needed, or remove that placeholder line. Initial Gate files contain no `ABANDON` directive. Append `ABANDON: <gate-id> <reason>` only after fan-out when execution stops.

## Freeze boundary

Fan-out begins with the first dispatch of implementation or review work. From that point, Node and Gate definitions are immutable. The only permitted artifact mutations are:

- a Node `status` value;
- a Gate checkbox;
- a Gate `EVIDENCE` value;
- a Gate `ABANDON` record.

Titles, parentage, dependencies, scope, body text, Gate checks, expectations, ordering, and links stay fixed. `ABANDON` records an unfinished path: it does not pass a Gate, satisfy `blocked_by`, or make any Node or the root successful.

## Legacy stop

If inspection finds any v1 or v2 execution Node or Slice plan for the target Spec revision, stop with `explicit re-slice required`. Do not edit, delete, upgrade, supplement, or relink those artifacts without an explicit user request to re-slice. Never mix v1 or v2 artifacts with v3.

## Commands

Timeout N is a positive number of milliseconds.

Planning validation is structural and read-only:

- inspect-execution-tree.js must exit 0.
- run-gates.js status never executes CHECK commands or changes Gate files. Newly pending Gates normally produce exit 1; that expected result does not invalidate planning.
- Exit 2 or any Gate parsing failure blocks planning.
- Planning never invokes run-gates.js run or otherwise executes project Gate checks.

Use these exact CLI names and argument order:

```text
inspect-execution-tree.js <spec-directory>
run-gates.js run --cwd <checkout-root> [--timeout N] <gate-files...>
run-gates.js status <gate-files...>
```

`spec-slice` runs `inspect-execution-tree.js` and `run-gates.js status` before reporting planning complete. It does not run project Gate checks. The implementation workflow uses `run-gates.js run` after fan-out and supplies the root and applicable Node Gate files together.
