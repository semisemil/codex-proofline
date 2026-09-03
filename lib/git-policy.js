'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const DIFF_CHECK_WHITESPACE = [
  'blank-at-eol',
  'blank-at-eof',
  'space-before-tab',
  'cr-at-eol',
].join(',');

class GitPolicyError extends Error {}

function canonical(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function exactRoots(values) {
  const roots = [];
  const seen = new Set();
  for (const value of values) {
    const root = path.resolve(value);
    const key = canonical(root);
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(root);
  }
  return roots;
}

function safeDirectoryArgs(roots, args) {
  return [
    ...exactRoots(roots).flatMap((root) => ['-c', `safe.directory=${root}`]),
    ...args,
  ];
}

function gitEnvironment(roots, source = process.env) {
  const env = { ...source };
  const rawCount = env.GIT_CONFIG_COUNT;
  if (rawCount !== undefined && !/^\d+$/.test(String(rawCount))) {
    throw new GitPolicyError('GIT_CONFIG_COUNT must be a non-negative integer');
  }
  let count = rawCount === undefined ? 0 : Number(rawCount);
  if (!Number.isSafeInteger(count) || count > 1024) {
    throw new GitPolicyError('GIT_CONFIG_COUNT is outside the supported range');
  }
  for (const root of exactRoots(roots)) {
    env[`GIT_CONFIG_KEY_${count}`] = 'safe.directory';
    env[`GIT_CONFIG_VALUE_${count}`] = root;
    count += 1;
  }
  env.GIT_CONFIG_COUNT = String(count);
  return env;
}

function spawnGit(cwd, args, options = {}) {
  const root = path.resolve(options.safeRoot || cwd);
  const roots = [root, ...(options.additionalSafeRoots || [])];
  const { safeRoot, additionalSafeRoots, env, ...spawnOptions } = options;
  return spawnSync('git', safeDirectoryArgs(roots, args), {
    cwd,
    windowsHide: true,
    ...spawnOptions,
    env: gitEnvironment(roots, env || process.env),
  });
}

function diffCheckArgs(args) {
  return ['-c', `core.whitespace=${DIFF_CHECK_WHITESPACE}`, 'diff', ...args];
}

function gitCommandName(args) {
  let index = 0;
  while (args[index] === '-c' && args[index + 1] !== undefined) index += 2;
  return args[index] || args[0] || 'command';
}

module.exports = {
  canonical,
  DIFF_CHECK_WHITESPACE,
  diffCheckArgs,
  exactRoots,
  gitCommandName,
  gitEnvironment,
  GitPolicyError,
  safeDirectoryArgs,
  spawnGit,
};
