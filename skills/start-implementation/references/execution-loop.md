# Recursive execution loop

Read this before the first implementation or review dispatch. The accepted v3 inspector result owns tree shape, position, order, scope, and Gate identity; this document owns execution, evidence, review, repair, and status transitions.

## Implementer brief

Every implementation or repair attempt is a fresh `spawn_agent` call with `fork_context: false`. Normal implementation agents are Leaf-only; a Branch or root with descendants receives an agent only for a Repair assigned to its own fixed contract. Send exactly these top-level fields:

1. **Node/root contract:** the fixed assigned Node document or Spec root contract, plus the assigned checkout root. A normal implementation attempt receives a Node Leaf or root-only contract; a Repair receives the fixed failing Leaf, Branch, or root contract.
2. **Linked Spec sections:** the authoritative section links already selected by that contract.
3. **Context docs:** project instructions, the domain document, applicable ADRs, and Context links named by the contract.
4. **Gate file:** the applicable Leaf Gate path for normal implementation, or the affected subtree Gate paths for Repair, identified as parent-run evidence rather than agent-owned state.
5. **Constraint delta:** only current user constraints not already in the fixed contract. For Repair, include only the evidence-backed blocking findings assigned to this same fixed Node/root and any confirmed user decision. Write `none` when empty.
6. **Report contract:** require `state: returned | blocked`, exact `changed_paths`, commands with results, `sha` or `none`, and an exact blocker or `none`.

A normal implementation agent changes only its Leaf Node's own `write_scope`, or the already authorized Spec/project root implementation scope for a root-only tree. A Repair changes only paths in its fixed failing Node's effective execution scope: a Leaf's own `write_scope`; a Branch or root's descendant-Leaf union; or, for root-only, the already authorized Spec/project root implementation scope. The accepted tree determines these boundaries; neither assignment can expand them. Every implementer and repairer treats Proofline Node and Gate definitions, Spec definitions, Gate checkboxes/evidence, and lifecycle status as read-only. Its report carries no whole-Spec, design, scope, Gate, or review verdict.

## Parent verification

When an agent returns, the coordinator resolves the actual task and checkout root, inspects the current changes, and compares every changed path with that attempt's allowed scope. Agent-created scope drift is a failure and is never integrated. Existing unrelated changes remain untouched.

The coordinator then runs every `CHECK` in the Leaf Gate from that checkout root with the exact `run-gates.js run --cwd <checkout-root> ...` argument order owned by the execution-tree contract. The runner's current Gate state is the mechanical evidence. The agent's commands and report are supporting diagnostics only.

After all child Nodes are completed, run the Branch Gate from the composed checkout. After all direct children are completed, run the root Gate. Check runner output after every invocation: any `ABANDON` stops the run immediately as incomplete. Do not dispatch abandoned work, satisfy a prerequisite with it, or count it as resolved or completed.

## Reviewer brief

Every Slice or Spec Integration review is a fresh `spawn_agent` call with `fork_context: false`. The reviewer is read-only and blind. A root direct child gets exactly one Slice review per attempt after its subtree Gates pass; a failed repair creates a new attempt only after all affected Gates pass again. Nodes below a root direct child get no review, whether Branches or Leaves. The root gets only the final Spec Integration review. A root-only Spec therefore runs as the root Leaf, passes the root Gate, and receives one Spec Integration review with no Slice review. Send exactly these top-level fields:

1. **Boundary contract:** the root direct-child Node for Slice review, or the root Spec for Spec Integration, plus the review checkout root.
2. **Linked Spec sections:** the authoritative sections for that boundary.
3. **Context docs:** project instructions, the domain document, applicable ADRs, and boundary Context links.
4. **Checkout evidence:** exact changed paths, the target-scope diff, and integrated SHAs or `none`.
5. **Gate evidence:** current Gate paths and freshly parent-measured results for the boundary subtree.
6. **Constraint delta:** current user constraints not already in the boundary contract, or `none`.
7. **Report contract:** require `judgment`, `blocking_findings`, `confirmation`, and `observations`.

Exclude implementer self-judgment, implementation or repair history, prior reviewer verdicts, and any expected verdict.

The reviewer returns one judgment:

- `pass`: current code and evidence satisfy the whole boundary contract, introduce no target regression, and stay within authorized scope.
- `fail`: each blocking finding names the violated contract location, current evidence, and the deepest existing Node that owns the violated contract and correction; that owner may be a Leaf, Branch, or root.
- `need_confirm`: an unresolved product or plan decision is outside the fixed contract or current authority; state the decision needed in `confirmation`.

A pre-existing issue blocks only when it prevents a required boundary outcome.

An `observation` is a concrete, evidence-backed issue outside the review boundary. It does not alter the judgment, become repair input, or block completion. Deduplicate and record durable observations through `../../issue-ledger/SKILL.md`; keep issue contents out of subsequent briefs.

## Repair and review loop

Failure count and the repeated-failure stop are tracked independently per fixed failing Node, whether Leaf, Branch, or root. Assign a mechanical Gate failure to the same fixed Node/root whose Gate owns the violated contract; use the reviewer's deepest existing owning Node for a reviewer `fail`. Start every Repair for that same Node with the fresh-agent rule above. Use the implementer brief unchanged except for its constraint delta; never reopen Node selection or edit frozen Node/Gate/Spec definitions.

When a Repair changes code for its fixed Node/root, compute the affected closure from the accepted fixed tree before re-closing:

1. A root-assigned Repair affects the root and every Node in the complete tree.
2. Otherwise seed the closure with the repaired Node and its full subtree.
3. At that Node's parent, take the least fixed point of affected siblings under `blocked_by`: add every sibling whose `blocked_by` names an already affected sibling, directly or through siblings already added, and add each dependent sibling's full subtree.
4. Add the parent to the closure and repeat step 3 at its parent. Continue through the root.

Only reverse-transitive `blocked_by` result dependence expands the closure. `run_after` still imposes accepted execution order, but by itself asserts no result dependence and adds nothing to the closure.

Before re-closing, set every affected `completed` Node to `pending` and discard every prior required boundary-review verdict for each affected root-direct Slice and for the root. Leave Node, Gate, and Spec definitions unchanged; use the accepted tree rather than transient status to determine the closure.

Re-close in accepted dependency order. Within each affected root-direct Slice, rerun every affected Gate bottom-up through that Slice's own Gate, including every already checked Gate, then run a fresh Slice Blind Review. After all affected Slice reviews pass, rerun every remaining affected ancestor Gate bottom-up through the root Gate, then run a fresh final Spec Integration Review. A root-only tree skips the Slice-review step. A non-`ABANDON` Gate failure re-enters the existing fresh fixed-Node Repair rule and its per-Node stops before review; after that Repair changes code, recompute the closure by this same rule. Only current all-met Gate evidence and current required review verdicts can re-close an affected boundary.

Stop immediately with the current evidence when either condition occurs:

- the same evidence-backed failure recurs after repair;
- the fixed Node reaches its third failure.

If no existing Node owns a finding, or the finding requires a changed outcome, scope, check, or product decision, return `need_confirm` or stop for explicit re-slicing. Do not force the finding onto a Leaf. Automatic Repair never relaxes, rewrites, supplements, or replaces a Node, Gate, or Spec definition.

## Status and issue link

Only the coordinator updates lifecycle state. A Node becomes `completed` when every required mechanical Gate is met and, for a root direct child, its fresh Slice review is `pass`. Descendants remain prerequisites of Branch completion. The Spec remains `ready` until every descendant is completed, the root Gate is met, and a fresh Spec Integration review is `pass`; only then set it to `completed`.

An `ABANDON`, stop, unresolved `need_confirm`, or failed Gate leaves the affected Node and every ancestor incomplete. Update the linked issue at implementation start, final pass, and stop according to `../../issue-ledger/references/work-link.md`.
