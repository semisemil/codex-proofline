#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  ExecutionTreeError,
  inspectExecutionTree,
} = require('../../spec-slice/scripts/inspect-execution-tree.js');
const {
  GateParseError,
  GateUsageError,
  runGateFiles,
} = require('../../spec-slice/scripts/run-gates.js');
const {
  PrepareReviewError,
  snapshot,
  snapshotRange,
  verify,
  verifyRange,
} = require('./prepare-review.js');
const { diffCheckArgs, gitCommandName, spawnGit } = require('../../../lib/git-policy.js');
const {
  commitControlMerge,
  ControlStateError,
  controlManifest,
  planControlMerge,
  specRelativePath,
} = require('./control-state.js');

const USAGE = [
  'Usage:',
  '  coordinator-state.js capture --cwd <checkout> --spec <spec-directory> --node <id>',
  '  coordinator-state.js [inspect] --cwd <worktree> --spec <spec-directory> --node <id>',
  '    [--fingerprint <sha256:...>] [--commit <sha>]',
  '  coordinator-state.js close --cwd <worktree> --spec <spec-directory> --node <id>',
  '    --mode <leaf|subslice|root-slice|root-only>',
  '  coordinator-state.js close-batch --cwd <worktree> --spec <spec-directory>',
  '    --nodes <leaf-id,leaf-id,...>',
  '  coordinator-state.js review-pass --cwd <worktree> --spec <spec-directory> --node <id>',
  '    --mode <root-slice|root-only> --fingerprint <sha256:...> --message <text>',
  '  coordinator-state.js finalize --cwd <worktree> --spec <spec-directory> --node <spec-id>',
  '    --mode <single-root|multi-root> --base <commit> [--fingerprint <sha256:...>]',
  '  coordinator-state.js finalize-review-pass --cwd <worktree> --spec <spec-directory>',
  '    --node <spec-id> --base <commit> --commit <commit> --fingerprint <sha256:...>',
  '  coordinator-state.js apply-reviewed --cwd <checkout> --source <worktree>',
  '    --spec <source-spec-directory> --node <id> --base <commit> --commit <commit>',
  '    [--fingerprint <sha256:...>] --destination-fingerprint <sha256:...>',
  '    --control-fingerprint <sha256:...>',
].join('\n');

class CoordinatorStateError extends Error {}

function fail(message) {
  throw new CoordinatorStateError(message);
}

function parseArgs(argv) {
  const values = [...argv];
  const action = values[0] && !values[0].startsWith('--') ? values.shift() : 'inspect';
  if (![
    'capture', 'inspect', 'close', 'close-batch', 'review-pass', 'finalize', 'finalize-review-pass',
    'apply-reviewed',
  ].includes(action)) {
    fail(USAGE);
  }
  const result = {
    action, cwd: null, spec: null, node: null, fingerprint: null, commit: null,
    mode: null, message: null, source: null, base: null, destinationFingerprint: null,
    controlFingerprint: null, nodes: null,
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
    else if (name === '--source' && result.source === null) result.source = value;
    else if (name === '--base' && result.base === null) result.base = value;
    else if (name === '--destination-fingerprint' && result.destinationFingerprint === null) {
      result.destinationFingerprint = value;
    }
    else if (name === '--control-fingerprint' && result.controlFingerprint === null) {
      result.controlFingerprint = value;
    }
    else if (name === '--nodes' && result.nodes === null) result.nodes = value.split(',');
    else fail(USAGE);
  }
  if (!result.cwd || !result.spec) fail(USAGE);
  if (action === 'close-batch') {
    if (result.node !== null || !result.nodes || result.nodes.length === 0
      || result.nodes.some((node) => !node || node !== node.trim())) fail(USAGE);
  } else if (!result.node || result.nodes !== null) fail(USAGE);
  if (result.fingerprint && !/^sha256:[0-9a-f]{64}$/.test(result.fingerprint)) {
    fail('invalid --fingerprint');
  }
  if (result.commit && !/^[0-9a-fA-F]{7,64}$/.test(result.commit)) fail('invalid --commit');
  if (result.base && !/^[0-9a-fA-F]{7,64}$/.test(result.base)) fail('invalid --base');
  if (result.destinationFingerprint
    && !/^sha256:[0-9a-f]{64}$/.test(result.destinationFingerprint)) {
    fail('invalid --destination-fingerprint');
  }
  if (result.controlFingerprint && !/^sha256:[0-9a-f]{64}$/.test(result.controlFingerprint)) {
    fail('invalid --control-fingerprint');
  }
  if (action === 'close' && !['leaf', 'subslice', 'root-slice', 'root-only'].includes(result.mode)) {
    fail(USAGE);
  }
  if (action === 'close-batch' && result.mode !== null) fail(USAGE);
  if (action === 'review-pass') {
    if (!['root-slice', 'root-only'].includes(result.mode) || !result.fingerprint
      || !result.message || /[\0\r\n]/.test(result.message)) fail(USAGE);
  }
  if (action === 'finalize') {
    if (!['single-root', 'multi-root'].includes(result.mode) || !result.base
      || (result.mode === 'single-root' && !result.fingerprint)) fail(USAGE);
  }
  if (action === 'finalize-review-pass'
    && (!result.base || !result.commit || !result.fingerprint)) fail(USAGE);
  if (action === 'apply-reviewed' && (!result.source || !result.base || !result.commit
    || !result.destinationFingerprint || !result.controlFingerprint)) fail(USAGE);
  return result;
}

function resolveOptions(options) {
  const cwd = path.resolve(options.cwd);
  const source = options.source ? path.resolve(options.source) : null;
  return {
    ...options,
    cwd,
    source,
    spec: path.resolve(options.action === 'apply-reviewed' ? source : cwd, options.spec),
  };
}

function git(cwd, args, encoding = 'utf8') {
  const result = spawnGit(cwd, args, { encoding });
  const command = gitCommandName(args);
  if (result.error) fail(`git ${command} failed: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8').trim()
      : String(result.stderr || '').trim();
    const stdout = Buffer.isBuffer(result.stdout)
      ? result.stdout.toString('utf8').trim()
      : String(result.stdout || '').trim();
    const detail = stderr || stdout;
    fail(`git ${command} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout;
}

function gitInput(cwd, args, input) {
  const result = spawnGit(cwd, args, {
    encoding: null, input, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`git ${args[0]} failed: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = String(result.stderr || '').trim();
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

function dirtyPaths(cwd) {
  return [...new Set([...stagedPaths(cwd), ...unstagedPaths(cwd)])].sort();
}

function hashPart(hash, label, value) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  hash.update(`${label.length}:${label}:${data.length}:`);
  hash.update(data);
}

function fingerprintPathspec(excludedPrefixes = []) {
  if (excludedPrefixes.length === 0) return ['--'];
  return [
    '--', '.',
    ...excludedPrefixes.map((prefix) => `:(exclude)${prefix.replace(/\/$/, '')}/**`),
  ];
}

function dirtyFingerprint(cwd, excludedPrefixes = []) {
  const pathspec = fingerprintPathspec(excludedPrefixes);
  const hash = crypto.createHash('sha256');
  hashPart(hash, 'index', git(cwd, [
    'diff', '--cached', '--binary', '--no-ext-diff', '--no-renames', ...pathspec,
  ], null));
  hashPart(hash, 'worktree', git(cwd, [
    'diff', '--binary', '--no-ext-diff', '--no-renames', ...pathspec,
  ], null));
  const untracked = nullPaths(git(cwd, [
    'ls-files', '--others', '--exclude-standard', '-z', ...pathspec,
  ]));
  for (const filePath of untracked) {
    const absolute = path.join(cwd, ...filePath.split('/'));
    const stat = fs.lstatSync(absolute);
    hashPart(hash, 'untracked-path', filePath);
    hashPart(hash, 'untracked-mode', stat.mode);
    hashPart(hash, 'untracked-content', stat.isSymbolicLink()
      ? fs.readlinkSync(absolute, 'utf8')
      : fs.readFileSync(absolute));
  }
  return `sha256:${hash.digest('hex')}`;
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

function rangePaths(cwd, base, commit) {
  return nullPaths(git(cwd, [
    'diff', `${base}..${commit}`, '--name-only', '--no-ext-diff', '--no-renames', '-z', '--',
  ]));
}

function rangeFingerprint(cwd, base, commit, paths = []) {
  const args = [
    'diff', `${base}..${commit}`, '--binary', '--no-ext-diff', '--no-renames', '--', ...paths,
  ];
  const diff = git(cwd, args, null);
  return {
    diff,
    fingerprint: `sha256:${crypto.createHash('sha256').update(diff).digest('hex')}`,
  };
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
    git(cwd, diffCheckArgs(['--cached', '--check', '--']));
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

function transientDiagnostic(value, limit = 4096) {
  const normalized = String(value || '')
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
    .trim();
  if (!normalized) return null;
  if (normalized.length <= limit) return normalized;
  const marker = '\n... output omitted ...\n';
  const available = limit - marker.length;
  const head = Math.ceil(available / 2);
  return normalized.slice(0, head) + marker + normalized.slice(-(available - head));
}

function compactExecutions(executions) {
  return executions.map((item) => {
    const result = { id: item.id, passed: item.passed, skipped: item.skipped };
    if (!item.passed || item.skipped) {
      if (item.reason) result.reason = item.reason;
      if (item.evidence) result.evidence = item.evidence;
    }
    if (!item.passed) {
      const diagnostic = transientDiagnostic(item.output);
      if (diagnostic) result.diagnostic = diagnostic;
    }
    return result;
  });
}

function compactReview(evidence) {
  return {
    paths: evidence.paths,
    changes: evidence.changes,
    fingerprint: evidence.fingerprint,
  };
}

function captureDispatchDescriptor(tree, specRelative, controlFingerprint) {
  const directRoots = tree.nodes.filter((node) => node.parent_id === tree.spec_id);
  const rootOnly = directRoots.length === 0;
  const runnable = new Set([...tree.runnable_slices, ...tree.runnable_leaves]);
  const reviewReady = new Set(tree.review_ready);
  const target = (node) => ({
    id: node ? node.id : tree.spec_id,
    owner: node && !node.is_leaf ? 'slice-coordinator' : 'root-implementer',
    status: node ? node.status : tree.spec_status,
    boundary: path.posix.join(
      specRelative,
      node ? 'slices' : '',
      node ? `${node.id}.md` : 'SPEC.md',
    ),
    gate: path.posix.join(specRelative, 'gates', `${node ? node.id : tree.spec_id}.md`),
    mode: rootOnly ? 'root-only' : 'root-slice',
    finalization: rootOnly
      ? 'root-only'
      : directRoots.length === 1 ? 'single-root' : 'multi-root',
    runnable: node
      ? runnable.has(node.id)
      : tree.spec_status === 'ready' && !tree.root_gate_all_met,
    review_ready: node ? reviewReady.has(node.id) : tree.root_gate_all_met,
  });
  return {
    control_fingerprint: controlFingerprint,
    spec_id: tree.spec_id,
    spec_revision: tree.spec_revision,
    root_only: rootOnly,
    direct_root_count: directRoots.length,
    targets: rootOnly ? [target(null)] : directRoots.map(target),
  };
}

function captureAction(tree, descriptor, overlap) {
  if (tree.spec_status !== 'ready') {
    const terminal = ['completed', 'cancelled', 'superseded'].includes(tree.spec_status);
    return {
      action: terminal ? 'terminal' : 'not_ready',
      reason: `${tree.spec_id} status is ${tree.spec_status}, expected ready`,
    };
  }
  if (tree.execution_stopped) {
    return { action: 'stopped', reason: 'ABANDON stopped execution' };
  }
  if (overlap.length > 0) {
    return { action: 'need_confirm', reason: 'destination changes overlap executable scope' };
  }
  if (descriptor.targets.some((target) => target.runnable)) {
    return { action: 'dispatch', reason: null };
  }
  const readyForReview = descriptor.targets
    .filter((target) => target.review_ready)
    .map((target) => target.id);
  if (readyForReview.length > 0) {
    return {
      action: 'review_recovery_required',
      reason: `review-ready state requires its existing reviewed Worktree owner: ${readyForReview.join(', ')}`,
    };
  }
  const completed = descriptor.targets
    .filter((target) => target.status === 'completed')
    .map((target) => target.id);
  if (completed.length === descriptor.targets.length && completed.length > 0) {
    return {
      action: 'finalization_recovery_required',
      reason: 'completed Root state requires its existing integration owner',
    };
  }
  return { action: 'blocked', reason: 'ready Spec has no runnable Root target' };
}

function captureDestination(options) {
  options = resolveOptions(options);
  const actualRoot = path.resolve(String(git(options.cwd, ['rev-parse', '--show-toplevel'])).trim());
  if (actualRoot.toLowerCase() !== options.cwd.toLowerCase()) fail('--cwd must be the checkout root');
  const control = controlManifest(options.spec);
  const tree = control.tree;
  if (options.node !== tree.spec_id) fail('capture requires the root Spec ID');
  const specRelative = specRelativePath(options.cwd, options.spec);
  const controlPrefix = relativeControlPrefix(options.cwd, options.spec);
  const productPaths = withoutControl(dirtyPaths(options.cwd), controlPrefix);
  const rootOnly = tree.nodes.length === 0;
  const scopes = leafScopes(tree.nodes);
  const overlap = rootOnly
    ? productPaths
    : productPaths.filter((filePath) => inScopes(filePath, scopes));
  const descriptor = captureDispatchDescriptor(tree, specRelative, control.full_fingerprint);
  const next = captureAction(tree, descriptor, overlap);
  return {
    ok: next.action === 'dispatch',
    action: next.action,
    reason: next.reason,
    head: String(git(options.cwd, ['rev-parse', 'HEAD'])).trim(),
    destination_fingerprint: dirtyFingerprint(options.cwd, [controlPrefix]),
    control_fingerprint: control.full_fingerprint,
    spec: specRelative,
    dispatch: next.action === 'dispatch' ? descriptor : null,
    dirty_paths: productPaths,
    overlap,
  };
}

function statusReplacement(filePath, expected, next) {
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
  return { filePath, original, rendered };
}

function replaceStatus(filePath, expected, next) {
  const replacement = statusReplacement(filePath, expected, next);
  fs.writeFileSync(filePath, replacement.rendered, 'utf8');
  return () => fs.writeFileSync(filePath, replacement.original, 'utf8');
}

function completeBoundary(options) {
  const specDirectory = path.resolve(options.cwd, options.spec);
  const filePath = options.mode === 'root-only'
    ? path.join(specDirectory, 'SPEC.md')
    : path.join(specDirectory, 'slices', `${options.node}.md`);
  return replaceStatus(filePath, options.mode === 'root-only' ? 'ready' : 'pending', 'completed');
}

function restoreBoundaryReplacements(replacements) {
  let rollbackError = null;
  for (const replacement of [...replacements].reverse()) {
    try {
      fs.writeFileSync(replacement.filePath, replacement.original, 'utf8');
    } catch (current) {
      rollbackError ||= current;
    }
  }
  if (rollbackError) fail(`cannot roll back Leaf batch status: ${rollbackError.message}`);
}

function completeBoundariesAtomically(specDirectory, nodeIds, writeFile = fs.writeFileSync) {
  const replacements = nodeIds.map((nodeId) => statusReplacement(
    path.join(path.resolve(specDirectory), 'slices', `${nodeId}.md`),
    'pending',
    'completed',
  ));
  const attempted = [];
  try {
    for (const replacement of replacements) {
      attempted.push(replacement);
      writeFile(replacement.filePath, replacement.rendered, 'utf8');
    }
    inspectExecutionTree(specDirectory);
  } catch (error) {
    try {
      restoreBoundaryReplacements(attempted);
    } catch (rollbackError) {
      fail(`${error.message}; ${rollbackError.message}`);
    }
    throw error;
  }
  return () => restoreBoundaryReplacements(replacements);
}

function leafReady(tree, node, byId) {
  let current = node;
  while (current) {
    if (current.status !== 'pending') return false;
    const dependencies = [...current.blocked_by, ...current.run_after];
    if (dependencies.some((id) => byId.get(id)?.status !== 'completed')) return false;
    current = current.parent_id === tree.spec_id ? null : byId.get(current.parent_id);
  }
  return true;
}

function scopesOverlap(first, second) {
  const left = first.endsWith('/') ? first.slice(0, -1) : first;
  const right = second.endsWith('/') ? second.slice(0, -1) : second;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function overlappingCompletedBoundaries(tree, nodes) {
  const requestedScopes = nodes.flatMap((node) => node.write_scope);
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  const leaves = tree.nodes
    .filter((node) => node.is_leaf && node.status === 'completed')
    .filter((node) => node.write_scope.some((scope) =>
      requestedScopes.some((requestedScope) => scopesOverlap(scope, requestedScope))))
    .sort((first, second) => first.id.localeCompare(second.id));
  const result = [];
  const seen = new Set();
  for (const leaf of leaves) {
    let current = leaf;
    while (current && current.status === 'completed') {
      if (!seen.has(current.id)) {
        seen.add(current.id);
        result.push(current.id);
      }
      current = current.parent_id === tree.spec_id ? null : byId.get(current.parent_id);
    }
  }
  return result;
}

function batchExecutions(executions) {
  return compactExecutions(executions).map((execution, index) => ({
    node: path.basename(executions[index].filePath, '.md'),
    ...execution,
  }));
}

function productSnapshotFingerprint(options) {
  const controlPrefix = relativeControlPrefix(options.cwd, options.spec);
  return dirtyFingerprint(options.cwd, [controlPrefix]);
}

function snapshotChanged(expected, actual) {
  return {
    ok: false,
    action: 'environment_blocked',
    completed: [],
    error: `product snapshot changed during close-batch: expected ${expected}, actual ${actual}`,
  };
}

function captureGateDocuments(specDirectory, nodeIds) {
  return nodeIds.map((nodeId) => {
    const filePath = gatePath(specDirectory, nodeId);
    return { filePath, contents: fs.readFileSync(filePath, 'utf8') };
  });
}

function restoreGateDocuments(documents) {
  for (const document of documents) {
    fs.writeFileSync(document.filePath, document.contents, 'utf8');
  }
}

function closeBatch(options, runtime = {}) {
  options = resolveOptions(options);
  const tree = inspectExecutionTree(options.spec);
  if (tree.spec_status !== 'ready') {
    fail(`close-batch requires Spec status ready, found ${tree.spec_status}`);
  }
  if (tree.execution_stopped) {
    fail(`close-batch cannot run after ABANDON stopped execution: ${tree.abandoned_ids.join(', ')}`);
  }
  const ids = [...options.nodes];
  if (new Set(ids).size !== ids.length) fail('close-batch Leaf IDs must be distinct');

  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  const nodes = ids.map((id) => {
    const node = byId.get(id);
    if (!node) fail(`unknown node: ${id}`);
    if (!node.is_leaf) fail(`close-batch requires Leaf Nodes: ${id}`);
    return node;
  });
  const parentId = nodes[0].parent_id;
  if (nodes.some((node) => node.parent_id !== parentId)) {
    fail('close-batch Leaf Nodes must share one direct parent');
  }

  const ready = tree.nodes
    .filter((node) => node.parent_id === parentId && node.is_leaf)
    .filter((node) => leafReady(tree, node, byId))
    .map((node) => node.id)
    .sort();
  const requested = [...ids].sort();
  const missing = ready.filter((id) => !requested.includes(id));
  const unavailable = requested.filter((id) => !ready.includes(id));
  if (missing.length > 0 || unavailable.length > 0) {
    const details = [];
    if (missing.length > 0) details.push(`missing ready siblings: ${missing.join(', ')}`);
    if (unavailable.length > 0) details.push(`not ready: ${unavailable.join(', ')}`);
    fail(`close-batch requires the complete ready Leaf cohort under ${parentId}: ${details.join('; ')}`);
  }

  const blocking = [];
  for (const id of requested) {
    const state = inspectState({ ...options, node: id });
    const errors = state.errors.filter((error) => error !== 'gate-unmet');
    if (errors.length > 0) blocking.push({ node: id, state, errors });
  }
  if (blocking.length > 0) {
    return {
      ok: false,
      action: 'repair',
      completed: [],
      failures: blocking.map((item) => ({ node: item.node, reasons: item.errors })),
    };
  }

  const fingerprint = runtime.productFingerprint || productSnapshotFingerprint;
  const expectedSnapshot = fingerprint(options);
  const revalidated = overlappingCompletedBoundaries(tree, nodes);
  const gateNodes = [...new Set([...revalidated, ...requested])];
  const revalidatedDocuments = captureGateDocuments(options.spec, revalidated);
  let gate;
  try {
    const gateRunner = runtime.runGateFiles || runGateFiles;
    gate = gateRunner(gateNodes.map((id) => gatePath(options.spec, id)), {
      cwd: options.cwd,
    });
  } catch (error) {
    if (error instanceof GateParseError || error instanceof GateUsageError) {
      restoreGateDocuments(revalidatedDocuments);
      return { ok: false, action: 'environment_blocked', completed: [], error: error.message };
    }
    throw error;
  }
  const afterGates = fingerprint(options);
  if (afterGates !== expectedSnapshot) {
    restoreGateDocuments(revalidatedDocuments);
    return snapshotChanged(expectedSnapshot, afterGates);
  }
  const gates = batchExecutions(gate.executions);
  if (!gate.status.allMet) {
    const failedNodes = [...new Set(
      gates.filter((item) => !item.passed).map((item) => item.node),
    )];
    restoreGateDocuments(revalidatedDocuments);
    return {
      ok: false,
      action: 'repair',
      completed: [],
      failures: failedNodes.map((node) => ({ node, reasons: ['gate-failed'] })),
      gates,
      revalidated,
    };
  }

  const beforeStatus = fingerprint(options);
  if (beforeStatus !== expectedSnapshot) {
    restoreGateDocuments(revalidatedDocuments);
    return snapshotChanged(expectedSnapshot, beforeStatus);
  }
  let restoreStatuses;
  try {
    restoreStatuses = completeBoundariesAtomically(options.spec, requested);
  } catch (error) {
    if (error && ['EACCES', 'EPERM'].includes(error.code)) {
      return { ok: false, action: 'environment_blocked', completed: [], error: error.message };
    }
    throw error;
  }
  const afterStatus = fingerprint(options);
  if (afterStatus !== expectedSnapshot) {
    restoreStatuses();
    restoreGateDocuments(revalidatedDocuments);
    return snapshotChanged(expectedSnapshot, afterStatus);
  }
  const after = inspectExecutionTree(options.spec);
  return {
    ok: true,
    action: 'continue',
    completed: requested,
    gates,
    revalidated,
    next: {
      leaves: after.runnable_leaves,
      branches: after.completable_branches,
      review: after.review_ready,
    },
  };
}

function closeBoundary(options) {
  options = resolveOptions(options);
  const before = inspectState(options);
  const blocking = before.errors.filter((error) => error !== 'gate-unmet');
  if (blocking.length > 0) {
    return { ok: false, action: 'repair', state: before, errors: blocking };
  }

  let gate;
  try {
    gate = runGateFiles([gatePath(options.spec, options.node)], { cwd: options.cwd });
  } catch (error) {
    if (error instanceof GateParseError || error instanceof GateUsageError) {
      return {
        ok: false,
        action: 'environment_blocked',
        error: error.message,
      };
    }
    throw error;
  }
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
    return {
      ok: state.ok,
      action: 'callback',
      node: state.node,
      status: state.status,
      gates: compactExecutions(gate.executions),
      next: state.next,
    };
  }

  const paths = state.paths.root;
  if (paths.length === 0) fail('review boundary has no staged product paths');
  return {
    ok: true,
    action: 'review',
    node: state.node,
    gates: compactExecutions(gate.executions),
    review_snapshot: compactReview(snapshot(path.resolve(options.cwd), paths)),
  };
}

function reviewPass(options) {
  options = resolveOptions(options);
  const before = inspectState(options);
  if (!before.ok) return { ok: false, action: 'repair', state: before, errors: before.errors };
  const reviewed = verify(path.resolve(options.cwd), options.fingerprint);
  const restore = options.mode === 'root-only' ? null : completeBoundary(options);
  try {
    git(path.resolve(options.cwd), ['commit', '-m', options.message, '--']);
  } catch (error) {
    if (restore) restore();
    throw error;
  }
  const commit = String(git(path.resolve(options.cwd), ['rev-parse', 'HEAD'])).trim();
  const state = inspectState({ ...options, commit });
  return {
    ok: state.ok,
    action: 'callback',
    state: 'reviewed',
    node: state.node,
    commit,
    paths: reviewed.paths,
    gates: state.gates,
    next: state.next,
  };
}

function finalizationContext(options) {
  const cwd = path.resolve(options.cwd);
  const actualRoot = path.resolve(String(git(cwd, ['rev-parse', '--show-toplevel'])).trim());
  if (actualRoot.toLowerCase() !== cwd.toLowerCase()) fail('--cwd must be the Worktree root');
  const tree = inspectExecutionTree(options.spec);
  if (options.node !== tree.spec_id) fail('finalization requires the root Spec ID');
  if (tree.nodes.length === 0) fail('root-only Specs complete through review-pass');
  const directRoots = tree.nodes.filter((node) => node.parent_id === tree.spec_id);
  if (options.action === 'finalize') {
    if (options.mode === 'single-root' && directRoots.length !== 1) {
      fail(`single-root finalization requires exactly one direct Root Slice, found ${directRoots.length}`);
    }
    if (options.mode === 'multi-root' && directRoots.length < 2) {
      fail(`multi-root finalization requires at least two direct Root Slices, found ${directRoots.length}`);
    }
  } else if (directRoots.length < 2) {
    fail(`finalize-review-pass requires at least two direct Root Slices, found ${directRoots.length}`);
  }
  if (tree.spec_status !== 'ready') {
    fail(`${tree.spec_id} status is ${tree.spec_status}, expected ready until final apply`);
  }
  const controlPrefix = relativeControlPrefix(cwd, options.spec);
  return {
    cwd,
    tree,
    directRoots,
    controlPrefix,
    productDirty: withoutControl(dirtyPaths(cwd), controlPrefix),
  };
}

function incompleteExecution(tree) {
  return tree.nodes
    .filter((node) => node.status !== 'completed' || !node.gates_all_met)
    .map((node) => node.id);
}

function finalRange(context, base, expectedCommit = null) {
  const resolvedBase = String(
    git(context.cwd, ['rev-parse', '--verify', `${base}^{commit}`]),
  ).trim();
  git(context.cwd, ['merge-base', '--is-ancestor', resolvedBase, 'HEAD']);
  const head = String(git(context.cwd, ['rev-parse', 'HEAD'])).trim();
  if (expectedCommit) {
    const resolvedCommit = String(
      git(context.cwd, ['rev-parse', '--verify', `${expectedCommit}^{commit}`]),
    ).trim();
    if (head !== resolvedCommit) {
      fail(`Worktree HEAD changed: expected ${resolvedCommit}, actual ${head}`);
    }
  }
  const evidence = snapshotRange(context.cwd, resolvedBase);
  const scopes = leafScopes(context.tree.nodes);
  const outside = evidence.paths.filter((filePath) => !inScopes(filePath, scopes));
  return { evidence, outside };
}

function finalizeSpec(options) {
  options = resolveOptions(options);
  let context = finalizationContext(options);
  const incomplete = incompleteExecution(context.tree);
  if (incomplete.length > 0 || context.productDirty.length > 0) {
    const errors = [];
    if (incomplete.length > 0) errors.push('node-incomplete');
    if (context.productDirty.length > 0) errors.push('product-state-dirty');
    return {
      ok: false,
      action: 'repair',
      errors,
      nodes: incomplete,
      paths: context.productDirty,
    };
  }

  const range = finalRange(context, options.base);
  if (range.outside.length > 0) {
    return {
      ok: false,
      action: 'repair',
      errors: ['range-outside-spec-scope'],
      paths: range.outside,
    };
  }
  if (options.mode === 'single-root'
    && range.evidence.fingerprint !== options.fingerprint) {
    return {
      ok: false,
      action: 'review_required',
      errors: ['root-review-range-mismatch'],
    };
  }

  let gate = { executions: [] };
  if (!context.tree.root_gate_all_met) {
    try {
      gate = runGateFiles([gatePath(options.spec, context.tree.spec_id)], {
        cwd: context.cwd,
        requiredPaths: range.evidence.paths,
      });
    } catch (error) {
      if (error instanceof GateParseError || error instanceof GateUsageError) {
        return { ok: false, action: 'environment_blocked', error: error.message };
      }
      throw error;
    }
  }
  context = finalizationContext(options);
  const afterGateIncomplete = incompleteExecution(context.tree);
  if (!context.tree.root_gate_all_met || afterGateIncomplete.length > 0
    || context.productDirty.length > 0) {
    return {
      ok: false,
      action: 'repair',
      errors: [
        ...(!context.tree.root_gate_all_met ? ['root-gate-unmet'] : []),
        ...(afterGateIncomplete.length > 0 ? ['node-incomplete'] : []),
        ...(context.productDirty.length > 0 ? ['product-state-dirty'] : []),
      ],
      nodes: afterGateIncomplete,
      paths: context.productDirty,
      gates: compactExecutions(gate.executions),
    };
  }
  if (options.mode === 'multi-root') {
    return {
      ok: true,
      action: 'review',
      node: context.tree.spec_id,
      commit: range.evidence.head,
      gates: compactExecutions(gate.executions),
      review_snapshot: compactReview(range.evidence),
    };
  }

  return {
    ok: true,
    action: 'callback',
    state: 'reviewed',
    node: context.tree.spec_id,
    commit: range.evidence.head,
    gates: compactExecutions(gate.executions),
  };
}

function finalizeReviewPass(options) {
  options = resolveOptions(options);
  const context = finalizationContext(options);
  const incomplete = incompleteExecution(context.tree);
  const errors = [];
  if (!context.tree.root_gate_all_met) errors.push('root-gate-unmet');
  if (incomplete.length > 0) errors.push('node-incomplete');
  if (context.productDirty.length > 0) errors.push('product-state-dirty');
  if (errors.length > 0) {
    return {
      ok: false,
      action: 'repair',
      errors,
      nodes: incomplete,
      paths: context.productDirty,
    };
  }
  const range = finalRange(context, options.base, options.commit);
  if (range.outside.length > 0) {
    return {
      ok: false,
      action: 'repair',
      errors: ['range-outside-spec-scope'],
      paths: range.outside,
    };
  }
  const reviewed = verifyRange(context.cwd, options.base, options.fingerprint);
  if (reviewed.head !== range.evidence.head) fail('reviewed range HEAD changed');
  return {
    ok: true,
    action: 'callback',
    state: 'reviewed',
    node: context.tree.spec_id,
    commit: reviewed.head,
  };
}

function rollbackApplied(cwd, patch, expectedFingerprint, controlPrefix) {
  gitInput(cwd, ['apply', '--index', '--reverse', '--binary', '--whitespace=nowarn', '-'], patch);
  const actual = dirtyFingerprint(cwd, [controlPrefix]);
  if (actual !== expectedFingerprint) {
    fail(`reviewed patch rollback changed destination state: expected ${expectedFingerprint}, actual ${actual}`);
  }
}

function rollbackWorking(cwd, patch, expectedFingerprint, controlPrefix) {
  gitInput(cwd, ['apply', '--reverse', '--binary', '--whitespace=nowarn', '-'], patch);
  const actual = dirtyFingerprint(cwd, [controlPrefix]);
  if (actual !== expectedFingerprint) {
    fail(`reviewed patch rollback changed destination state: expected ${expectedFingerprint}, actual ${actual}`);
  }
}

function applyReviewed(options) {
  options = resolveOptions(options);
  const destinationRoot = path.resolve(String(
    git(options.cwd, ['rev-parse', '--show-toplevel']),
  ).trim());
  const sourceRoot = path.resolve(String(
    git(options.source, ['rev-parse', '--show-toplevel']),
  ).trim());
  if (destinationRoot.toLowerCase() !== options.cwd.toLowerCase()) {
    fail('--cwd must be the destination checkout root');
  }
  if (sourceRoot.toLowerCase() !== options.source.toLowerCase()) {
    fail('--source must be the reviewed Worktree root');
  }

  const base = String(git(options.cwd, ['rev-parse', '--verify', `${options.base}^{commit}`])).trim();
  const destinationHead = String(git(options.cwd, ['rev-parse', 'HEAD'])).trim();
  if (destinationHead !== base) {
    fail(`destination HEAD changed: expected ${base}, actual ${destinationHead}`);
  }
  const sourceCommit = String(
    git(options.source, ['rev-parse', '--verify', `${options.commit}^{commit}`]),
  ).trim();
  const sourceHead = String(git(options.source, ['rev-parse', 'HEAD'])).trim();
  if (sourceHead !== sourceCommit) {
    fail(`source HEAD ${sourceHead} does not match reviewed commit ${sourceCommit}`);
  }
  git(options.source, ['merge-base', '--is-ancestor', base, sourceCommit]);

  const specRelative = specRelativePath(options.source, options.spec);
  const destinationSpec = path.resolve(options.cwd, ...specRelative.split('/'));
  const destinationControlPrefix = relativeControlPrefix(options.cwd, destinationSpec);
  const currentDestinationFingerprint = dirtyFingerprint(options.cwd, [destinationControlPrefix]);
  if (currentDestinationFingerprint !== options.destinationFingerprint) {
    fail(`destination state changed: expected ${options.destinationFingerprint}, actual ${currentDestinationFingerprint}`);
  }

  const controlPrefix = relativeControlPrefix(options.source, options.spec);
  const paths = withoutControl(rangePaths(options.source, base, sourceCommit), controlPrefix);
  if (paths.length === 0) fail('reviewed range has no product paths');
  const tree = inspectExecutionTree(options.spec);
  if (options.node !== tree.spec_id) fail('apply-reviewed requires the root Spec ID');
  if (tree.spec_status !== 'ready') {
    fail(`reviewed source ${tree.spec_id} status is ${tree.spec_status}, expected ready`);
  }
  if (tree.nodes.length > 0) {
    const scopes = leafScopes(tree.nodes);
    const outside = paths.filter((filePath) => !inScopes(filePath, scopes));
    if (outside.length > 0) fail(`reviewed paths outside root scope: ${outside.join(', ')}`);
  }
  const incomplete = incompleteExecution(tree);
  if (!tree.root_gate_all_met || incomplete.length > 0) {
    const details = [];
    if (!tree.root_gate_all_met) details.push('root Gate is unmet');
    if (incomplete.length > 0) details.push(`incomplete Nodes: ${incomplete.join(', ')}`);
    fail(`reviewed source control state is incomplete: ${details.join('; ')}`);
  }
  const controlPlan = planControlMerge(
    options.spec,
    destinationSpec,
    options.controlFingerprint,
    { completeSpec: true },
  );
  const sourceRange = rangeFingerprint(options.source, base, sourceCommit, paths);
  if (options.fingerprint && sourceRange.fingerprint !== options.fingerprint) {
    fail(`reviewed range fingerprint changed: expected ${options.fingerprint}, actual ${sourceRange.fingerprint}`);
  }
  const reviewedFingerprint = sourceRange.fingerprint;

  const overlap = dirtyPaths(options.cwd).filter((filePath) => paths.includes(filePath));
  if (overlap.length > 0) fail(`destination overlaps reviewed paths: ${overlap.join(', ')}`);

  let phase = 'baseline';
  let restoreControl = null;
  let finalDestinationFingerprint = null;
  try {
    gitInput(options.cwd, ['apply', '--check', '--index', '--binary', '--whitespace=nowarn', '-'], sourceRange.diff);
    gitInput(options.cwd, ['apply', '--index', '--binary', '--whitespace=nowarn', '-'], sourceRange.diff);
    phase = 'staged';
    const destinationDiff = git(options.cwd, [
      'diff', '--cached', '--binary', '--no-ext-diff', '--no-renames', '--', ...paths,
    ], null);
    const appliedFingerprint = `sha256:${crypto.createHash('sha256').update(destinationDiff).digest('hex')}`;
    if (appliedFingerprint !== reviewedFingerprint) {
      fail(`applied fingerprint differs: expected ${reviewedFingerprint}, actual ${appliedFingerprint}`);
    }
    git(options.cwd, diffCheckArgs(['--cached', '--check', '--', ...paths]));
    git(options.cwd, ['restore', '--staged', '--', ...paths]);
    phase = 'worktree';
    const appliedPaths = dirtyPaths(options.cwd).filter((filePath) => paths.includes(filePath));
    if (appliedPaths.length !== paths.length) {
      fail(`applied paths differ: expected [${paths.join(', ')}], actual [${appliedPaths.join(', ')}]`);
    }
    restoreControl = commitControlMerge(controlPlan);
    phase = 'control';
    inspectExecutionTree(destinationSpec);
    finalDestinationFingerprint = dirtyFingerprint(options.cwd, [destinationControlPrefix]);
  } catch (error) {
    if (restoreControl) restoreControl();
    if (phase === 'staged') {
      rollbackApplied(
        options.cwd, sourceRange.diff, options.destinationFingerprint, destinationControlPrefix,
      );
    } else if (phase === 'worktree' || phase === 'control') {
      rollbackWorking(
        options.cwd, sourceRange.diff, options.destinationFingerprint, destinationControlPrefix,
      );
    }
    throw error;
  }
  return {
    ok: true,
    action: 'complete',
    head: destinationHead,
    commit: sourceCommit,
    fingerprint: reviewedFingerprint,
    paths,
    destination_fingerprint: finalDestinationFingerprint,
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = resolveOptions(parseArgs(argv));
    const output = options.action === 'capture'
      ? captureDestination(options)
      : options.action === 'close'
        ? closeBoundary(options)
        : options.action === 'close-batch'
          ? closeBatch(options)
        : options.action === 'review-pass'
          ? reviewPass(options)
          : options.action === 'finalize'
            ? finalizeSpec(options)
            : options.action === 'finalize-review-pass'
              ? finalizeReviewPass(options)
          : options.action === 'apply-reviewed'
            ? applyReviewed(options)
            : inspectState(options);
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return output.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof CoordinatorStateError || error instanceof ControlStateError
      || error instanceof ExecutionTreeError || error instanceof GateParseError
      || error instanceof PrepareReviewError
      || error instanceof GateUsageError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  applyReviewed,
  captureDestination,
  closeBatch,
  CoordinatorStateError,
  closeBoundary,
  completeBoundariesAtomically,
  finalizeReviewPass,
  finalizeSpec,
  inspectState,
  main,
  parseArgs,
  resolveOptions,
  reviewPass,
  scopeContains,
};
