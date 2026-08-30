#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const USAGE = [
  'Usage:',
  '  prepare-review.js stage --cwd <checkout> --path <path> [--path <path>...]',
  '  prepare-review.js snapshot --cwd <checkout> --path <path> [--path <path>...]',
  '  prepare-review.js verify --cwd <checkout> --fingerprint <sha256:...>',
  '  prepare-review.js snapshot-range --cwd <checkout> --base <commit>',
  '  prepare-review.js verify-range --cwd <checkout> --base <commit> --fingerprint <sha256:...>',
  '  prepare-review.js unstage --cwd <checkout> --path <path> [--path <path>...]',
].join('\n');

class PrepareReviewError extends Error {}

function fail(message) {
  throw new PrepareReviewError(message);
}

function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (!['stage', 'snapshot', 'verify', 'snapshot-range', 'verify-range', 'unstage'].includes(action)) fail(USAGE);
  const result = { action, cwd: null, paths: [], fingerprint: null, base: null };
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (value === undefined) fail(USAGE);
    if (name === '--cwd' && result.cwd === null) result.cwd = value;
    else if (name === '--path') result.paths.push(value);
    else if (name === '--fingerprint' && result.fingerprint === null) result.fingerprint = value;
    else if (name === '--base' && result.base === null) result.base = value;
    else fail(USAGE);
  }
  if (!result.cwd) fail(USAGE);
  if ((action === 'stage' || action === 'snapshot' || action === 'unstage')
    && result.paths.length === 0) fail(USAGE);
  if ((action === 'verify' || action === 'verify-range') && !result.fingerprint) fail(USAGE);
  if ((action === 'snapshot-range' || action === 'verify-range') && !result.base) fail(USAGE);
  return result;
}

function normalizePaths(values) {
  const paths = values.map((value) => {
    if (!value || value.trim() !== value || value.includes('\\') || path.posix.isAbsolute(value)
      || /^[A-Za-z]:/.test(value)) {
      fail(`invalid project-relative path: ${value}`);
    }
    const normalized = path.posix.normalize(value);
    if (normalized !== value || normalized === '.' || normalized.startsWith('../')
      || /[\0\r\n*?\[\]{}]/.test(value)) {
      fail(`invalid project-relative path: ${value}`);
    }
    return value;
  });
  if (new Set(paths).size !== paths.length) fail('duplicate --path value');
  return paths.sort();
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

function stagedPaths(cwd) {
  const output = git(cwd, ['diff', '--cached', '--name-only', '--no-renames', '-z', '--']);
  return output.split('\0').filter(Boolean).sort();
}

function rangeArgs(base, head = 'HEAD') {
  return base ? [`${base}..${head}`] : ['--cached'];
}

function fingerprint(cwd, base = null, head = 'HEAD') {
  const diff = git(
    cwd,
    ['diff', ...rangeArgs(base, head), '--binary', '--no-ext-diff', '--no-renames', '--'],
    null,
  );
  return `sha256:${crypto.createHash('sha256').update(diff).digest('hex')}`;
}

function changeSummary(cwd, base = null, head = 'HEAD') {
  const output = git(cwd, [
    'diff', ...rangeArgs(base, head), '--numstat', '--no-ext-diff', '--no-renames', '-z', '--',
  ]);
  return output.split('\0').filter(Boolean).map((record) => {
    const first = record.indexOf('\t');
    const second = first < 0 ? -1 : record.indexOf('\t', first + 1);
    if (first < 0 || second < 0) fail('git diff --numstat returned an invalid record');
    const added = record.slice(0, first);
    const deleted = record.slice(first + 1, second);
    return {
      path: record.slice(second + 1).replaceAll('\\', '/'),
      added: added === '-' ? null : Number(added),
      deleted: deleted === '-' ? null : Number(deleted),
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function reviewCommand(paths, base = null, head = 'HEAD') {
  return [
    'git', 'diff', ...rangeArgs(base, head), '--unified=3', '--no-ext-diff', '--no-renames', '--',
    ...paths,
  ];
}

function reviewEvidence(cwd, paths, base = null, head = 'HEAD') {
  return {
    paths,
    changes: changeSummary(cwd, base, head),
    fingerprint: fingerprint(cwd, base, head),
    review_command: reviewCommand(paths, base, head),
  };
}

function samePaths(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function restoreStaged(cwd, paths) {
  git(cwd, ['restore', '--staged', '--', ...paths]);
}

function stage(cwd, paths) {
  const existing = stagedPaths(cwd);
  if (existing.length > 0) fail(`index is not empty: ${existing.join(', ')}`);
  try {
    git(cwd, ['add', '--', ...paths]);
    const actual = stagedPaths(cwd);
    if (!samePaths(actual, paths)) {
      fail(`staged paths differ: expected [${paths.join(', ')}], actual [${actual.join(', ')}]`);
    }
    git(cwd, ['diff', '--cached', '--check', '--']);
    return reviewEvidence(cwd, actual);
  } catch (error) {
    try {
      const actual = stagedPaths(cwd);
      if (actual.length > 0) restoreStaged(cwd, actual);
    } catch {}
    throw error;
  }
}

function snapshot(cwd, paths) {
  const actual = stagedPaths(cwd);
  if (!samePaths(actual, paths)) {
    fail(`staged paths differ: expected [${paths.join(', ')}], actual [${actual.join(', ')}]`);
  }
  git(cwd, ['diff', '--cached', '--check', '--']);
  return reviewEvidence(cwd, actual);
}

function verify(cwd, expected) {
  const paths = stagedPaths(cwd);
  const actual = fingerprint(cwd);
  if (actual !== expected) fail(`staged fingerprint changed: expected ${expected}, actual ${actual}`);
  return reviewEvidence(cwd, paths);
}

function resolveBase(cwd, value) {
  if (!/^[0-9a-fA-F]{7,64}$/.test(value)) fail('invalid --base');
  return String(git(cwd, ['rev-parse', '--verify', `${value}^{commit}`])).trim();
}

function rangePaths(cwd, base, head = 'HEAD') {
  const output = git(cwd, [
    'diff', `${base}..${head}`, '--name-only', '--no-ext-diff', '--no-renames', '-z', '--',
  ]);
  return output.split('\0').filter(Boolean).map((value) => value.replaceAll('\\', '/')).sort();
}

function snapshotRange(cwd, value) {
  const base = resolveBase(cwd, value);
  git(cwd, ['merge-base', '--is-ancestor', base, 'HEAD']);
  const staged = stagedPaths(cwd);
  if (staged.length > 0) fail(`index is not empty: ${staged.join(', ')}`);
  const head = String(git(cwd, ['rev-parse', 'HEAD'])).trim();
  const paths = rangePaths(cwd, base, head);
  if (paths.length === 0) fail('review range has no changed paths');
  git(cwd, ['diff', `${base}..${head}`, '--check', '--']);
  return { base, head, ...reviewEvidence(cwd, paths, base, head) };
}

function verifyRange(cwd, value, expected) {
  const evidence = snapshotRange(cwd, value);
  if (evidence.fingerprint !== expected) {
    fail(`range fingerprint changed: expected ${expected}, actual ${evidence.fingerprint}`);
  }
  return evidence;
}

function unstage(cwd, paths) {
  restoreStaged(cwd, paths);
  const remaining = stagedPaths(cwd);
  if (remaining.length > 0) fail(`index still contains: ${remaining.join(', ')}`);
  return { paths: [], changes: [], fingerprint: fingerprint(cwd), review_command: reviewCommand([]) };
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const cwd = path.resolve(options.cwd);
    git(cwd, ['rev-parse', '--show-toplevel']);
    const paths = normalizePaths(options.paths);
    const output = options.action === 'stage'
      ? stage(cwd, paths)
      : options.action === 'snapshot'
        ? snapshot(cwd, paths)
      : options.action === 'verify'
        ? verify(cwd, options.fingerprint)
      : options.action === 'snapshot-range'
        ? snapshotRange(cwd, options.base)
      : options.action === 'verify-range'
        ? verifyRange(cwd, options.base, options.fingerprint)
        : unstage(cwd, paths);
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof PrepareReviewError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  PrepareReviewError,
  changeSummary,
  fingerprint,
  main,
  normalizePaths,
  rangePaths,
  reviewCommand,
  snapshot,
  snapshotRange,
  stagedPaths,
  verify,
  verifyRange,
};
