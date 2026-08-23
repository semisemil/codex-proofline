# Recursive execution loop

Read this before the first implementation or review dispatch. The accepted v3 inspector result owns tree shape, position, order, scope, Gate identity, and mechanically runnable candidates; this document owns task boundaries, execution choice, evidence, review, repair, and status transitions.

## Task topology and selection

The original-checkout task creates a user-visible Spec integration task/worktree and hands orchestration to it; the original-checkout task performs no implementation or review. The Spec integration task is the Spec coordinator and calls `execute(root)`. For a root with children, it creates or forks one user-visible Slice coordinator task/worktree for each selected runnable direct Slice. A root-direct Slice is always an actual platform task/thread, never a `spawn_agent` implementation worker. The Slice task coordinates its entire subtree; recursive `execute(node)` calls for deeper SubSlices stay in that task. For a root-only Spec, the Spec integration task executes the root Leaf and creates no Slice task.

User-visible task handoffs are callback-driven. Before dispatch, the parent passes its own ready task `threadId` as `report_destination`; never use a provisional `clientThreadId`. After creating the child or sending its next assignment, the parent ends its current turn instead of following progress. It does not call `wait_threads`. The child sends one terminal report for that assignment to `report_destination` with `send_message_to_thread`, then ends its turn; that callback resumes the parent.

On each callback, the parent re-inspects the fixed tree, actual task state, and checkout evidence, then processes every selected task whose terminal report is available. If other selected tasks are still running and no work is currently unlocked, end the turn again. Do not poll them. Progress commentary is not a completion callback.

Before each dispatch wave, re-inspect the fixed tree. `dispatch_candidates` and `runnable_slices` contain all mechanically safe runnable work, not a schedule or quota. The Spec coordinator chooses any safe subset of Slice tasks, and each execution coordinator chooses any safe subset of its Leaves, based on `blocked_by`, `run_after`, effective write-scope overlap, shared-workspace safety, task size, and available capacity. Impose no numeric cap. Serialize work when shared state makes concurrency unsafe.

## Task briefs

The Spec integration task receives the root Spec contract, the accepted complete inspector result, all Node and Gate paths, project/domain/ADR instructions, the original checkout path and recorded Git state, current user constraints, model-routing selections, and the original-checkout task's ready `threadId` as `report_destination`. It receives no issue body or prior implementation history.

Each Slice task receives only:

1. its root-direct Slice contract and descendant Node contracts;
2. linked Spec sections and Context documents reachable from that subtree;
3. that subtree's Gate paths and accepted inspector records;
4. its assigned checkout root and recorded integration-base commit;
5. current user constraints not already in those contracts;
6. the recursive execution and lifecycle contracts needed to call `execute(slice)`;
7. the Spec coordinator's ready `threadId` as `report_destination` and the callback report contract.

Exclude other Slice contracts, unrelated Spec sections, prior implementation or repair history, reviewer verdicts, and any expected result. The Slice task sends `state: returned | blocked`, its `slice_id`, checkout root, exact changed paths, descendant status, Gate commands and results, and an exact blocker or `none` to `report_destination` with `send_message_to_thread`, then ends its turn. It supplies no Blind Review or whole-Spec verdict. The Spec coordinator resolves actual task state and checkout evidence instead of trusting the report alone.

## Implementer brief

Inside an execution coordinator, use `spawn_agent` only for a fresh Leaf implementation or fixed-Node Repair, always with `fork_context: false`. Normal implementation agents are Leaf-only; a Branch or root with descendants receives an agent only for a Repair assigned to its fixed contract. Send exactly these top-level fields:

1. **Node/root contract:** the fixed assigned Node document or Spec root contract, plus the assigned checkout root. A normal implementation attempt receives a Node Leaf or root-only contract; a Repair receives the fixed failing Leaf, Branch, or root contract.
2. **Linked Spec sections:** the authoritative section links already selected by that contract.
3. **Context docs:** project instructions, the domain document, applicable ADRs, and Context links named by the contract.
4. **Gate file:** the applicable Leaf Gate path for normal implementation, or the affected subtree Gate paths for Repair, identified as parent-run evidence rather than agent-owned state.
5. **Constraint delta:** only current user constraints not already in the fixed contract. For Repair, include only the evidence-backed blocking findings assigned to this same fixed Node/root and any confirmed user decision. Write `none` when empty.
6. **Report contract:** require `state: returned | blocked`, exact `changed_paths`, commands with results, `staged_or_committed: false`, and an exact blocker or `none`.

A normal implementation agent changes only its Leaf Node's own `write_scope`, or the already authorized Spec/project root implementation scope for a root-only tree. A Repair changes only paths in its fixed failing Node's effective execution scope: a Leaf's own `write_scope`; a Branch or root's descendant-Leaf union; or, for root-only, the already authorized Spec/project root implementation scope. The accepted tree determines these boundaries; neither assignment can expand them. Leaf and Repair subagents never stage or commit. Every implementer and repairer treats Proofline Node and Gate definitions, Spec definitions, Gate checkboxes/evidence, and lifecycle status as read-only. Its report carries no whole-Spec, design, scope, Gate, or review verdict.

## Parent verification

Before dispatching one or more Leaves in a shared checkout, the owning execution coordinator records one execution wave: selected Leaf IDs, each fixed `write_scope`, and an exact pre-wave checkout snapshot sufficient to distinguish path additions, removals, content changes, and pre-existing changes. A sequential Leaf is a wave of one. Selected Leaves must already be mechanically safe together.

Wait for every selected internal Leaf or Repair subagent in the wave to return or block before verification. Resolve the actual task and checkout root, compute the exact wave delta from the pre-wave snapshot, and require every new or changed path to fall within the union of the selected Leaves' fixed scopes. Any path outside that union, or any change to pre-existing state outside it, is scope drift and is never integrated. Do not compare one returning agent with the checkout's accumulated whole-Slice diff; agent reports do not prove path attribution inside a parallel wave. Existing unrelated changes remain untouched.

After the wave delta passes, run every selected Leaf Gate from that checkout root with the exact `run-gates.js run --cwd <checkout-root> ...` argument order owned by the execution-tree contract. Map changed paths to their disjoint fixed scopes and close only Leaves whose own Gates pass. The runner's current Gate state is the mechanical evidence. Agent commands and reports are supporting diagnostics only. A failed or blocked Leaf enters the fixed-Node Repair rule without discarding successful sibling evidence; any Repair starts a new wave and re-closes the affected dependency closure.

Inside a Slice task, close descendant Nodes bottom-up: after all child Nodes complete, run the Branch Gate, update subtree Gate evidence, and mark that descendant Branch complete. Run the direct Slice Gate after its descendants complete, but leave the direct Slice `pending`. Only the Spec coordinator runs the root Gate. Check runner output after every invocation: any `ABANDON` stops the run immediately as incomplete. Do not dispatch abandoned work, satisfy a prerequisite with it, or count it as resolved or completed.

## Reviewer brief

The Spec coordinator creates every Slice or Spec Integration reviewer as a fresh `spawn_agent` call with `fork_context: false`, keeps its current turn active, and uses the internal agent wait mechanism until that reviewer returns. The reviewer is read-only and blind. A root-direct Slice gets exactly one Slice review per attempt in its Slice worktree after subtree Gates pass; a failed repair creates a new attempt only after all affected Gates pass again. Nodes below it get no review. The root gets only the final Spec Integration review in the Spec integration worktree. A root-only Spec therefore executes as the root Leaf in that task, passes the root Gate, and receives one Spec Integration review with no Slice review. Send exactly these top-level fields:

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

Failure count and the repeated-failure stop are tracked independently per fixed failing Node, whether Leaf, Branch, or root. Assign a mechanical Gate failure to the same fixed Node/root whose Gate owns the violated contract; use the reviewer's deepest existing owning Node for a reviewer `fail`. A Slice-review or integrated-Slice-Gate failure returns to the owning Slice task, which starts a fresh Repair for that fixed Node. A root-owned failure stays with the Spec coordinator. Use the implementer brief unchanged except for its constraint delta; never reopen Node selection or edit frozen Node/Gate/Spec definitions.

When a Repair changes code for its fixed Node/root, compute the affected closure from the accepted fixed tree before re-closing:

1. A root-assigned Repair affects the root and every Node in the complete tree.
2. Otherwise seed the closure with the repaired Node and its full subtree.
3. At that Node's parent, take the least fixed point of affected siblings under `blocked_by`: add every sibling whose `blocked_by` names an already affected sibling, directly or through siblings already added, and add each dependent sibling's full subtree.
4. Add the parent to the closure and repeat step 3 at its parent. Continue through the root.

Only reverse-transitive `blocked_by` result dependence expands the closure. `run_after` still imposes accepted execution order, but by itself asserts no result dependence and adds nothing to the closure.

Before re-closing, set every affected `completed` Node to `pending` and discard every prior required boundary-review verdict for each affected root-direct Slice and for the root. Leave Node, Gate, and Spec definitions unchanged; use the accepted tree rather than transient status to determine the closure.

Re-close in accepted dependency order. The owning Slice task reruns every affected Gate bottom-up through its Slice Gate, including every already checked Gate, then the Spec coordinator runs a fresh Slice Blind Review and the Git integration sequence when applicable. After every affected direct Slice passes review and integrated subtree Gates, the Spec coordinator reruns affected ancestor Gates through the root Gate, full Spec checks, and a fresh final Spec Integration Review. A root-only tree skips Slice tasks and Slice review. A non-`ABANDON` Gate failure re-enters the existing fresh fixed-Node Repair rule and its per-Node stops before review; after Repair changes code, recompute the closure by this same rule. Only current all-met Gate evidence and current required review verdicts can re-close an affected boundary.

Stop immediately with the current evidence when either condition occurs:

- the same evidence-backed failure recurs after repair;
- the fixed Node reaches its third failure.

If no existing Node owns a finding, or the finding requires a changed outcome, scope, check, or product decision, return `need_confirm` or stop for explicit re-slicing. Do not force the finding onto a Leaf. Automatic Repair never relaxes, rewrites, supplements, or replaces a Node, Gate, or Spec definition.

## Status and issue link

Lifecycle ownership follows task boundaries. A Slice coordinator may update subtree Gate evidence and mark descendant Nodes `completed` after their Gates pass; it never closes its root-direct Slice. The Spec coordinator marks that direct Slice `completed` only after a fresh Slice Blind Review passes, the Slice result is present in the Spec integration workspace, and subtree Gates pass there. The Spec coordinator alone owns root Gate evidence and root/Spec status. The Spec remains `ready` until every direct Slice is completed, the root Gate and full Spec checks pass, and a fresh Spec Integration Review is `pass`; only then set it to `completed`.

An `ABANDON`, stop, unresolved `need_confirm`, or failed Gate leaves the affected Node and every ancestor incomplete. Update the linked issue at implementation start, final pass, and stop according to `../../issue-ledger/references/work-link.md`.
