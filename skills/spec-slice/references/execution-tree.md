# Execution-tree contract

This is the single source of truth for the `spec-slice` Inspect, Build, and Validate branches. Read it before deciding whether existing execution artifacts can be reused and before writing new ones.

## Position defines the tree

`<spec-directory>/SPEC.md` is the ready Spec and the root. Node documents live under `<spec-directory>/slices/`; `parent_id` defines their position regardless of file layout.

- A direct child of the root is a Slice and owns one coherent part of the root outcome through its whole subtree.
- A deeper Node is a SubSlice and decomposes its parent's outcome further.
- A root or Node with no children is a Leaf. A Node Leaf owns a non-empty `write_scope`; a root Leaf uses the already authorized Spec/project root implementation scope.
- A Node with children is a Branch. It stores `write_scope: []`, owns no direct product writes, and closes through its descendants.

These names are derived only from position and children. Persist no execution type or mode. A Spec with no child Nodes is still a complete tree: create no Node document and create `<spec-directory>/gates/<SPEC-ID>.md`.

The Spec's `Slices` section links only its direct-child Node documents. Do not link deeper Nodes there. When there are no direct children, add no Slice link.

## Decomposition judgment

Use the fewest Nodes that keep implementation, repair ownership, and proof reliable. Root-only is valid when one task can deliver the whole outcome in one continuous pass, even across files or layers. Split only when a child owns a coherent result and the separate task materially reduces context, dependency, failure, or repair risk enough to pay its task, callback, and Gate cost. At the root, group dependent sub-goals that must compose into one end-to-end result under one direct Slice, then decompose only while one pass remains unreliable. Before creating multiple direct Slices, apply the absent-sibling test: each must remain a complete root-outcome contribution if every sibling implementation is omitted. A direct `blocked_by` is valid only across an already-stable boundary; if its dependent consumes an interface, schema, generated artifact, or implementation contract created by the blocker, group both outcomes under one direct Slice and express the dependency below it.

A useful split must:

- cover the parent outcome and authoritative Spec sections exactly once, without gaps or duplicated ownership;
- leave every Leaf independently implementable and mechanically gated with a minimal non-empty `write_scope`;
- express result prerequisites with `blocked_by` and sequencing-only constraints with `run_after`;
- keep every direct Slice's descendant outcomes mutually compatible and composable into the Slice outcome;
- leave every Leaf large enough to avoid artificial handoffs and small enough for one implementation pass.

An independent sub-goal is a meaningful outcome, not a file, layer, technology, component, test category, or unit created for desired parallelism. Keep outcomes together when separation would duplicate context or verification, create a handoff, or split one coherent result. Apply the same judgment recursively and stop at the first reliable one-pass boundary.

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
| `write_scope` | Non-empty, minimal project-relative path boundaries for a Leaf Node; each boundary owns the named path and descendants with or without a trailing `/`; exactly `[]` for a Branch Node. |

`blocked_by` and `run_after` are arrays and may reference siblings only. Every reference must exist under the same parent. Self-references, duplicate or overlapping references, and cycles in their combined sibling graph are invalid. Every Node must be reachable from the root, target the same Spec revision, and have exactly one parent.

`acceptance_refs`, `type`, and `mode` are invalid Node frontmatter fields.

The body contains exactly these sections:

- `## Outcome`: one observable result owned by the Node.
- `## Spec sections`: relative links to every authoritative Spec section needed for that result.
- `## Contract`: the Node's owned result boundary and completion contract.
- `## Context`: only the context needed to execute or review the Node.

A direct Slice owns its complete subtree outcome whether it is a Leaf or a Branch. SubSlices decompose that outcome and create no additional top-level Spec link.

## Runnable candidates

The inspector exposes all mechanically safe runnable work: every runnable Leaf in `dispatch_candidates` and every runnable direct Slice in `runnable_slices`. These are candidate sets, not a one-agent-per-Leaf schedule, quota, or concurrency cap. An implementation coordinator partitions one ready direct-sibling Leaf cohort into the fewest reliable work packets, then closes the complete cohort on one stable product snapshot.

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

A `CHECK` must be a JSON array containing one executable and its arguments, runnable from the checkout root without a shell. Map the Spec's fixed completion set once, without equivalent combinations or unchanged behavior. Place each check at the lowest boundary whose completed subtree contains every prerequisite: a Leaf gets only a check needed before composition; a Branch gets checks of the combined behavior; the root gets only cross-Slice or destination composition. When one direct Slice owns every prerequisite, its Gate owns the whole-result check instead of deferring it to the root. Combine compatible conditions only when one executable invocation decides them. An ancestor never repeats a descendant `CHECK`.

`REQUIRES` is optional and contains exact project-relative file paths that the approved contract explicitly requires to be added or changed. Use a path only when it appears literally in the Spec body or its fixed verification command. Assign each path to one Gate only. Directories, discovered repository boundaries, inferred output files, and duplicate ownership are invalid. If the contract requires an artifact but does not fix its exact file path, omit `REQUIRES`; the fixed `CHECK` remains the evidence. The Gate fails before executing `CHECK` when a required path is absent from its product snapshot: the staged snapshot while closing a pre-commit boundary, or the captured `base..HEAD` review range while finalizing committed Root Slices.

The complete Gate set is exactly the Spec's fixed completion set. Test discovery, lint, type checking, compilation, and build do not substitute for a behavior-running check when one exists. Generated-artifact drift is checked only when contractual. Evidence needing judgment belongs to review.

When a boundary owns no mechanical completion check, render one item with `CHECK: NONE`. Running it records that the frozen completion set contains no command for that boundary; it is not evidence of product behavior. Do not invent a test, build, lint, or type check to avoid this state. JSON-array checks reject shell strings, chaining, pipes, redirection, and command substitution; legacy shell-string Gate files remain readable.

Gate success belongs to the exact code snapshot that produced it. Reuse it through staging, review, commit, and unchanged transport; a relevant mutation invalidates only affected checks and ancestors. Before close, an implementation owner may run one already-frozen Gate item through `run-gates.js feedback` when that result directly guides implementation or Repair. Feedback may neither select a new command nor establish completion, and its success is reused only while product state is unchanged. After implementation stages its final state, `coordinator-state close` runs every still-unmet item for that snapshot. Review cannot add tests beyond the fixed completion set.

Every Gate item starts unchecked with `EVIDENCE: pending`. An optional `EXPECT` replaces exit code as the sole success criterion and matches the command's combined stdout and stderr, so a match passes even when the command exits nonzero. Use it only when that output itself decides a source-required result. Omit it when exit 0 is required; never encode prose such as `exits 0 with ...`, alter a test to print the expected phrase, or compare output generated by the candidate implementation with itself. `CHECK: NONE` has no expectation but may carry `REQUIRES`.

Render `{{expect_line}}` as one complete indented `EXPECT` line when needed and `{{requires_line}}` as one complete indented `REQUIRES` line when needed; otherwise remove the placeholder line. Initial Gate files contain no `ABANDON` directive. Append `ABANDON: <gate-id> <reason>` only after fan-out when execution stops.

## Freeze boundary

Fan-out begins with the first dispatch of implementation or review work. From that point, Node and Gate definitions are immutable. The only permitted artifact mutations are:

- a Node `status` value;
- a Gate checkbox;
- a Gate `EVIDENCE` value;
- a Gate `ABANDON` record.

Titles, parentage, dependencies, scope, body text, Gate checks, requirements, expectations, ordering, and links stay fixed. `ABANDON` records an unfinished path: it does not pass a Gate, satisfy `blocked_by`, or make any Node or the root successful.

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
run-gates.js feedback --cwd <checkout-root> [--timeout N] --gate <gate-file> --id <G#>
run-gates.js status <gate-files...>
```

`spec-slice` runs `inspect-execution-tree.js` and `run-gates.js status` before reporting planning complete. It does not run project Gate checks. The implementation workflow uses `coordinator-state close` after staging; it supplies the applicable Gate files to `run` and reuses matching success evidence.
