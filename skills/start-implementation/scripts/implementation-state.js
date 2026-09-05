#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const changes = require('./change-state.js');
const { parseFrontmatter, parseSpecMetadata } = require('../../../dashboard/records/record-parser.js');

const SCHEMA = 2;
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function settings(value) {
  if (value?.inherit_current === true) {
    requireValue(Object.keys(value).length === 1, 'Use guaranteed current-setting inheritance or explicit settings, not both');
    return { inherit_current: true };
  }
  requireValue(value && nonempty(value.model) && nonempty(value.reasoning), 'Supply the actual model and reasoning settings');
  return { model: value.model, reasoning: value.reasoning };
}
function requirements(value) {
  requireValue(Array.isArray(value) && value.length > 0, 'List the Spec completion conditions and user-required verification');
  const ids = new Set();
  for (const item of value) {
    requireValue(item && nonempty(item.id) && nonempty(item.text) && !ids.has(item.id), 'Each requirement needs a unique id and text');
    ids.add(item.id);
  }
  return value.map(({ id, text }) => ({ id, text }));
}
function readSpec(cwd, spec) {
  changes.relativePath(spec);
  const target = fs.realpathSync(path.join(cwd, spec));
  const relative = path.relative(cwd, target);
  requireValue(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Spec must be inside the repository');
  const text = fs.readFileSync(target, 'utf8');
  const frontmatter = parseFrontmatter(text);
  const metadata = parseSpecMetadata(frontmatter.metadataText);
  requireValue(metadata.status === 'ready', 'Spec must be ready');
  return { path: spec, text, hash: changes.hash(text), id: metadata.id, revision: metadata.revision };
}
function withStateLock(statePath, operation) {
  const lockPath = `${statePath}.lock`;
  let lock;
  try { lock = fs.openSync(lockPath, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Another evidence update is active; the main implementer records returned results sequentially'); throw error; }
  try { return operation(); }
  finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}
function saveLocked(statePath, state) {
  const temporary = `${statePath}.${crypto.randomUUID()}.tmp`;
  try {
    if (fs.existsSync(statePath)) {
      const stored = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      requireValue(stored.generation === state.generation, 'Execution evidence changed concurrently; record this result against the current state');
    }
    const next = { ...state, generation: state.generation + 1 };
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, statePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function save(statePath, state) { return withStateLock(statePath, () => saveLocked(statePath, state)); }
function load(statePath, active = true) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  requireValue(state.schema_version === SCHEMA && state.baseline?.entries && Array.isArray(state.checks)
    && Array.isArray(state.reviews) && Array.isArray(state.reviewer_ids)
    && Number.isInteger(state.generation) && state.authority?.spec && Array.isArray(state.authority.requirements), 'Invalid execution state');
  requireValue(changes.repository(state.cwd) === state.cwd, 'Repository changed');
  if (active) {
    requireValue(state.status === 'active', 'Execution is already completed');
    requireValue(readSpec(state.cwd, state.authority.spec.path).hash === state.authority.spec.hash,
      'Spec changed; refresh the accepted authority before continuing');
    for (const source of state.authority.sources) requireValue(changes.hash(fs.readFileSync(path.join(state.cwd, source.path))) === source.hash,
      `Authoritative source changed: ${source.path}`);
  }
  return state;
}
function storage(statePath) { return path.dirname(path.resolve(statePath)); }
function productSnapshot(snapshot, spec) {
  delete snapshot.entries[spec];
  snapshot.fingerprint = changes.hash(JSON.stringify(snapshot.entries));
  return snapshot;
}
function current(statePath, state, persistBlobs = false) {
  return productSnapshot(changes.snapshot(state.cwd, persistBlobs ? path.join(storage(statePath), 'blobs') : null), state.authority.spec.path);
}
function capture({ cwd, spec }, input) {
  cwd = changes.repository(cwd);
  const authority = {
    decisions: [],
    spec: readSpec(cwd, spec), requirements: requirements(input.requirements), sources: [],
  };
  requireValue(Array.isArray(input.sources || []), 'sources must be repository-relative file paths');
  for (const source of input.sources || []) {
    changes.relativePath(source);
    const bytes = fs.readFileSync(path.join(cwd, source));
    authority.sources.push({ path: source, hash: changes.hash(bytes) });
  }
  const mainSettings = settings(input.settings);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-implementation-'));
  fs.mkdirSync(path.join(directory, 'blobs'));
  fs.writeFileSync(path.join(directory, 'empty'), '');
  const baseline = productSnapshot(changes.snapshot(cwd, path.join(directory, 'blobs')), spec);
  const state = { schema_version: SCHEMA, generation: 0, status: 'active', cwd, started_at: new Date().toISOString(),
    authority, main_settings: mainSettings, baseline, checks: [], reviews: [], reviewer_ids: [], superseded_evidence: [] };
  const statePath = path.join(directory, 'execution.json');
  save(statePath, state);
  return { state_path: statePath, fingerprint: baseline.fingerprint, requirements: authority.requirements };
}
function requirementIds(state, ids) {
  requireValue(Array.isArray(ids) && ids.length > 0 && ids.every(id => state.authority.requirements.some(item => item.id === id)), 'Unknown or empty requirement ids');
  return [...new Set(ids)];
}
function dependencies(input) {
  const values = input.dependencies === undefined ? ['.'] : input.dependencies;
  requireValue(Array.isArray(values) && values.length > 0, 'dependencies must list every file/directory that can affect this result');
  return values.map(changes.relativePath);
}
function check(statePath, input) {
  const state = load(statePath);
  const ids = requirementIds(state, input.requirements);
  const scope = dependencies(input);
  requireValue(Array.isArray(input.command) && input.command.length > 0 && input.command.every(nonempty), 'command must be an executable and argument array');
  const cwd = path.resolve(state.cwd, input.cwd || '.');
  const location = path.relative(state.cwd, cwd);
  requireValue(location !== '..' && !location.startsWith(`..${path.sep}`) && !path.isAbsolute(location), 'Check cwd must be inside the repository');
  const before = current(statePath, state);
  const startedAt = new Date().toISOString();
  const result = spawnSync(input.command[0], input.command.slice(1), { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const after = current(statePath, state);
  const stable = changes.relevantFingerprint(before, scope) === changes.relevantFingerprint(after, scope)
    && changes.hash(fs.readFileSync(path.join(state.cwd, state.authority.spec.path), 'utf8')) === state.authority.spec.hash;
  const record = { id: crypto.randomUUID(), kind: 'command', requirements: ids, command: input.command, cwd,
    started_at: startedAt, finished_at: new Date().toISOString(), dependencies: scope,
    fingerprint: before.fingerprint, relevant_fingerprint: changes.relevantFingerprint(before, scope),
    exit_code: result.status, signal: result.signal, stable,
    passed: !result.error && result.status === 0 && stable,
    stdout: result.stdout || '', stderr: result.stderr || '', error: result.error?.message || null };
  state.checks.push(record);
  save(statePath, state);
  return record;
}
function evidence(statePath, input) {
  const state = load(statePath);
  const ids = requirementIds(state, input.requirements);
  const scope = dependencies(input);
  const snapshot = current(statePath, state);
  requireValue(input.fingerprint === snapshot.fingerprint, 'Evidence does not identify the current tested state');
  requireValue(['command', 'inspection'].includes(input.kind) && typeof input.passed === 'boolean'
    && nonempty(input.basis), 'Evidence needs kind, passed, and concrete observed basis');
  if (input.kind === 'command') requireValue(nonempty(input.command) && nonempty(input.cwd)
    && Number.isInteger(input.exit_code) && nonempty(input.result), 'Command evidence needs command, cwd, exit_code, and result');
  const record = { id: crypto.randomUUID(), kind: input.kind, requirements: ids, dependencies: scope,
    fingerprint: snapshot.fingerprint, relevant_fingerprint: changes.relevantFingerprint(snapshot, scope),
    passed: input.passed && (input.kind !== 'command' || input.exit_code === 0), basis: input.basis,
    command: input.command, cwd: input.cwd, exit_code: input.exit_code, result: input.result,
    recorded_at: new Date().toISOString(), provenance: 'implementer-recorded' };
  state.checks.push(record);
  save(statePath, state);
  return record;
}
function coverage(state, snapshot) {
  return state.authority.requirements.map(requirement => {
    const matching = state.checks.filter(record => record.requirements.includes(requirement.id)
      && record.relevant_fingerprint === changes.relevantFingerprint(snapshot, record.dependencies));
    // A later failure for the same condition supersedes an earlier success.
    const latest = matching.at(-1);
    return { ...requirement, verified: latest?.passed === true, evidence_id: latest?.id || null };
  });
}
function status(statePath) {
  const state = load(statePath, false);
  const snapshot = current(statePath, state);
  return { status: state.status, fingerprint: snapshot.fingerprint, changed_paths: changes.changedPaths(state.baseline, snapshot),
    requirements: coverage(state, snapshot) };
}
function prepareSnapshot(statePath) {
  const state = load(statePath);
  const snapshot = current(statePath, state, true);
  return { fingerprint: snapshot.fingerprint, changed_paths: changes.changedPaths(state.baseline, snapshot) };
}
function reviewInput(statePath, mainSettings) {
  const state = load(statePath);
  const snapshot = current(statePath, state);
  const expectedSettings = settings(mainSettings);
  const conditions = coverage(state, snapshot);
  requireValue(conditions.every(item => item.verified), 'Required completion conditions remain unverified');
  for (const source of state.authority.sources) requireValue(changes.hash(fs.readFileSync(path.join(state.cwd, source.path))) === source.hash,
    `Authoritative source changed: ${source.path}`);
  // Deliberately construct a fresh authority packet; never serialize review history.
  return {
    spec: state.authority.spec, sources: state.authority.sources, requirements: conditions,
    reviewer_settings: expectedSettings, cwd: state.cwd, fingerprint: snapshot.fingerprint,
    changed_paths: changes.changedPaths(state.baseline, snapshot),
    diff: changes.diff(state.cwd, storage(statePath), state.baseline, snapshot),
    verification: state.checks.filter(record => conditions.some(item => item.evidence_id === record.id)) };
}
function review(statePath, input) {
  const state = load(statePath);
  const snapshot = current(statePath, state);
  requireValue(input.fingerprint === snapshot.fingerprint, 'Review is stale');
  requireValue(nonempty(input.reviewer_id) && !state.reviewer_ids.includes(input.reviewer_id), 'Every review must use a new reviewer');
  const mainSettings = settings(input.main_settings);
  requireValue(JSON.stringify(settings(input.reviewer_settings)) === JSON.stringify(mainSettings), 'Reviewer must use the main implementer settings at dispatch');
  requireValue(['pass', 'fail'].includes(input.verdict) && Array.isArray(input.findings), 'Review needs pass/fail and findings');
  const ids = new Set();
  for (const finding of input.findings) {
    requireValue(finding && nonempty(finding.id) && !ids.has(finding.id)
      && ['requirement', 'regression', 'contract', 'out_of_scope'].includes(finding.category)
      && ['requirement', 'trigger', 'evidence', 'change_relation'].every(key => nonempty(finding[key])),
    'Each finding needs a unique id, category, violated requirement/behavior, trigger, evidence, and relation to this change');
    ids.add(finding.id);
  }
  const exclusions = input.exclusions || [];
  requireValue(Array.isArray(exclusions), 'exclusions must be an array');
  const excluded = new Set();
  for (const exclusion of exclusions) {
    requireValue(ids.has(exclusion.id) && !excluded.has(exclusion.id)
      && nonempty(exclusion.reason) && nonempty(exclusion.evidence), 'Exclusions need a finding id, scope reason, and Spec/change evidence');
    excluded.add(exclusion.id);
  }
  requireValue(input.verdict !== 'pass' || input.findings.length === 0, 'A pass cannot contain unresolved findings');
  const accepted = input.verdict === 'pass' || (input.findings.length > 0 && input.findings.every(item => excluded.has(item.id)));
  const record = { reviewer_id: input.reviewer_id, fingerprint: input.fingerprint, settings: mainSettings,
    verdict: input.verdict, findings: input.findings, exclusions, accepted, recorded_at: new Date().toISOString() };
  state.main_settings = mainSettings;
  state.reviewer_ids.push(input.reviewer_id);
  state.reviews.push(record);
  save(statePath, state);
  return record;
}
function completedSpec(previous) {
  const front = previous.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  requireValue(front && parseSpecMetadata(front[2]).status === 'ready', 'Spec must be ready');
  // Locate the effective top-level JSON member, including escaped keys/values,
  // while preserving all other metadata bytes and the complete document body.
  const tokens = [...front[2].matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]/g)];
  let depth = 0;
  let statusToken;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i][0];
    if (token === '{' || token === '[') depth += 1;
    else if (token === '}' || token === ']') depth -= 1;
    else if (depth === 1 && token.startsWith('"') && tokens[i + 1]?.[0] === ':' && JSON.parse(token) === 'status') {
      statusToken = tokens[i + 2];
    }
  }
  requireValue(statusToken && JSON.parse(statusToken[0]) === 'ready', 'Spec status field not found');
  const metadata = front[2].slice(0, statusToken.index) + '"completed"' + front[2].slice(statusToken.index + statusToken[0].length);
  return front[1] + metadata + front[3] + previous.slice(front[0].length);
}
function completeLocked(statePath) {
  const state = load(statePath);
  const snapshot = current(statePath, state);
  requireValue(coverage(state, snapshot).every(item => item.verified), 'Required completion conditions remain unverified');
  const review = state.reviews.at(-1);
  requireValue(review?.accepted && review.fingerprint === snapshot.fingerprint, 'A current independent review without valid unresolved findings is required');
  const specPath = path.join(state.cwd, state.authority.spec.path);
  const previous = fs.readFileSync(specPath, 'utf8');
  const next = completedSpec(previous);
  state.status = 'completed';
  state.completed_at = new Date().toISOString();
  state.completed_fingerprint = snapshot.fingerprint;
  try { fs.writeFileSync(specPath, next); saveLocked(statePath, state); }
  catch (error) { fs.writeFileSync(specPath, previous); throw error; }
  return { status: 'completed', spec: specPath, reviewed_fingerprint: snapshot.fingerprint,
    excluded_findings: review.exclusions, state_path: statePath };
}
function complete(statePath) { return withStateLock(statePath, () => completeLocked(statePath)); }
function refreshAuthority(statePath, input) {
  const state = load(statePath, false);
  requireValue(state.status === 'active', 'Execution is already completed');
  requireValue(nonempty(input.accepted_change), 'Record the explicitly accepted scope/Spec change');
  const spec = readSpec(state.cwd, state.authority.spec.path);
  const nextRequirements = requirements(input.requirements);
  state.superseded_evidence.push({ authority: state.authority, checks: state.checks, reviews: state.reviews });
  state.authority = { ...state.authority, decisions: [...state.authority.decisions] };
  state.authority.spec = spec;
  state.authority.decisions.push(input.accepted_change);
  state.authority.requirements = nextRequirements;
  state.authority.sources = state.authority.sources.map(source => ({ ...source,
    hash: changes.hash(fs.readFileSync(path.join(state.cwd, source.path))) }));
  state.checks = [];
  state.reviews = [];
  save(statePath, state);
  return { status: 'active', baseline: state.baseline.fingerprint, requirements: nextRequirements };
}
function parseArgs(argv) {
  const [action, ...rest] = argv;
  requireValue(['capture', 'status', 'snapshot', 'diff', 'check', 'evidence', 'review-input', 'review', 'complete', 'authority'].includes(action), 'Unknown action');
  const options = { action };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].replace(/^--/, '');
    requireValue(rest[i].startsWith('--') && ['cwd', 'spec', 'state', 'model', 'reasoning', 'inherit-current'].includes(key)
      && nonempty(rest[i + 1]) && !Object.hasOwn(options, key), 'Invalid command arguments');
    options[key] = rest[i + 1];
  }
  requireValue(action === 'capture' ? options.cwd && options.spec : options.state, 'Supply --cwd/--spec for capture, --state for other actions');
  if (options['inherit-current'] !== undefined) requireValue(options['inherit-current'] === 'true'
    && action === 'review-input' && !options.model && !options.reasoning, 'Use --inherit-current true only for review-input without explicit settings');
  return options;
}
function main(argv) {
  const options = parseArgs(argv);
  const { action, state: statePath } = options;
  const input = () => JSON.parse(fs.readFileSync(0, 'utf8'));
  let result;
  if (action === 'capture') result = capture(options, input());
  else if (action === 'check') result = check(statePath, input());
  else if (action === 'evidence') result = evidence(statePath, input());
  else if (action === 'review') result = review(statePath, input());
  else if (action === 'authority') result = refreshAuthority(statePath, input());
  else if (action === 'status') result = status(statePath);
  else if (action === 'snapshot') result = prepareSnapshot(statePath);
  else if (action === 'review-input') result = reviewInput(statePath, options['inherit-current'] === 'true'
    ? { inherit_current: true } : { model: options.model, reasoning: options.reasoning });
  else if (action === 'complete') result = complete(statePath);
  else {
    const state = load(statePath);
    result = changes.diff(state.cwd, storage(statePath), state.baseline, current(statePath, state));
  }
  process.stdout.write(typeof result === 'string' ? result : `${JSON.stringify(result, null, 2)}\n`);
  if (action === 'check' && !result.passed) process.exitCode = 1;
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`Implementation state: ${error.message}\n`); process.exitCode = 1; }
}
module.exports = { capture, status, prepareSnapshot, check, evidence, reviewInput, review, complete, refreshAuthority, parseArgs };
