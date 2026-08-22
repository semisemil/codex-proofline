# Git and workspace integration

Read this only when the prepared project uses Git or the platform can provide isolated worktrees. The execution loop remains authoritative for agent briefs, Gates, review, repair, and status.

## Isolation

Capture the expected HEAD and current status of every existing root before dispatch. Preserve all pre-existing dirty state: do not stage, overwrite, clean, reset, stash, or fold it into implementation commits.

For Git, give each fresh Node agent an isolated subagent/worktree from the current expected integration commit when the platform supports it. Use the inspector result's execution and integration order. Keep no more than two safe Leaves active. If isolation is unavailable, or for Non-Git/shared workspaces, execute one Leaf at a time and measure each Leaf's path delta against its starting state.

## Exact integration

Build an exact allowlist from the reviewed target-scope paths. Stage only that allowlist, confirm `git diff --cached --name-only` matches it exactly, and run `git diff --cached --check`. Commit and integrate only after all three conditions hold. Coordinator-owned Spec, Node, and Gate state and unrelated dirty paths never enter the implementation commit.

Cherry-pick approved commits in the integration order consumed from the inspector. After each successful pick, rerun every Gate in the integrated subtree in the destination root with `run-gates.js run`; prior worktree evidence is not destination evidence.

On cherry-pick conflict, abort the cherry-pick and preserve the destination at its prior expected state. Start the same fixed Node again with a fresh agent and worktree from the current integration commit, then repeat its Gates and every review required by position. Do not resolve the conflict by editing the integration root or changing the Node/Gate contract.

## Safe cleanup

Cleanup is conditional on a terminal agent task. Archive the terminal task first. Only after archival succeeds, verify both:

- `git -C <worktree-root> rev-parse HEAD` equals its expected HEAD;
- `git -C <worktree-root> status --porcelain` is empty.

Then run `git worktree remove <worktree-root>` without `--force`. Any archive, HEAD, cleanliness, or removal failure preserves the exact path for recovery and enters the final report.

Do not push, merge, rebase, squash, force-remove a worktree, or delete a branch.
