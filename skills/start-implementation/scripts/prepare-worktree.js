#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ControlStateError,
  copyActiveSpec,
  specRelativePath,
  verifyGateWritable,
} = require('./control-state.js');
const { ExecutionTreeError } = require('../../spec-slice/scripts/inspect-execution-tree.js');
const {
  GateParseError,
  GateUsageError,
} = require('../../spec-slice/scripts/run-gates.js');
const { spawnGit } = require('../../../lib/git-policy.js');

const USAGE = 'Usage: prepare-worktree.js --cwd <worktree> --source <checkout> --spec <relative-spec> --base <sha> --control-fingerprint <sha256:...>';

class EnvironmentBlockedError extends Error {}

function blocked(message) {
  throw new EnvironmentBlockedError(message);
}

function parseArgs(argv) {
  const result = { cwd: null, source: null, spec: null, base: null, controlFingerprint: null };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (value === undefined) blocked(USAGE);
    if (key === '--cwd' && result.cwd === null) result.cwd = value;
    else if (key === '--source' && result.source === null) result.source = value;
    else if (key === '--spec' && result.spec === null) result.spec = value;
    else if (key === '--base' && result.base === null) result.base = value;
    else if (key === '--control-fingerprint' && result.controlFingerprint === null) {
      result.controlFingerprint = value;
    } else blocked(USAGE);
  }
  if (!result.cwd || !result.source || !result.spec || !result.base || !result.controlFingerprint) {
    blocked(USAGE);
  }
  if (!/^[0-9a-fA-F]{7,64}$/.test(result.base)) blocked('invalid --base');
  if (!/^sha256:[0-9a-f]{64}$/.test(result.controlFingerprint)) {
    blocked('invalid --control-fingerprint');
  }
  return result;
}

function gitValue(cwd, args) {
  const result = spawnGit(cwd, args, { encoding: 'utf8' });
  if (result.error) blocked(`git ${args[0]} failed: ${result.error.message}`);
  if (result.status !== 0) blocked(`git ${args[0]} failed: ${String(result.stderr || '').trim()}`);
  return String(result.stdout).trim();
}

function prepare(options) {
  const cwd = path.resolve(options.cwd);
  const source = path.resolve(options.source);
  const relative = specRelativePath(source, path.resolve(source, options.spec));
  const actualRoot = path.resolve(gitValue(cwd, ['rev-parse', '--show-toplevel']));
  if (actualRoot.toLowerCase() !== cwd.toLowerCase()) blocked('Worktree root differs from --cwd');
  const actualHead = gitValue(cwd, ['rev-parse', 'HEAD']);
  const expectedHead = gitValue(cwd, ['rev-parse', '--verify', `${options.base}^{commit}`]);
  if (actualHead !== expectedHead) blocked(`Worktree HEAD differs: expected ${expectedHead}, actual ${actualHead}`);
  const destinationSpec = path.resolve(cwd, ...relative.split('/'));
  const manifest = copyActiveSpec(
    path.resolve(source, ...relative.split('/')),
    destinationSpec,
    options.controlFingerprint,
  );
  verifyGateWritable(destinationSpec);
  return {
    ok: true,
    action: 'ready',
    spec: relative,
    spec_id: manifest.spec_id,
    revision: manifest.revision,
  };
}

function main(argv = process.argv.slice(2)) {
  try {
    const output = prepare(parseArgs(argv));
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof EnvironmentBlockedError || error instanceof ControlStateError
      || error instanceof ExecutionTreeError || error instanceof GateParseError
      || error instanceof GateUsageError) {
      process.stdout.write(`${JSON.stringify({
        ok: false,
        action: 'environment_blocked',
        error: error.message,
      })}\n`);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { EnvironmentBlockedError, main, parseArgs, prepare };
