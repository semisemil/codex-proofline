#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const S = require('../skills/architecture-memory/scripts/storage.js');

function projectFor(cwd) {
  let directory = path.resolve(cwd);
  for (let depth = 0; depth < 12; depth += 1) {
    if (fs.existsSync(path.join(directory, S.BINDING))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory || fs.existsSync(path.join(directory, '.git'))) return null;
    directory = parent;
  }
  return null;
}
function notice(input, options = {}) {
  const pluginRoot = options.pluginRoot || path.resolve(__dirname, '..');
  const cwd = typeof input.cwd === 'string' ? input.cwd : process.cwd();
  const project = projectFor(cwd);
  // Uninitialized projects do not load skills, scan docs, or create notice state.
  if (!project) return '';
  const linked = S.binding(project);
  const root = S.safePath(project, linked.root);
  const manifest = fs.existsSync(root) ? S.jsonFile(S.safePath(root, '.architecture-memory/manifest.json'), 256 * 1024) : null;
  const state = fs.existsSync(root) ? S.jsonFile(S.safePath(root, `${S.WORK}/state.json`), 128 * 1024 * 1024) : null;
  const active = manifest?.schema_version === 2 && manifest.managed === true
    && (!state || state.schema_version === 1 && ['draft', 'applied'].includes(state.phase));
  const skill = path.join(pluginRoot, 'skills', 'architecture-memory', 'SKILL.md');
  const fingerprint = active && fs.existsSync(skill) ? S.hash(`${project}\0${linked.root}\0${skill}`) : 'inactive';
  const identity = input.agent_id || input.session_id || input.thread_id;
  if (!identity) return ''; // Without identity, per-turn repetition cannot be bounded reliably.
  const data = options.dataRoot || process.env.PLUGIN_DATA || path.join(os.tmpdir(), 'proofline-plugin-state');
  const cache = path.join(data, 'architecture-notices', `${S.hash(`${identity}\0${project}`)}.json`);
  const previous = S.jsonFile(cache, 4096);
  const reset = input.hook_event_name === 'SessionStart' && ['startup', 'clear', 'compact'].includes(input.source);
  if (!reset && previous?.fingerprint === fingerprint) return '';
  if (fingerprint === 'inactive' && !previous) return '';
  S.saveJson(cache, { fingerprint });
  if (fingerprint === 'inactive') return 'Project architecture memory is unavailable or disabled; skip its previous workflow connection.';
  return `While .proofline/architecture.json exists and memory at ${JSON.stringify(linked.root)} is managed, read ${JSON.stringify(skill)} for architecture-dependent work or new durable project context. Reuse unchanged evidence; mechanical edits need no lookup.`;
}
function main() {
  try {
    const source = fs.readFileSync(0, 'utf8');
    const input = source.trim() ? JSON.parse(source) : {};
    const context = notice(input);
    if (context) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: input.hook_event_name || 'UserPromptSubmit', additionalContext: context } }));
  } catch (error) {
    // A malformed opt-in must not block unrelated work or inject untrusted content.
    process.stderr.write(`Architecture memory connection unavailable: ${error.code || error.message}\n`);
  }
}
if (require.main === module) main();
module.exports = { notice, projectFor };
