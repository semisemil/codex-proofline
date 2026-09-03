#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { gitCommandName, spawnGit } = require('../../../lib/git-policy.js');

const USAGE = 'Usage: integrate-reviewed.js --cwd <worktree> --head <expected-sha> --commit <reviewed-sha> [--commit <reviewed-sha>...]';

class IntegrationError extends Error {}

function fail(message) {
  throw new IntegrationError(message);
}

function parseArgs(argv) {
  const result = { cwd: null, head: null, commits: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (value === undefined) fail(USAGE);
    if (key === '--cwd' && result.cwd === null) result.cwd = value;
    else if (key === '--head' && result.head === null) result.head = value;
    else if (key === '--commit') result.commits.push(value);
    else fail(USAGE);
  }
  if (!result.cwd || !result.head || result.commits.length === 0) fail(USAGE);
  for (const value of [result.head, ...result.commits]) {
    if (!/^[0-9a-fA-F]{7,64}$/.test(value)) fail(`invalid commit: ${value}`);
  }
  return result;
}

function git(cwd, args, allowFailure = false) {
  const result = spawnGit(cwd, args, { encoding: 'utf8' });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const detail = result.error?.message || String(result.stderr || result.stdout || '').trim();
    fail(`git ${gitCommandName(args)} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function integrate(options) {
  const cwd = path.resolve(options.cwd);
  const root = path.resolve(git(cwd, ['rev-parse', '--show-toplevel']).stdout.trim());
  if (root.toLowerCase() !== cwd.toLowerCase()) fail('--cwd must be the Worktree root');
  const expected = git(cwd, ['rev-parse', '--verify', `${options.head}^{commit}`]).stdout.trim();
  const actual = git(cwd, ['rev-parse', 'HEAD']).stdout.trim();
  if (actual !== expected) fail(`Worktree HEAD changed: expected ${expected}, actual ${actual}`);
  const productPathspec = ['--', '.', ':(exclude).proofline/**'];
  const trackedDirty = git(cwd, ['diff', '--quiet', ...productPathspec], true);
  const stagedDirty = git(cwd, ['diff', '--cached', '--quiet', ...productPathspec], true);
  const untracked = git(cwd, [
    'ls-files', '--others', '--exclude-standard', '-z', ...productPathspec,
  ]).stdout;
  if (trackedDirty.status > 1 || stagedDirty.status > 1) fail('cannot inspect Worktree product state');
  if (trackedDirty.status === 1 || stagedDirty.status === 1 || untracked.length > 0) {
    fail('Worktree product state must be clean before integration');
  }

  const applied = [];
  for (const value of options.commits) {
    const commit = git(cwd, ['rev-parse', '--verify', `${value}^{commit}`]).stdout.trim();
    const ancestor = git(cwd, ['merge-base', '--is-ancestor', commit, 'HEAD'], true);
    if (ancestor.status === 0) continue;
    const picked = git(cwd, ['cherry-pick', commit], true);
    if (picked.error || picked.status !== 0) {
      git(cwd, ['cherry-pick', '--abort'], true);
      const detail = picked.error?.message || String(picked.stderr || picked.stdout || '').trim();
      fail(`git cherry-pick failed${detail ? `: ${detail}` : ''}`);
    }
    applied.push(commit);
  }
  return {
    ok: true,
    action: 'integrated',
    head: git(cwd, ['rev-parse', 'HEAD']).stdout.trim(),
    commits: applied,
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const output = integrate(parseArgs(argv));
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof IntegrationError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { IntegrationError, integrate, main, parseArgs };
