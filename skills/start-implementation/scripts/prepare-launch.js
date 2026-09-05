#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter, parseSpecMetadata } = require('../../../dashboard/records/record-parser.js');

function requireValue(condition, message) { if (!condition) throw new Error(message); }

function prepareLaunch({ cwd, spec, projectRoot, projectId, model, reasoning }) {
  requireValue(/^SPEC-\d{4,}$/.test(spec), 'Supply a Spec ID');
  requireValue([cwd, projectRoot, projectId, model, reasoning].every(value => typeof value === 'string' && value.trim()),
    'Supply the current project, matching saved project, model, and reasoning');
  const root = fs.realpathSync(cwd);
  const savedRoot = fs.realpathSync(projectRoot);
  requireValue(path.relative(root, savedRoot) === '', 'Saved project must match the current project folder');
  const specsRoot = path.join(root, '.proofline', 'specs');
  requireValue(fs.existsSync(specsRoot), `Spec not found: ${spec}`);
  const candidates = fs.readdirSync(specsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && (entry.name === spec || entry.name.startsWith(`${spec}-`)))
    .map(entry => path.join(specsRoot, entry.name, 'SPEC.md'))
    .filter(file => fs.existsSync(file));
  requireValue(candidates.length === 1, candidates.length ? `Ambiguous Spec ID: ${spec}` : `Spec not found: ${spec}`);
  const file = fs.realpathSync(candidates[0]);
  const relative = path.relative(root, file);
  requireValue(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Spec must be inside the project');
  const metadata = parseSpecMetadata(parseFrontmatter(fs.readFileSync(file, 'utf8')).metadataText);
  requireValue(metadata.id === spec, 'Spec ID does not match its directory');
  requireValue(metadata.status === 'ready', 'Spec must be ready');
  return {
    prompt: `$proofline:implement ${spec}`,
    model,
    thinking: reasoning,
    target: { type: 'project', projectId, environment: { type: 'local' } },
  };
}

function parseArgs(argv) {
  const names = { '--cwd': 'cwd', '--spec': 'spec', '--project-root': 'projectRoot',
    '--project-id': 'projectId', '--model': 'model', '--reasoning': 'reasoning' };
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]];
    requireValue(key && !Object.hasOwn(options, key) && argv[i + 1], 'Supply each supported option once with a value');
    options[key] = argv[i + 1];
  }
  return options;
}

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(prepareLaunch(parseArgs(process.argv.slice(2))), null, 2)}\n`); }
  catch (error) { process.stderr.write(`Implementation launch: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { prepareLaunch, parseArgs };
