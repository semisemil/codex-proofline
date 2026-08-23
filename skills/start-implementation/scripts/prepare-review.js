#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const USAGE = [
  'Usage:',
  '  prepare-review.js stage --cwd <checkout> --path <path> [--path <path>...]',
  '  prepare-review.js verify --cwd <checkout> --fingerprint <sha256:...>',
  '  prepare-review.js unstage --cwd <checkout> --path <path> [--path <path>...]',
].join('\n');

class PrepareReviewError extends Error {}

function fail(message) {
  throw new PrepareReviewError(message);
}

function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (!['stage', 'verify', 'unstage'].includes(action)) fail(USAGE);
  const result = { action, cwd: null, paths: [], fingerprint: null };
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (value === undefined) fail(USAGE);
    if (name === '--cwd' && result.cwd === null) result.cwd = value;
    else if (name === '--path') result.paths.push(value);
    else if (name === '--fingerprint' && result.fingerprint === null) result.fingerprint = value;
    else fail(USAGE);
  }
  if (!result.cwd) fail(USAGE);
  if ((action === 'stage' || action === 'unstage') && result.paths.length === 0) fail(USAGE);
  if (action === 'verify' && !result.fingerprint) fail(USAGE);
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

function fingerprint(cwd) {
  const diff = git(
    cwd,
    ['diff', '--cached', '--binary', '--no-ext-diff', '--no-renames', '--'],
    null,
  );
  return `sha256:${crypto.createHash('sha256').update(diff).digest('hex')}`;
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
    return { paths: actual, fingerprint: fingerprint(cwd) };
  } catch (error) {
    try {
      const actual = stagedPaths(cwd);
      if (actual.length > 0) restoreStaged(cwd, actual);
    } catch {}
    throw error;
  }
}

function verify(cwd, expected) {
  const paths = stagedPaths(cwd);
  const actual = fingerprint(cwd);
  if (actual !== expected) fail(`staged fingerprint changed: expected ${expected}, actual ${actual}`);
  return { paths, fingerprint: actual };
}

function unstage(cwd, paths) {
  restoreStaged(cwd, paths);
  const remaining = stagedPaths(cwd);
  if (remaining.length > 0) fail(`index still contains: ${remaining.join(', ')}`);
  return { paths: [], fingerprint: fingerprint(cwd) };
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const cwd = path.resolve(options.cwd);
    git(cwd, ['rev-parse', '--show-toplevel']);
    const paths = normalizePaths(options.paths);
    const output = options.action === 'stage'
      ? stage(cwd, paths)
      : options.action === 'verify'
        ? verify(cwd, options.fingerprint)
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

module.exports = { PrepareReviewError, fingerprint, main, normalizePaths, stagedPaths };
