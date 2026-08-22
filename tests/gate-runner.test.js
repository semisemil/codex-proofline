'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const scriptPath = path.join(repoRoot, 'skills', 'spec-slice', 'scripts', 'run-gates.js');
const templatePath = path.join(repoRoot, 'skills', 'spec-slice', 'assets', 'templates', 'gates.md');
const {
  EVIDENCE_LIMIT,
  gateStatus,
  parseGateDocument,
  summarizeGateStatus,
} = require(scriptPath);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-gates-'));
  t.after(() => fs.rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 30,
  }));
  return root;
}

function shellArgument(value) {
  if (process.platform === 'win32') return '"' + value.replace(/"/g, '""') + '"';
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function helperCommand(root, name, body) {
  const helper = path.join(root, name + '.js');
  fs.writeFileSync(helper, "'use strict';\n" + body + '\n', 'utf8');
  return {
    command: shellArgument(process.execPath) + ' ' + shellArgument(helper),
    path: helper,
  };
}

function gateDocument(gates, options) {
  const settings = options || {};
  const eol = settings.eol || '\n';
  const lines = [
    '# Gates: ' + (settings.scope || 'test'),
    'Scope: ' + (settings.scopeLine || 'gate runner test'),
    '',
  ];

  for (const gate of gates) {
    lines.push('- [' + (gate.checked ? 'x' : ' ') + '] ' + gate.id + ': ' + (gate.outcome || 'outcome'));
    lines.push('  CHECK: ' + gate.check);
    if (gate.expect !== undefined) lines.push('  EXPECT: ' + gate.expect);
    lines.push('  EVIDENCE: ' + (gate.evidence || 'pending'));
    lines.push('');
  }

  for (const abandonment of settings.abandons || []) {
    lines.push('ABANDON: ' + abandonment.id + ' ' + abandonment.reason);
  }
  return lines.join(eol) + eol;
}

function writeGates(root, content, name) {
  const filePath = path.join(root, name || 'GATES.md');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: cwd || repoRoot,
    encoding: 'utf8',
  });
}

function readGate(filePath, id) {
  const document = parseGateDocument(fs.readFileSync(filePath, 'utf8'), filePath);
  return document.gates.find((gate) => gate.id === id);
}

test('template uses the exact flat Gate format and placeholders', () => {
  const template = fs.readFileSync(templatePath, 'utf8');
  assert.equal(template, [
    '# Gates: {{scope}}',
    'Scope: {{scope_line}}',
    '',
    '- [ ] G1: {{outcome}}',
    '  CHECK: {{command}}',
    '{{expect_line}}',
    '  EVIDENCE: pending',
    '',
  ].join('\n'));
  assert.doesNotMatch(template, /^  - (?:CHECK|EXPECT|EVIDENCE):/m);
  assert.doesNotMatch(template, /^ABANDON:/m);
});

test('exit-code Gate passes on exit 0 and status reports it met', (t) => {
  const root = fixture(t);
  const helper = helperCommand(root, 'pass', "process.stdout.write('finished');");
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: helper.command },
  ]));

  const run = runCli(['run', '--cwd', root, filePath]);
  assert.equal(run.status, 0, run.stderr);

  const gate = readGate(filePath, 'G1');
  assert.equal(gate.checked, true);
  assert.match(gate.evidence, /^pass: exit 0/);
  assert.match(gate.evidence, /finished$/);

  const status = runCli(['status', filePath]);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /G1 met/);
});

test('EXPECT match passes even when the process exits nonzero', (t) => {
  const root = fixture(t);
  const helper = helperCommand(
    root,
    'expected-nonzero',
    "process.stdout.write('release ready'); process.exitCode = 7;"
  );
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: helper.command, expect: 'ready' },
  ]));

  const run = runCli(['run', '--cwd', root, filePath]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(readGate(filePath, 'G1').checked, true);
  assert.match(readGate(filePath, 'G1').evidence, /^pass: EXPECT matched/);
});

test('substring and regex EXPECT match combined stdout and stderr', (t) => {
  const root = fixture(t);
  const substring = helperCommand(
    root,
    'substring',
    "process.stdout.write('alpha-ready'); process.exitCode = 3;"
  );
  const regex = helperCommand(
    root,
    'regex',
    "process.stderr.write('BUILD READY 42'); process.exitCode = 9;"
  );
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: substring.command, expect: 'ready' },
    { id: 'G2', check: regex.command, expect: '/build\\s+ready\\s+\\d+/i' },
  ]));

  const run = runCli(['run', '--cwd', root, filePath]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(readGate(filePath, 'G1').checked, true);
  assert.equal(readGate(filePath, 'G2').checked, true);
});

test('rerun executes a checked Gate again and unchecks a regression', (t) => {
  const root = fixture(t);
  const helper = helperCommand(root, 'rerun', "process.stdout.write('first pass');");
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: helper.command },
  ]));

  const first = runCli(['run', '--cwd', root, filePath]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(readGate(filePath, 'G1').checked, true);

  fs.writeFileSync(
    helper.path,
    "'use strict';\nprocess.stderr.write('regression-tail'); process.exitCode = 5;\n",
    'utf8'
  );
  const second = runCli(['run', '--cwd', root, filePath]);
  assert.equal(second.status, 1, second.stderr);

  const gate = readGate(filePath, 'G1');
  assert.equal(gate.checked, false);
  assert.match(gate.evidence, /^fail: exit 5/);
  assert.match(gate.evidence, /regression-tail$/);
});

test('run attempts every non-abandoned CHECK even when an earlier Gate fails', (t) => {
  const root = fixture(t);
  const firstMarker = path.join(root, 'first-ran');
  const secondMarker = path.join(root, 'second-ran');
  const first = helperCommand(
    root,
    'first',
    'require("node:fs").writeFileSync(' + JSON.stringify(firstMarker) + ', "yes"); process.exitCode = 1;'
  );
  const second = helperCommand(
    root,
    'second',
    'require("node:fs").writeFileSync(' + JSON.stringify(secondMarker) + ', "yes");'
  );
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: first.command },
    { id: 'G2', check: second.command },
  ]));

  const run = runCli(['run', '--cwd', root, filePath]);
  assert.equal(run.status, 1, run.stderr);
  assert.equal(fs.existsSync(firstMarker), true);
  assert.equal(fs.existsSync(secondMarker), true);
  assert.equal(readGate(filePath, 'G1').checked, false);
  assert.equal(readGate(filePath, 'G2').checked, true);
});

test('status executes no command and makes no file change', (t) => {
  const root = fixture(t);
  const marker = path.join(root, 'status-must-not-run');
  const helper = helperCommand(
    root,
    'status',
    'require("node:fs").writeFileSync(' + JSON.stringify(marker) + ', "ran"); process.exitCode = 1;'
  );
  const filePath = writeGates(root, gateDocument([
    {
      id: 'G1',
      check: helper.command,
      checked: true,
      evidence: 'pass: prior decision',
    },
  ]));
  const before = fs.readFileSync(filePath);

  const status = runCli(['status', filePath]);
  assert.equal(status.status, 0, status.stderr);
  assert.equal(fs.existsSync(marker), false);
  assert.deepEqual(fs.readFileSync(filePath), before);
});

test('checked Gate with pending evidence remains unmet', (t) => {
  const root = fixture(t);
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: 'unused-command', checked: true, evidence: 'pending' },
  ]));

  const status = runCli(['status', filePath]);
  assert.equal(status.status, 1, status.stderr);
  assert.match(status.stdout, /G1 unmet/);

  const document = parseGateDocument(fs.readFileSync(filePath, 'utf8'), filePath);
  assert.equal(gateStatus(document.gates[0]), 'unmet');
  assert.equal(summarizeGateStatus([document]).allMet, false);
});

test('ABANDON skips the CHECK but remains incomplete with exit 1', (t) => {
  const root = fixture(t);
  const marker = path.join(root, 'abandoned-must-not-run');
  const helper = helperCommand(
    root,
    'abandoned',
    'require("node:fs").writeFileSync(' + JSON.stringify(marker) + ', "ran");'
  );
  const filePath = writeGates(root, gateDocument(
    [{ id: 'G1', check: helper.command }],
    { abandons: [{ id: 'G1', reason: 'superseded' }] }
  ));
  const before = fs.readFileSync(filePath);

  const run = runCli(['run', '--cwd', root, filePath]);
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stdout, /G1 abandoned - superseded/);
  assert.equal(fs.existsSync(marker), false);
  assert.deepEqual(fs.readFileSync(filePath), before);
});

test('malformed, manual, invalid regex, duplicate, and unknown ABANDON return exit 2', async (t) => {
  const root = fixture(t);
  const cases = [
    {
      name: 'malformed',
      content: [
        '# Gates: test',
        'Scope: malformed',
        '',
        '- [ ] G1: missing evidence',
        '  CHECK: echo ok',
        '',
      ].join('\n'),
      message: /EVIDENCE is required/,
    },
    {
      name: 'manual',
      content: gateDocument([{ id: 'G1', check: 'manual: inspect the UI' }]),
      message: /manual gates are not supported/,
    },
    {
      name: 'invalid-regex',
      content: gateDocument([{ id: 'G1', check: 'echo ok', expect: '/(/' }]),
      message: /invalid EXPECT regex/,
    },
    {
      name: 'duplicate',
      content: gateDocument([
        { id: 'G1', check: 'echo first' },
        { id: 'G1', check: 'echo second' },
      ]),
      message: /duplicate Gate ID/,
    },
    {
      name: 'unknown-abandon',
      content: gateDocument(
        [{ id: 'G1', check: 'echo ok' }],
        { abandons: [{ id: 'G2', reason: 'unknown' }] }
      ),
      message: /unknown ABANDON Gate ID G2/,
    },
  ];

  for (const item of cases) {
    await t.test(item.name, () => {
      const filePath = writeGates(root, item.content, item.name + '.md');
      const run = runCli(['run', '--cwd', root, filePath]);
      assert.equal(run.status, 2);
      assert.match(run.stderr, item.message);
    });
  }
});

test('Gate IDs are local to each file and both G1 checks run and update', (t) => {
  const root = fixture(t);
  const firstMarker = path.join(root, 'first-local-g1-ran');
  const secondMarker = path.join(root, 'second-local-g1-ran');
  const firstHelper = helperCommand(
    root,
    'first-local-g1',
    'require("node:fs").writeFileSync(' + JSON.stringify(firstMarker) +
      ', "ran"); process.stdout.write("first-local");'
  );
  const secondHelper = helperCommand(
    root,
    'second-local-g1',
    'require("node:fs").writeFileSync(' + JSON.stringify(secondMarker) +
      ', "ran"); process.stdout.write("second-local");'
  );
  const first = writeGates(root, gateDocument([{ id: 'G1', check: firstHelper.command }]), 'one.md');
  const second = writeGates(root, gateDocument([{ id: 'G1', check: secondHelper.command }]), 'two.md');

  const run = runCli(['run', '--cwd', root, first, second]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(fs.existsSync(firstMarker), true);
  assert.equal(fs.existsSync(secondMarker), true);

  const firstGate = readGate(first, 'G1');
  const secondGate = readGate(second, 'G1');
  assert.equal(firstGate.checked, true);
  assert.equal(secondGate.checked, true);
  assert.match(firstGate.evidence, /first-local$/);
  assert.match(secondGate.evidence, /second-local$/);
});

test('timeout fails and records concise timeout evidence', async (t) => {
  const root = fixture(t);
  const helper = helperCommand(
    root,
    'timeout',
    'const end = Date.now() + 200; while (Date.now() < end) {}'
  );
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: helper.command },
  ]));

  const run = runCli(['run', '--cwd', root, '--timeout', '50', filePath]);
  assert.equal(run.status, 1, run.stderr);
  const gate = readGate(filePath, 'G1');
  assert.equal(gate.checked, false);
  assert.match(gate.evidence, /^fail: timeout 50ms/);

  if (process.platform === 'win32') {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
});

test('timeout option requires positive milliseconds', (t) => {
  const root = fixture(t);
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: 'unused-command' },
  ]));

  const run = runCli(['run', '--cwd', root, '--timeout', '0', filePath]);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /positive integer in milliseconds/);
});

test('evidence is capped and keeps the decision output tail', (t) => {
  const root = fixture(t);
  const helper = helperCommand(
    root,
    'large-output',
    "process.stderr.write('A'.repeat(5000) + 'TAIL-MARKER'); process.exitCode = 4;"
  );
  const filePath = writeGates(root, gateDocument([
    { id: 'G1', check: helper.command },
  ]));

  const run = runCli(['run', '--cwd', root, filePath]);
  assert.equal(run.status, 1, run.stderr);
  const evidence = readGate(filePath, 'G1').evidence;
  assert.ok(evidence.length <= EVIDENCE_LIMIT, evidence.length);
  assert.match(evidence, /^fail: exit 4; tail: /);
  assert.match(evidence, /TAIL-MARKER$/);
});

test('run preserves CRLF line endings', (t) => {
  const root = fixture(t);
  const helper = helperCommand(root, 'crlf', "process.stdout.write('ok');");
  const original = gateDocument(
    [{ id: 'G1', check: helper.command }],
    { eol: '\r\n' }
  );
  const filePath = writeGates(root, original);
  const beforeCount = (original.match(/\r\n/g) || []).length;

  const run = runCli(['run', '--cwd', root, filePath]);
  assert.equal(run.status, 0, run.stderr);

  const updated = fs.readFileSync(filePath, 'utf8');
  assert.equal((updated.match(/\r\n/g) || []).length, beforeCount);
  assert.equal(updated.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(updated.endsWith('\r\n'), true);
});
