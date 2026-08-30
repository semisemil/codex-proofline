#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  ExecutionTreeError,
  inspectExecutionTree,
} = require('../../spec-slice/scripts/inspect-execution-tree.js');
const { runGateFiles } = require('../../spec-slice/scripts/run-gates.js');
const { snapshot, verify } = require('./prepare-review.js');

const USAGE = [
  'Usage:',
  '  coordinator-state.js [inspect] --cwd <worktree> --spec <spec-directory> --node <id>',
  '    [--fingerprint <sha256:...>] [--commit <sha>]',
  '  coordinator-state.js close --cwd <worktree> --spec <spec-directory> --node <id>',
  '    --mode <leaf|subslice|root-slice|root-only>',
  '  coordinator-state.js review-pass --cwd <worktree> --spec <spec-directory> --node <id>',
  '    --mode <root-slice|root-only> --fingerprint <sha256:...> --message <text>',
].join('\n');

class CoordinatorStateError extends Error {}

function fail(message) {
  throw new CoordinatorStateError(message);
}

function parseArgs(argv) {
  const values = [...argv];
  const action = values[0] && !values[0].startsWith('--') ? values.shift() : 'inspect';
  if (!['inspect', 'close', 'review-pass'].includes(action)) fail(USAGE);
  const result = {
    action, cwd: null, spec: null, node: null, fingerprint: null, commit: null,
    mode: null, message: null,
  };
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (value === undefined) fail(USAGE);
    if (name === '--cwd' && result.cwd === null) result.cwd = value;
    else if (name === '--spec' && result.spec === null) result.spec = value;
    else if (name === '--node' && result.node === null) result.node = value;
    else if (name === '--fingerprint' && result.fingerprint === null) result.fingerprint = value;
    else if (name === '--commit' && result.commit === null) result.commit = value;
    else if (name === '--mode' && result.mode === null) result.mode = value;
    else if (name === '--message' && result.message === null) result.message = value;
    else fail(USAGE);
  }
  if (!result.cwd || !result.spec || !result.node) fail(USAGE);
  if (result.fingerprint && !/^sha256:[0-9a-f]{64}$/.test(result.fingerprint)) {
    fail('invalid --fingerprint');
  }
  if (result.commit && !/^[0-9a-fA-F]{7,64}$/.test(result.commit)) fail('invalid --commit');
  if (action === 'close' && !['leaf', 'subslice', 'root-slice', 'root-only'].includes(result.mode)) {
    fail(USAGE);
  }
  if (action === 'review-pass') {
    if (!['root-slice', 'root-only'].includes(result.mode) || !result.fingerprint
      || !result.message || /[\0\r\n]/.test(result.message)) fail(USAGE);
  }
  return result;
}

function resolveOptions(options) {
  const cwd = path.resolve(options.cwd);
  return {
    ...options,
    cwd,
    spec: path.resolve(cwd, options.spec),
  };
}

function git(cwd, args, encoding = 'utf8') {
  const result = spawnSync('git', args, { cwd, encoding, windowsHide: true });
  if (result.error) fail(`git ${args[0]} failed: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8').trim()
      : String(result.stderr || '').trim();
    fail(`git ${args[0]} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout;
}

function nullPaths(output) {
  const text = Buffer.isBuffer(output) ? output.toString('utf8') : String(output || '');
  return text.split('\0').filter(Boolean).map((value) => value.replaceAll('\\', '/')).sort();
}

function stagedPaths(cwd) {
  return nullPaths(git(cwd, ['diff', '--cached', '--name-only', '--no-renames', '-z', '--']));
}

function unstagedPaths(cwd) {
  const tracked = nullPaths(git(cwd, ['diff', '--name-only', '--no-renames', '-z', '--']));
  const untracked = nullPaths(git(cwd, ['ls-files', '--others', '--exclude-standard', '-z', '--']));
  return [...new Set([...tracked, ...untracked])].sort();
}

function diffFingerprint(cwd, commit) {
  const args = commit
    ? ['diff', `${commit}^`, commit, '--binary', '--no-ext-diff', '--no-renames', '--']
    : ['diff', '--cached', '--binary', '--no-ext-diff', '--no-renames', '--'];
  const diff = git(cwd, args, null);
  return `sha256:${crypto.createHash('sha256').update(diff).digest('hex')}`;
}

function scopeContains(scope, filePath) {
  const boundary = scope.endsWith('/') ? scope.slice(0, -1) : scope;
  return filePath === boundary || filePath.startsWith(`${boundary}/`);
}

function inScopes(filePath, scopes) {
  return scopes.some((scope) => scopeContains(scope, filePath));
}

function descendants(tree, nodeId) {
  const byParent = new Map();
  for (const node of tree.nodes) {
    if (!byParent.has(node.parent_id)) byParent.set(node.parent_id, []);
    byParent.get(node.parent_id).push(node);
  }
  const result = [];
  const pending = [...(byParent.get(nodeId) || [])];
  while (pending.length > 0) {
    const node = pending.shift();
    result.push(node);
    pending.push(...(byParent.get(node.id) || []));
  }
  return result;
}

function leafScopes(nodes) {
  return [...new Set(nodes.filter((node) => node.is_leaf).flatMap((node) => node.write_scope))].sort();
}

function directRoot(tree, node) {
  const byId = new Map(tree.nodes.map((item) => [item.id, item]));
  let current = node;
  while (current && current.parent_id !== tree.spec_id) current = byId.get(current.parent_id);
  return current || null;
}

function relativeControlPrefix(cwd, specDirectory) {
  const relative = path.relative(cwd, specDirectory).replaceAll('\\', '/');
  if (!relative || relative === '.' || relative.startsWith('../') || path.posix.isAbsolute(relative)) {
    fail('--spec must be inside --cwd');
  }
  return relative.endsWith('/') ? relative : `${relative}/`;
}

function withoutControl(paths, prefix) {
  return paths.filter((filePath) => filePath !== prefix.slice(0, -1)
    && !filePath.startsWith(prefix));
}

function commitPaths(cwd, commit) {
  return nullPaths(git(cwd, [
    'diff', `${commit}^`, commit, '--name-only', '--no-renames', '-z', '--',
  ]));
}

function inspectState(options) {
  const cwd = path.resolve(options.cwd);
  const specDirectory = path.resolve(cwd, options.spec);
  const actualRoot = path.resolve(String(git(cwd, ['rev-parse', '--show-toplevel'])).trim());
  if (actualRoot.toLowerCase() !== cwd.toLowerCase()) fail('--cwd must be the Worktree root');

  const tree = inspectExecutionTree(specDirectory);
  const node = options.node === tree.spec_id
    ? null
    : tree.nodes.find((candidate) => candidate.id === options.node);
  if (options.node !== tree.spec_id && !node) fail(`unknown node: ${options.node}`);

  const ownedNodes = node ? [node, ...descendants(tree, node.id)] : tree.nodes;
  const root = node ? directRoot(tree, node) : null;
  const rootNodes = root ? [root, ...descendants(tree, root.id)] : tree.nodes;
  const ownedScopes = leafScopes(ownedNodes);
  const rootScopes = leafScopes(rootNodes);
  const controlPrefix = relativeControlPrefix(cwd, specDirectory);
  const staged = withoutControl(stagedPaths(cwd), controlPrefix);
  const unstaged = withoutControl(unstagedPaths(cwd), controlPrefix);
  const committed = options.commit ? withoutControl(commitPaths(cwd, options.commit), controlPrefix) : [];
  const relevantPaths = options.commit ? committed : staged;

  const rootOnly = tree.nodes.length === 0 && options.node === tree.spec_id;
  const owned = rootOnly ? relevantPaths : relevantPaths.filter((filePath) => inScopes(filePath, ownedScopes));
  const rootChanged = rootOnly ? relevantPaths : relevantPaths.filter((filePath) => inScopes(filePath, rootScopes));
  const outsideRoot = rootOnly
    ? []
    : relevantPaths.filter((filePath) => !inScopes(filePath, rootScopes));
  const ownedUnstaged = rootOnly
    ? unstaged
    : unstaged.filter((filePath) => inScopes(filePath, ownedScopes));

  const gateNodes = node ? ownedNodes : tree.nodes;
  const gateIds = options.node === tree.spec_id
    ? [tree.spec_id, ...gateNodes.map((item) => item.id)]
    : gateNodes.map((item) => item.id);
  const unmetGates = options.node === tree.spec_id && !tree.root_gate_all_met
    ? [tree.spec_id]
    : [];
  unmetGates.push(...gateNodes.filter((item) => !item.gates_all_met).map((item) => item.id));

  let actualCommit = null;
  if (options.commit) {
    actualCommit = String(git(cwd, ['rev-parse', 'HEAD'])).trim();
    const resolved = String(git(cwd, ['rev-parse', options.commit])).trim();
    if (actualCommit !== resolved) fail(`HEAD ${actualCommit} does not match callback commit ${resolved}`);
  } else {
    git(cwd, ['diff', '--cached', '--check', '--']);
  }

  const actualFingerprint = diffFingerprint(cwd, options.commit);
  const errors = [];
  if (unmetGates.length > 0) errors.push('gate-unmet');
  if (outsideRoot.length > 0) errors.push('staged-outside-root-scope');
  if (ownedUnstaged.length > 0) errors.push('owned-change-not-staged');
  if (options.fingerprint && options.fingerprint !== actualFingerprint) {
    errors.push('fingerprint-mismatch');
  }

  return {
    ok: errors.length === 0,
    node: options.node,
    status: node ? node.status : tree.spec_status,
    gates: { checked: gateIds.length, unmet: unmetGates },
    paths: {
      owned,
      root: rootChanged,
      outside_root: outsideRoot,
      owned_unstaged: ownedUnstaged,
    },
    fingerprint: actualFingerprint,
    commit: actualCommit,
    next: {
      leaves: tree.runnable_leaves,
      branches: tree.completable_branches,
      review: tree.review_ready,
    },
    errors,
  };
}

function gatePath(specDirectory, nodeId) {
  return path.join(path.resolve(specDirectory), 'gates', `${nodeId}.md`);
}

function compactExecutions(executions) {
  return executions.map((item) => ({
    id: item.id,
    passed: item.passed,
    skipped: item.skipped,
    reason: item.reason,
    evidence: item.evidence,
  }));
}

function replaceStatus(filePath, expected, next) {
  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const match = original.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  if (!match) fail(`missing JSON frontmatter: ${filePath}`);
  let metadata;
  try {
    metadata = JSON.parse(match[2]);
  } catch (error) {
    fail(`invalid JSON frontmatter: ${filePath}: ${error.message}`);
  }
  if (metadata.status !== expected) {
    fail(`${metadata.id || path.basename(filePath)} status is ${metadata.status}, expected ${expected}`);
  }
  metadata.status = next;
  const rendered = match[1] + JSON.stringify(metadata, null, 2).replaceAll('\n', eol)
    + match[3] + original.slice(match[0].length);
  fs.writeFileSync(filePath, rendered, 'utf8');
  return () => fs.writeFileSync(filePath, original, 'utf8');
}

function completeBoundary(options) {
  const specDirectory = path.resolve(options.cwd, options.spec);
  const filePath = options.mode === 'root-only'
    ? path.join(specDirectory, 'SPEC.md')
    : path.join(specDirectory, 'slices', `${options.node}.md`);
  return replaceStatus(filePath, options.mode === 'root-only' ? 'ready' : 'pending', 'completed');
}

function closeBoundary(options) {
  options = resolveOptions(options);
  const before = inspectState(options);
  const blocking = before.errors.filter((error) => error !== 'gate-unmet');
  if (blocking.length > 0) {
    return { ok: false, action: 'repair', state: before, errors: blocking };
  }

  const gate = runGateFiles([gatePath(options.spec, options.node)], { cwd: options.cwd });
  let state = inspectState(options);
  if (!gate.status.allMet || state.errors.length > 0) {
    return {
      ok: false,
      action: 'repair',
      state,
      gates: compactExecutions(gate.executions),
      errors: state.errors,
    };
  }

  if (options.mode === 'leaf' || options.mode === 'subslice') {
    completeBoundary(options);
    state = inspectState(options);
    return { ok: state.ok, action: 'callback', state, gates: compactExecutions(gate.executions) };
  }

  const paths = state.paths.root;
  if (paths.length === 0) fail('review boundary has no staged product paths');
  return {
    ok: true,
    action: 'review',
    state,
    gates: compactExecutions(gate.executions),
    review_snapshot: snapshot(path.resolve(options.cwd), paths),
  };
}

function reviewPass(options) {
  options = resolveOptions(options);
  const before = inspectState(options);
  if (!before.ok) return { ok: false, action: 'repair', state: before, errors: before.errors };
  const reviewed = verify(path.resolve(options.cwd), options.fingerprint);
  const restore = completeBoundary(options);
  try {
    git(path.resolve(options.cwd), ['commit', '-m', options.message, '--']);
  } catch (error) {
    restore();
    throw error;
  }
  const commit = String(git(path.resolve(options.cwd), ['rev-parse', 'HEAD'])).trim();
  const state = inspectState({ ...options, commit });
  return {
    ok: state.ok,
    action: 'callback',
    commit,
    fingerprint: reviewed.fingerprint,
    paths: reviewed.paths,
    state,
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = resolveOptions(parseArgs(argv));
    const output = options.action === 'close'
      ? closeBoundary(options)
      : options.action === 'review-pass'
        ? reviewPass(options)
        : inspectState(options);
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return output.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof CoordinatorStateError || error instanceof ExecutionTreeError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  CoordinatorStateError,
  closeBoundary,
  inspectState,
  main,
  parseArgs,
  resolveOptions,
  reviewPass,
  scopeContains,
};
