#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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
  if (!lines[2] || lines[2].text.trim() !== '') {
    parseFailure(label, 2, 'a blank line is required after Scope');
  }

  const gates = [];
  const gateIds = new Set();
  const abandonments = new Map();
  let abandonmentsStarted = false;
  let index = 3;

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
      const checkMatch = lines[index] && lines[index].text.match(/^  CHECK: (.+)$/);
      if (!checkMatch || checkMatch[1].trim().length === 0) {
        parseFailure(label, index, id + ': CHECK is required');
      }
      const check = checkMatch[1].trim();
      if (isManualCheck(check)) {
        parseFailure(label, index, id + ': manual gates are not supported');
      }

      index += 1;
      let expect = null;
      if (lines[index] && lines[index].text.startsWith('  EXPECT:')) {
        const expectMatch = lines[index].text.match(/^  EXPECT: (.*)$/);
        if (!expectMatch) {
          parseFailure(label, index, id + ': EXPECT must be "  EXPECT: <substring or /regex/flags>"');
        }
        expect = parseExpectation(expectMatch[1], label + ':' + (index + 1));
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
        expect,
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
    parseFailure(label, 3, 'at least one Gate is required');
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
    allMet: gates.length > 0 && counts.unmet === 0 && counts.abandoned === 0,
    counts,
    gates,
    exitCode: gates.length > 0 && counts.unmet === 0 && counts.abandoned === 0 ? 0 : 1,
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
  const shortDecision = capHead(collapseText(decision), 80);
  const shortOutput = collapseText(output);
  if (shortOutput.length === 0) return capHead(shortDecision, EVIDENCE_LIMIT);

  const separator = '; tail: ';
  const available = EVIDENCE_LIMIT - shortDecision.length - separator.length;
  if (available <= 0) return capHead(shortDecision, EVIDENCE_LIMIT);
  return shortDecision + separator + capTail(shortOutput, available);
}

function executeGate(gate, options) {
  let result;
  let thrown = null;
  try {
    result = spawnSync(gate.check, {
      shell: true,
      cwd: options.cwd,
      timeout: options.timeout,
      encoding: 'utf8',
      windowsHide: true,
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

function runGateFiles(filePaths, options) {
  const cwd = ensureDirectory(options.cwd);
  const timeout = options.timeout === undefined ? DEFAULT_TIMEOUT_MS : options.timeout;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new GateUsageError('--timeout must be a positive integer in milliseconds');
  }

  const documents = loadGateFiles(filePaths);
  const executions = [];

  for (const document of documents) {
    for (const gate of document.gates) {
      if (gate.abandonedReason !== null) {
        executions.push({ filePath: document.filePath, id: gate.id, skipped: true });
        continue;
      }
      const result = executeGate(gate, { cwd, timeout });
      applyGateResult(document, gate, result);
      executions.push({ filePath: document.filePath, id: gate.id, skipped: false, ...result });
    }
  }

  for (const document of documents) {
    const rendered = renderGateDocument(document);
    if (rendered === document.originalContent) continue;
    try {
      fs.writeFileSync(document.filePath, rendered, 'utf8');
    } catch (error) {
      throw new GateParseError(document.filePath + ': cannot write Gate file: ' + error.message);
    }
  }

  return { documents, executions, status: summarizeGateStatus(documents) };
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
    '  node run-gates.js status <file...>\n' +
    '  N is a positive timeout in milliseconds.\n'
  );
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
  loadGateFiles,
  main,
  parseExpectation,
  parseGateDocument,
  parseGateFile,
  renderGateDocument,
  runGateFiles,
  statusGateFiles,
  summarizeGateStatus,
};
