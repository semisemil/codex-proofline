#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  commitControlMerge,
  ControlStateError,
  controlManifest,
  planControlMerge,
  specRelativePath,
} = require('./control-state.js');

const USAGE = 'Usage: sync-control-state.js --cwd <worktree> --source <worktree> --spec <relative-spec>';

function parseArgs(argv) {
  const result = { cwd: null, source: null, spec: null };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (value === undefined) throw new ControlStateError(USAGE);
    if (key === '--cwd' && result.cwd === null) result.cwd = value;
    else if (key === '--source' && result.source === null) result.source = value;
    else if (key === '--spec' && result.spec === null) result.spec = value;
    else throw new ControlStateError(USAGE);
  }
  if (!result.cwd || !result.source || !result.spec) throw new ControlStateError(USAGE);
  return result;
}

function sync(options) {
  const cwd = path.resolve(options.cwd);
  const source = path.resolve(options.source);
  const relative = specRelativePath(cwd, path.resolve(cwd, options.spec));
  const destinationSpec = path.resolve(cwd, ...relative.split('/'));
  const sourceSpec = path.resolve(source, ...relative.split('/'));
  const destination = controlManifest(destinationSpec);
  const plan = planControlMerge(sourceSpec, destinationSpec, destination.full_fingerprint);
  commitControlMerge(plan);
  return { ok: true, action: 'synced', spec: relative, files: plan.writes.length };
}

function main(argv = process.argv.slice(2)) {
  try {
    const output = sync(parseArgs(argv));
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof ControlStateError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { main, parseArgs, sync };
