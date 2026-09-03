#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { gitEnvironment, spawnGit } = require('../../../lib/git-policy.js');

const DEFAULT_TIMEOUT_MS = 120000;
const EVIDENCE_LIMIT = 240;

class GateParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GateParseError';
  }
}

class GateUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GateUsageError';
  }
}

function splitLines(content) {
  const lines = [];
  const newline = /\r\n|\n|\r/g;
  let start = 0;
  let match;

  while ((match = newline.exec(content)) !== null) {
    lines.push({ text: content.slice(start, match.index), eol: match[0] });
    start = newline.lastIndex;
  }
  if (start < content.length || lines.length === 0) {
    lines.push({ text: content.slice(start), eol: '' });
  }
  return lines;
}

function fileLabel(filePath) {
  return filePath || '<input>';
}

function parseFailure(filePath, lineIndex, message) {
  throw new GateParseError(fileLabel(filePath) + ':' + (lineIndex + 1) + ': ' + message);
}

function isEscaped(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function parseExpectation(value, location) {
  const raw = value.trim();
  if (raw.length === 0) {
    throw new GateParseError(location + ': EXPECT must contain a substring or /regex/flags');
  }
  if (raw[0] !== '/') {
    return { kind: 'substring', value: raw, raw };
  }

  let delimiter = -1;
  for (let index = raw.length - 1; index > 0; index -= 1) {
    if (raw[index] === '/' && !isEscaped(raw, index)) {
      delimiter = index;
      break;
    }
  }
  if (delimiter < 1) {
    throw new GateParseError(location + ': invalid EXPECT regex: closing / is missing');
  }

  const source = raw.slice(1, delimiter);
  const flags = raw.slice(delimiter + 1);
  try {
    new RegExp(source, flags);
  } catch (error) {
    throw new GateParseError(location + ': invalid EXPECT regex: ' + error.message);
  }
  return { kind: 'regex', source, flags, raw };
}

function isManualCheck(command) {
  return /^manual(?:\s|:|$)/i.test(command.trim());
}

function parseCheckArgv(value, location) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new GateParseError(location + ': CHECK must be a JSON argv array');
  }
  if (!Array.isArray(parsed) || parsed.length === 0
    || parsed.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new GateParseError(location + ': CHECK must be a non-empty JSON array of non-empty strings');
  }
  return parsed;
}

function parseRequiredPaths(value, location) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new GateParseError(location + ': REQUIRES must be a JSON path array');
  }
  if (!Array.isArray(parsed) || parsed.length === 0
    || parsed.some((item) => typeof item !== 'string' || item.length === 0
      || item.trim() !== item || item.includes('\\') || path.posix.isAbsolute(item)
      || /^[A-Za-z]:/.test(item) || path.posix.normalize(item) !== item
      || item === '.' || item.endsWith('/') || item.startsWith('../')
      || /[\0\r\n*?\[\]{}]/.test(item))) {
    throw new GateParseError(location + ': REQUIRES must contain exact project-relative paths');
  }
  if (new Set(parsed).size !== parsed.length) {
    throw new GateParseError(location + ': REQUIRES contains duplicate paths');
  }
  return [...parsed].sort();
}

function parseGateDocument(content, filePath) {
  if (typeof content !== 'string') {
    throw new TypeError('Gate document content must be a string');
  }

  const hasBom = content.startsWith('\uFEFF');
  const source = hasBom ? content.slice(1) : content;
  const lines = splitLines(source);
  const label = fileLabel(filePath);

  const heading = lines[0] && lines[0].text.match(/^# Gates: (.+)$/);
  if (!heading || heading[1].trim().length === 0) {
    parseFailure(label, 0, 'heading must be "# Gates: <scope>"');
  }

  const scopeLine = lines[1] && lines[1].text.match(/^Scope: (.+)$/);
  if (!scopeLine || scopeLine[1].trim().length === 0) {
    parseFailure(label, 1, 'scope must be "Scope: <one line>"');
  }
  const blankLine = 2;
  if (lines[2] && lines[2].text.startsWith('Scale:')) {
    parseFailure(label, 2, 'Scale is not supported; Gate sets have no numeric verification budget');
  }
  if (!lines[blankLine] || lines[blankLine].text.trim() !== '') {
    parseFailure(label, blankLine, 'a blank line is required after Scope');
  }

  const gates = [];
  const gateIds = new Set();
  const abandonments = new Map();
  let abandonmentsStarted = false;
  let index = blankLine + 1;

  while (index < lines.length) {
    const line = lines[index].text;
    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const gateMatch = line.match(/^- \[([ xX])\] (G\d+): (.+)$/);
    if (gateMatch) {
      if (abandonmentsStarted) {
        parseFailure(label, index, 'Gate blocks must precede ABANDON directives');
      }

      const id = gateMatch[2];
      const outcome = gateMatch[3].trim();
      if (outcome.length === 0) {
        parseFailure(label, index, id + ': outcome is required');
      }
      if (gateIds.has(id)) {
        parseFailure(label, index, id + ': duplicate Gate ID');
      }
      gateIds.add(id);

      const markerLine = index;
      index += 1;
      if (lines[index] && lines[index].text.startsWith('  CLASS:')) {
        parseFailure(label, index, id + ': CLASS is not supported; Gate sets have no numeric verification budget');
      }
      const checkMatch = lines[index] && lines[index].text.match(/^  CHECK: (.+)$/);
      if (!checkMatch || checkMatch[1].trim().length === 0) {
        parseFailure(label, index, id + ': CHECK is required');
      }
      const check = checkMatch[1].trim();
      if (isManualCheck(check)) {
        parseFailure(label, index, id + ': manual gates are not supported');
      }
      const noCheck = check.toLowerCase() === 'none';
      const argv = !noCheck && check.startsWith('[')
        ? parseCheckArgv(check, label + ':' + (index + 1))
        : null;
      if (argv && isManualCheck(argv.join(' '))) {
        parseFailure(label, index, id + ': manual gates are not supported');
      }
      index += 1;
      let expect = null;
      if (lines[index] && lines[index].text.startsWith('  EXPECT:')) {
        if (noCheck) {
          parseFailure(label, index, id + ': CHECK NONE cannot have EXPECT');
        }
        const expectMatch = lines[index].text.match(/^  EXPECT: (.*)$/);
        if (!expectMatch) {
          parseFailure(label, index, id + ': EXPECT must be "  EXPECT: <substring or /regex/flags>"');
        }
        expect = parseExpectation(expectMatch[1], label + ':' + (index + 1));
        index += 1;
      }

      let requires = [];
      if (lines[index] && lines[index].text.startsWith('  REQUIRES:')) {
        const requiresMatch = lines[index].text.match(/^  REQUIRES: (.+)$/);
        if (!requiresMatch) {
          parseFailure(label, index, id + ': REQUIRES must be "  REQUIRES: [<path>...]"');
        }
        requires = parseRequiredPaths(requiresMatch[1], label + ':' + (index + 1));
        index += 1;
      }

      const evidenceMatch = lines[index] && lines[index].text.match(/^  EVIDENCE: (.+)$/);
      if (!evidenceMatch || evidenceMatch[1].trim().length === 0) {
        parseFailure(label, index, id + ': EVIDENCE is required');
      }

      gates.push({
        id,
        outcome,
        checked: gateMatch[1].toLowerCase() === 'x',
        check,
        argv,
        noCheck,
        expect,
        requires,
        evidence: evidenceMatch[1].trim(),
        abandonedReason: null,
        markerLine,
        evidenceLine: index,
      });
      index += 1;
      continue;
    }

    const abandonMatch = line.match(/^ABANDON: (G\d+) (.+)$/);
    if (abandonMatch) {
      abandonmentsStarted = true;
      const id = abandonMatch[1];
      const reason = abandonMatch[2].trim();
      if (reason.length === 0) {
        parseFailure(label, index, id + ': ABANDON reason is required');
      }
      if (abandonments.has(id)) {
        parseFailure(label, index, id + ': duplicate ABANDON directive');
      }
      abandonments.set(id, reason);
      index += 1;
      continue;
    }

    parseFailure(label, index, 'unexpected Gate document line');
  }

  if (gates.length === 0) {
    parseFailure(label, blankLine + 1, 'at least one Gate item is required; use CHECK NONE when no mechanical check exists');
  }

  const gatesById = new Map(gates.map((gate) => [gate.id, gate]));
  for (const [id, reason] of abandonments) {
    if (!gatesById.has(id)) {
      throw new GateParseError(label + ': unknown ABANDON Gate ID ' + id);
    }
    gatesById.get(id).abandonedReason = reason;
  }

  return {
    filePath,
    scope: heading[1].trim(),
    scopeLine: scopeLine[1].trim(),
    gates,
    lines,
    hasBom,
    originalContent: content,
  };
}

function renderGateDocument(document) {
  const body = document.lines.map((line) => line.text + line.eol).join('');
  return (document.hasBom ? '\uFEFF' : '') + body;
}

function parseGateFile(filePath) {
  const resolved = path.resolve(filePath);
  let content;
  try {
    content = fs.readFileSync(resolved, 'utf8');
  } catch (error) {
    throw new GateParseError(resolved + ': cannot read Gate file: ' + error.message);
  }
  return parseGateDocument(content, resolved);
}

function loadGateFiles(filePaths) {
  return filePaths.map(parseGateFile);
}

function gateStatus(gate) {
  if (gate.abandonedReason !== null) return 'abandoned';
  if (gate.checked && gate.evidence.trim().toLowerCase() !== 'pending') return 'met';
  return 'unmet';
}

function summarizeGateStatus(documents) {
  const gates = [];
  const counts = { met: 0, unmet: 0, abandoned: 0 };

  for (const document of documents) {
    for (const gate of document.gates) {
      const status = gateStatus(gate);
      counts[status] += 1;
      gates.push({
        filePath: document.filePath,
        id: gate.id,
        status,
        checked: gate.checked,
        evidence: gate.evidence,
        abandonedReason: gate.abandonedReason,
      });
    }
  }

  return {
    allMet: counts.unmet === 0 && counts.abandoned === 0,
    counts,
    gates,
    exitCode: counts.unmet === 0 && counts.abandoned === 0 ? 0 : 1,
  };
}

function matchExpectation(expect, combinedOutput) {
  if (expect.kind === 'substring') return combinedOutput.includes(expect.value);
  return new RegExp(expect.source, expect.flags).test(combinedOutput);
}

function asText(value) {
  if (value === null || value === undefined) return '';
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
}

function collapseText(value) {
  return asText(value)
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capHead(value, limit) {
  if (value.length <= limit) return value;
  if (limit <= 3) return value.slice(0, limit);
  return value.slice(0, limit - 3) + '...';
}

function capTail(value, limit) {
  if (value.length <= limit) return value;
  if (limit <= 3) return value.slice(-limit);
  return '...' + value.slice(-(limit - 3));
}

function makeEvidence(decision, output) {
  const shortDecision = capHead(collapseText(decision), 160);
  const shortOutput = collapseText(output);
  if (shortOutput.length === 0) return capHead(shortDecision, EVIDENCE_LIMIT);

  const separator = '; tail: ';
  const available = EVIDENCE_LIMIT - shortDecision.length - separator.length;
  if (available <= 0) return capHead(shortDecision, EVIDENCE_LIMIT);
  return shortDecision + separator + capTail(shortOutput, available);
}

function gitOutput(cwd, args, encoding = null) {
  const result = spawnGit(cwd, args, { encoding });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function workspaceFingerprint(cwd) {
  const pathspec = ['--', '.', ':(exclude).proofline/**'];
  const index = gitOutput(cwd, [
    'ls-files', '--stage', '-z', ...pathspec,
  ]);
  const unstaged = gitOutput(cwd, [
    'diff', '--binary', '--no-ext-diff', '--no-renames', ...pathspec,
  ]);
  const untracked = gitOutput(cwd, [
    'ls-files', '--others', '--exclude-standard', '-z', ...pathspec,
  ]);
  if (index === null || unstaged === null || untracked === null) return null;

  const hash = crypto.createHash('sha256');
  hash.update(index);
  hash.update('\0');
  hash.update(unstaged);
  for (const relative of untracked.toString('utf8').split('\0').filter(Boolean).sort()) {
    hash.update('\0' + relative + '\0');
    try {
      hash.update(fs.readFileSync(path.join(cwd, relative)));
    } catch {
      return null;
    }
  }
  return `sha256:${hash.digest('hex')}`;
}

function stagedProductPaths(cwd) {
  const output = gitOutput(cwd, [
    'diff', '--cached', '--name-only', '--no-renames', '-z', '--', '.',
    ':(exclude).proofline/**',
  ]);
  if (output === null) return null;
  return output.toString('utf8').split('\0').filter(Boolean)
    .map((value) => value.replaceAll('\\', '/')).sort();
}

function evidenceFingerprint(evidence) {
  const match = evidence.match(/(?:^|; )snapshot (sha256:[0-9a-f]{64})(?:;|$)/);
  return match ? match[1] : null;
}

function bindEvidence(result, fingerprint) {
  const decision = collapseText(result.evidence).split('; tail: ')[0];
  const output = result.output || '';
  return {
    ...result,
    snapshot: fingerprint,
    evidence: makeEvidence(
      `${decision}; snapshot ${fingerprint}`,
      output,
    ),
  };
}

function executeGate(gate, options) {
  if (gate.noCheck) {
    return {
      passed: true,
      timedOut: false,
      status: 0,
      signal: null,
      output: '',
      evidence: 'pass: no mechanical check',
    };
  }
  let result;
  let thrown = null;
  try {
    result = gate.argv
      ? spawnSync(gate.argv[0], gate.argv.slice(1), {
        shell: false,
        cwd: options.cwd,
        timeout: options.timeout,
        encoding: 'utf8',
        windowsHide: true,
        env: gitEnvironment([options.cwd]),
      })
      : spawnSync(gate.check, {
      shell: true,
      cwd: options.cwd,
      timeout: options.timeout,
      encoding: 'utf8',
      windowsHide: true,
      env: gitEnvironment([options.cwd]),
      });
  } catch (error) {
    thrown = error;
    result = { status: null, signal: null, stdout: '', stderr: '', error };
  }

  const combinedOutput = asText(result.stdout) + asText(result.stderr);
  const error = thrown || result.error;
  const timedOut = Boolean(error && error.code === 'ETIMEDOUT');
  let passed = false;
  let decision;

  if (timedOut) {
    decision = 'fail: timeout ' + options.timeout + 'ms';
  } else if (gate.expect) {
    passed = matchExpectation(gate.expect, combinedOutput);
    decision = passed ? 'pass: EXPECT matched' : 'fail: EXPECT did not match';
  } else {
    passed = result.status === 0;
    if (passed) {
      decision = 'pass: exit 0';
    } else if (error && error.code) {
      decision = 'fail: ' + error.code;
    } else {
      decision = 'fail: exit ' + (result.status === null ? 'none' : result.status);
    }
  }

  const diagnosticOutput = combinedOutput || (error && error.message) || '';
  return {
    passed,
    timedOut,
    status: result.status,
    signal: result.signal,
    output: combinedOutput,
    evidence: makeEvidence(decision, diagnosticOutput),
  };
}

function applyGateResult(document, gate, result) {
  document.lines[gate.markerLine].text = document.lines[gate.markerLine].text.replace(
    /^- \[[ xX]\]/,
    result.passed ? '- [x]' : '- [ ]'
  );
  document.lines[gate.evidenceLine].text = '  EVIDENCE: ' + result.evidence;
  gate.checked = result.passed;
  gate.evidence = result.evidence;
}

function writeGateDocuments(documents) {
  for (const document of documents) {
    const rendered = renderGateDocument(document);
    if (rendered === document.originalContent) continue;
    try {
      fs.writeFileSync(document.filePath, rendered, 'utf8');
    } catch (error) {
      throw new GateParseError(document.filePath + ': cannot write Gate file: ' + error.message);
    }
  }
}

function gateDefinitionFingerprint(documents) {
  const value = documents.map((document) => ({
    filePath: path.resolve(document.filePath),
    scope: document.scope,
    scopeLine: document.scopeLine,
    gates: document.gates.map((gate) => ({
      id: gate.id,
      outcome: gate.outcome,
      check: gate.check,
      expect: gate.expect,
      requires: gate.requires,
    })),
  }));
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function pendingResultPath(cwd, filePaths) {
  const key = JSON.stringify([
    path.resolve(cwd),
    ...filePaths.map((filePath) => path.resolve(filePath)).sort(),
  ]);
  const root = path.join(
    process.env.PLUGIN_DATA || path.join(os.tmpdir(), 'proofline-plugin-data'),
    'pending-gate-results',
  );
  return path.join(root, `${crypto.createHash('sha256').update(key).digest('hex')}.json`);
}

function writePendingResult(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, target);
}

function compactPendingExecutions(executions) {
  return executions.map(({ output, ...execution }) => execution);
}

function resumePendingResult(target, cwd, documents, requiredSnapshot) {
  let pending;
  try {
    pending = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw new GateUsageError(`cannot read pending Gate result: ${error.message}`);
  }
  if (!pending || pending.version !== 2
    || pending.definition_fingerprint !== gateDefinitionFingerprint(documents)
    || JSON.stringify(pending.required_snapshot) !== JSON.stringify(requiredSnapshot)
    || !Array.isArray(pending.rendered) || !Array.isArray(pending.executions)) {
    throw new GateUsageError('pending Gate result does not match the frozen Gate definitions');
  }
  const current = workspaceFingerprint(cwd);
  if (current !== pending.workspace_fingerprint) {
    fs.rmSync(target, { force: true });
    return null;
  }
  if (pending.rendered.length !== documents.length) {
    throw new GateUsageError('pending Gate result has an invalid document count');
  }
  const resumed = pending.rendered.map((content, index) => {
    if (typeof content !== 'string') throw new GateUsageError('pending Gate result is malformed');
    const document = parseGateDocument(content, documents[index].filePath);
    document.originalContent = documents[index].originalContent;
    return document;
  });
  writeGateDocuments(resumed);
  fs.rmSync(target, { force: true });
  return {
    documents: resumed,
    executions: pending.executions.map((execution) => ({ ...execution, resumed: true })),
    status: summarizeGateStatus(resumed),
  };
}

function ensureDirectory(directory) {
  const resolved = path.resolve(directory);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (error) {
    throw new GateUsageError('checkout root does not exist: ' + resolved);
  }
  if (!stat.isDirectory()) {
    throw new GateUsageError('checkout root is not a directory: ' + resolved);
  }
  return resolved;
}

function normalizeRequiredSnapshot(value) {
  if (value === undefined) return null;
  try {
    return parseRequiredPaths(JSON.stringify(value), 'required product snapshot');
  } catch (error) {
    throw new GateUsageError(error.message);
  }
}

function evaluateGate(cwd, gate, timeout, requiredSnapshot = null) {
  const before = workspaceFingerprint(cwd);
  const available = gate.requires.length > 0
    ? (requiredSnapshot === null ? stagedProductPaths(cwd) : requiredSnapshot)
    : [];
  const missing = available === null
    ? gate.requires
    : gate.requires.filter((required) => !available.includes(required));
  if (missing.length === 0 && before !== null && gate.checked
    && evidenceFingerprint(gate.evidence) === before) {
    return {
      passed: true,
      skipped: true,
      reason: 'unchanged-snapshot',
      snapshot: before,
      evidence: gate.evidence,
    };
  }
  let result = missing.length > 0
    ? {
      passed: false,
      timedOut: false,
      status: null,
      signal: null,
      output: '',
      evidence: available === null
        ? 'fail: REQUIRES needs a Git worktree'
        : `fail: required ${requiredSnapshot === null ? 'staged' : 'review-range'} paths missing: ${missing.join(', ')}`,
    }
    : executeGate(gate, { cwd, timeout });
  const after = workspaceFingerprint(cwd);
  if (before !== null && after !== before) {
    result = {
      ...result,
      passed: false,
      evidence: 'fail: verification changed product snapshot',
    };
  }
  if (after !== null) result = bindEvidence(result, after);
  return result;
}

function runGateFiles(filePaths, options) {
  const cwd = ensureDirectory(options.cwd);
  const timeout = options.timeout === undefined ? DEFAULT_TIMEOUT_MS : options.timeout;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new GateUsageError('--timeout must be a positive integer in milliseconds');
  }

  const requiredSnapshot = normalizeRequiredSnapshot(options.requiredPaths);
  const documents = loadGateFiles(filePaths);
  const pendingPath = pendingResultPath(cwd, filePaths);
  const resumed = resumePendingResult(pendingPath, cwd, documents, requiredSnapshot);
  if (resumed) return resumed;
  const executions = [];

  for (const document of documents) {
    for (const gate of document.gates) {
      if (gate.abandonedReason !== null) {
        executions.push({ filePath: document.filePath, id: gate.id, skipped: true });
        continue;
      }
      const result = evaluateGate(cwd, gate, timeout, requiredSnapshot);
      if (result.skipped) {
        executions.push({ filePath: document.filePath, id: gate.id, ...result });
        continue;
      }
      applyGateResult(document, gate, result);
      executions.push({ filePath: document.filePath, id: gate.id, skipped: false, ...result });
    }
  }

  try {
    writeGateDocuments(documents);
  } catch (error) {
    try {
      writePendingResult(pendingPath, {
        version: 2,
        definition_fingerprint: gateDefinitionFingerprint(documents),
        required_snapshot: requiredSnapshot,
        workspace_fingerprint: workspaceFingerprint(cwd),
        rendered: documents.map(renderGateDocument),
        executions: compactPendingExecutions(executions),
      });
    } catch (journalError) {
      throw new GateParseError(`${error.message}; cannot preserve Gate result: ${journalError.message}`);
    }
    throw new GateParseError(`${error.message}; result preserved for the unchanged workspace snapshot`);
  }

  return { documents, executions, status: summarizeGateStatus(documents) };
}

function runFeedback(filePath, gateId, options) {
  const cwd = ensureDirectory(options.cwd);
  const timeout = options.timeout === undefined ? DEFAULT_TIMEOUT_MS : options.timeout;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new GateUsageError('--timeout must be a positive integer in milliseconds');
  }
  const document = parseGateFile(filePath);
  const gate = document.gates.find((candidate) => candidate.id === gateId);
  if (!gate) throw new GateUsageError(`unknown Gate item: ${gateId}`);
  if (gate.abandonedReason !== null) throw new GateUsageError(`${gateId} is abandoned`);
  if (gate.noCheck) throw new GateUsageError(`${gateId} has no command`);
  const result = evaluateGate(cwd, gate, timeout);
  if (!result.skipped) {
    applyGateResult(document, gate, result);
    writeGateDocuments([document]);
  }
  return result;
}

function statusGateFiles(filePaths) {
  const documents = loadGateFiles(filePaths);
  return { documents, status: summarizeGateStatus(documents) };
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith('..') ? relative : filePath;
}

function printStatus(summary) {
  for (const gate of summary.gates) {
    const reason = gate.status === 'abandoned' ? ' - ' + gate.abandonedReason : '';
    process.stdout.write(displayPath(gate.filePath) + ': ' + gate.id + ' ' + gate.status + reason + '\n');
  }
}

function usage(message) {
  if (message) process.stderr.write(message + '\n');
  process.stderr.write(
    'Usage:\n' +
    '  node run-gates.js run --cwd <checkout-root> [--timeout N] <file...>\n' +
    '  node run-gates.js feedback --cwd <checkout-root> [--timeout N] --gate <file> --id <G#>\n' +
    '  node run-gates.js status <file...>\n' +
    '  N is a positive timeout in milliseconds.\n'
  );
}

function parseFeedbackArguments(args) {
  let cwd = null;
  let timeout = DEFAULT_TIMEOUT_MS;
  let gate = null;
  let id = null;
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (value === undefined) throw new GateUsageError('feedback requires values for every option');
    if (name === '--cwd' && cwd === null) cwd = value;
    else if (name === '--timeout' && timeout === DEFAULT_TIMEOUT_MS && /^\d+$/.test(value)) {
      timeout = Number(value);
    } else if (name === '--gate' && gate === null) gate = value;
    else if (name === '--id' && id === null && /^G\d+$/.test(value)) id = value;
    else throw new GateUsageError('feedback accepts --cwd, optional --timeout, --gate, and --id');
  }
  if (!cwd || !gate || !id || !Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new GateUsageError('feedback requires --cwd, --gate, --id, and an optional positive --timeout');
  }
  return { cwd, timeout, gate, id };
}

function parseRunArguments(args) {
  let cwd = null;
  let timeout = DEFAULT_TIMEOUT_MS;
  let sawTimeout = false;
  const files = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--cwd') {
      if (cwd !== null) throw new GateUsageError('--cwd may be provided only once');
      if (index + 1 >= args.length) throw new GateUsageError('--cwd requires a checkout root');
      cwd = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === '--timeout') {
      if (sawTimeout) throw new GateUsageError('--timeout may be provided only once');
      if (index + 1 >= args.length) throw new GateUsageError('--timeout requires a value');
      const value = args[index + 1];
      if (!/^\d+$/.test(value)) {
        throw new GateUsageError('--timeout must be a positive integer in milliseconds');
      }
      timeout = Number(value);
      if (!Number.isSafeInteger(timeout) || timeout <= 0) {
        throw new GateUsageError('--timeout must be a positive integer in milliseconds');
      }
      sawTimeout = true;
      index += 1;
      continue;
    }
    if (argument.startsWith('--')) {
      throw new GateUsageError('unknown option: ' + argument);
    }
    files.push(argument);
  }

  if (cwd === null) throw new GateUsageError('run requires --cwd <checkout-root>');
  if (files.length === 0) throw new GateUsageError('run requires at least one Gate file');
  return { cwd, timeout, files };
}

function main(argv) {
  const args = argv || process.argv.slice(2);
  const action = args[0];

  try {
    if (action === 'run') {
      const options = parseRunArguments(args.slice(1));
      const result = runGateFiles(options.files, options);
      printStatus(result.status);
      return result.status.exitCode;
    }
    if (action === 'feedback') {
      const options = parseFeedbackArguments(args.slice(1));
      const result = runFeedback(options.gate, options.id, options);
      process.stdout.write(`${result.evidence}\n`);
      return result.passed ? 0 : 1;
    }
    if (action === 'status') {
      const files = args.slice(1);
      if (files.length === 0) throw new GateUsageError('status requires at least one Gate file');
      if (files.some((file) => file.startsWith('--'))) {
        throw new GateUsageError('status accepts only Gate file paths');
      }
      const result = statusGateFiles(files);
      printStatus(result.status);
      return result.status.exitCode;
    }

    throw new GateUsageError(action ? 'unknown action: ' + action : 'an action is required');
  } catch (error) {
    if (error instanceof GateUsageError || error instanceof GateParseError) {
      usage(error.message);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {
  DEFAULT_TIMEOUT_MS,
  EVIDENCE_LIMIT,
  GateParseError,
  GateUsageError,
  gateStatus,
  parseCheckArgv,
  parseRequiredPaths,
  loadGateFiles,
  main,
  parseExpectation,
  parseGateDocument,
  parseGateFile,
  pendingResultPath,
  renderGateDocument,
  runFeedback,
  runGateFiles,
  statusGateFiles,
  summarizeGateStatus,
  stagedProductPaths,
  workspaceFingerprint,
};
