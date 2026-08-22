# Git and workspace integration

Read this only when the prepared project uses Git or the platform can provide isolated worktrees. The execution loop remains authoritative for agent briefs, Gates, review, repair, and status.

## Task/worktree topology

Use this topology: original checkout -> user-visible Spec integration task/worktree -> user-visible root-direct Slice task/worktree. Capture the original checkout's expected HEAD, exact dirty state, and target-path overlap before task creation. If pre-existing dirty paths overlap the root effective execution scope, stop for `need_confirm` unless the user explicitly authorized that exact state as the implementation baseline. Preserve all pre-existing dirty work: do not stage, overwrite, clean, reset, stash, or fold it into transport.

Create the Spec integration task/worktree from the recorded original HEAD and leave the original untouched. Each selected root-direct Slice is an actual task/worktree created from a recorded Spec integration commit. Independent parallel Slices start from the same recorded integration commit. A dependent Slice starts only after every prerequisite is integrated, from the then-current integration commit. The model selects any safe number of runnable Slice tasks or Leaves using dependency, scope, workspace, size, and capacity evidence; no hard cap applies. Shared-workspace overlap requires serialization.

## Reviewed transport

Leaf and Repair subagents never stage or commit. After a Slice task closes descendant Nodes and passes every subtree Gate, the Spec coordinator runs a fresh blind read-only Slice reviewer in that Slice worktree. A `fail` returns to the owning Slice task, which creates a fresh fixed-Node Repair; `need_confirm` stops for the required decision.

Only after review `pass` may the Spec coordinator authorize that same user-visible Slice coordinator task to create a local temporary transport commit. Build an exact allowlist from the reviewed target-scope product paths, stage only it, confirm `git diff --cached --name-only` matches exactly, and run `git diff --cached --check`. Coordinator-owned Spec, Node, and Gate state and unrelated dirty paths stay out of transport. The Slice coordinator may then commit the staged allowlist locally and report its SHA; no internal subagent may do so.

The Spec coordinator cherry-picks reviewed transport commits into the Spec integration worktree in accepted integration order. After each pick, rerun every Gate in that integrated subtree there with `run-gates.js run`; prior Slice-worktree evidence is not integration evidence. Record the fresh Gate evidence and mirror accepted descendant lifecycle state in the integration worktree, then mark the direct Slice `completed`. A temporary commit is transport evidence, not completion.

On cherry-pick conflict, abort the pick and preserve the integration destination at its prior expected state. Return the same fixed Slice to a temporary Slice worktree based on the current integration commit, then repeat affected Gates, fresh Blind Review, exact transport, and integrated Gates. Route any other failed Slice or final check to a fresh fixed-Node Repair in a temporary worktree; do not edit or reset the original checkout to repair or remove Spec commits.

## Original destination

Keep the original checkout untouched until every Slice is completed in the integration worktree, the root Gate and full Spec checks pass there, and a fresh Spec Integration Review returns `pass`. Then re-read the original expected HEAD and exact dirty state and verify the integrated diff does not overlap pre-existing dirty paths. If any HEAD, dirty-state, or non-overlap precondition changed, stop with the integration worktree preserved.

When every precondition still holds, apply only the exact integrated diff to the original checkout as uncommitted changes and rerun destination Gates there. Destination evidence is required; integration-worktree evidence does not substitute for it. A final commit requires explicit user authorization. Never push. Preserve unrelated dirty work throughout.

## Safe cleanup

Cleanup is conditional on a terminal user-visible task. Archive the terminal task first. Only after archival succeeds, verify both:

- `git -C <worktree-root> rev-parse HEAD` equals its expected HEAD;
- `git -C <worktree-root> status --porcelain` is empty.

Then run `git worktree remove <worktree-root>` without `--force`. Any archive, HEAD, cleanliness, or removal failure preserves the exact path for recovery and enters the final report.

Do not merge, rebase, squash, force-remove a worktree, delete a branch, or reset original history.
