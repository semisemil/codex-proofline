'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const issueCli = path.join(repoRoot, 'skills', 'issue-ledger', 'scripts', 'issue-ledger.js');
const registerCli = path.join(repoRoot, 'dashboard', 'register-project.js');
const { getRegistryPath } = require('../dashboard/registry.js');

function makeFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-writer-'));
  const projectRoot = path.join(root, 'project');
  const issuesRoot = path.join(projectRoot, '.proofline', 'issues');
  const configRoot = path.join(root, 'config');
  fs.mkdirSync(issuesRoot, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = process.platform === 'win32'
    ? { ...process.env, APPDATA: configRoot }
    : { ...process.env, XDG_CONFIG_HOME: configRoot };
  return { root, projectRoot, issuesRoot, configRoot, env };
}

function makeIssue() {
  return {
    schema_version: 2,
    identity: {
      id: 'PL-0001', aliases: [], type: 'task', mode: 'simple', title: '등록 테스트', risk: 'low'
    },
    origin: { kind: 'request', summary: 'writer 등록 검증', refs: [] },
    state: { status: 'open', current_summary: '작성 대기', next_action: '작성한다' },
    objective: { summary: '성공한 쓰기 뒤 프로젝트 등록', constraints: [] },
    criteria: [{ id: 'C1', text: '프로젝트가 등록된다', evidence_refs: [] }],
    relations: [], context: [], artifacts: [], evidence: [], events: [],
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z'
  };
}

function runIssue(args, env) {
  return spawnSync(process.execPath, [issueCli, ...args], { encoding: 'utf8', env });
}

function runRegister(projectRoot, env) {
  return spawnSync(process.execPath, [
    registerCli,
    'register',
    '--project-root',
    projectRoot
  ], { encoding: 'utf8', env });
}

const documentWriters = [
  {
    label: 'Plan',
    skill: 'skills/development-plan/SKILL.md',
    relativePath: '.proofline/plan/PLAN-0001-example/PLAN.md',
    content: '---\nid: PLAN-0001\ntitle: 예시 Plan\nstatus: ready\n---\n\n# 예시 Plan\n'
  },
  {
    label: 'Spec',
    skill: 'skills/implementation-spec/SKILL.md',
    relativePath: '.proofline/specs/SPEC-0001-example/SPEC.md',
    content: `---\n${JSON.stringify({
      schema_version: 2,
      id: 'SPEC-0001',
      title: '예시 Spec',
      kind: 'feature',
      status: 'ready',
      revision: 1,
      supersedes: [],
      superseded_by: null,
      related_issues: []
    }, null, 2)}\n---\n\n# 예시 Spec\n`
  }
];

function executeDocumentWriter(fixture, writer, content = writer.content) {
  const target = path.join(fixture.projectRoot, writer.relativePath);
  let existing = null;
  try {
    existing = fs.readFileSync(target, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      return {
        writeStatus: 'write-failed', writeAttempted: false, writeError: error, registration: null, target
      };
    }
  }
  if (existing === content) {
    return { writeStatus: 'no-op', writeAttempted: false, registration: null, target };
  }
  let writeAttempted = false;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeAttempted = true;
    fs.writeFileSync(target, content, 'utf8');
  } catch (error) {
    return { writeStatus: 'write-failed', writeAttempted, writeError: error, registration: null, target };
  }
  return {
    writeStatus: 'written',
    writeAttempted,
    registration: runRegister(fixture.projectRoot, fixture.env),
    target
  };
}

test('Issue create registers only after the file write succeeds', (t) => {
  const fixture = makeFixture(t);
  const input = path.join(fixture.root, 'issue.json');
  fs.writeFileSync(input, JSON.stringify(makeIssue()), 'utf8');
  const result = runIssue(['create', '--input', input, '--root', fixture.issuesRoot], fixture.env);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(fixture.issuesRoot, 'PL-0001.json')), true);
  assert.match(result.stderr, /registration: .*"status":"registered"/);
  const registry = JSON.parse(fs.readFileSync(getRegistryPath({ env: fixture.env }), 'utf8'));
  assert.equal(registry.projects.length, 1);
  assert.equal(registry.projects[0].root, fs.realpathSync(fixture.projectRoot));
});

test('Issue write failure does not register the project', (t) => {
  const fixture = makeFixture(t);
  const input = path.join(fixture.root, 'issue.json');
  const issue = makeIssue();
  issue.identity.id = `PL-${'1'.repeat(300)}`;
  fs.writeFileSync(input, JSON.stringify(issue), 'utf8');
  const result = runIssue(['create', '--input', input, '--root', fixture.issuesRoot], fixture.env);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT|ENAMETOOLONG|name too long|filename or extension is too long/i);
  assert.match(result.stderr, /at writeV2Issue/);
  assert.equal(fs.existsSync(getRegistryPath({ env: fixture.env })), false);
  assert.equal(fs.readdirSync(fixture.issuesRoot).length, 0);
});

test('registration failure stays separate from a successful Issue write', (t) => {
  const fixture = makeFixture(t);
  const input = path.join(fixture.root, 'issue.json');
  const registryPath = getRegistryPath({ env: fixture.env });
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, '{bad json', 'utf8');
  fs.writeFileSync(input, JSON.stringify(makeIssue()), 'utf8');

  const result = runIssue(['create', '--input', input, '--root', fixture.issuesRoot], fixture.env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(fixture.issuesRoot, 'PL-0001.json')), true);
  assert.match(result.stderr, /registration-failed: .*"code":"registry-invalid"/);
  assert.equal(fs.readFileSync(registryPath, 'utf8'), '{bad json');
});

test('Issue link-work no-op does not register or rewrite', (t) => {
  const fixture = makeFixture(t);
  const issue = makeIssue();
  issue.state.current_summary = 'Spec 연결됨';
  issue.state.next_action = '구현한다';
  issue.context = [{ kind: 'Spec', location: '.proofline/specs/SPEC-0001-example/SPEC.md' }];
  const issuePath = path.join(fixture.issuesRoot, 'PL-0001.json');
  const specPath = path.join(fixture.projectRoot, '.proofline', 'specs', 'SPEC-0001-example', 'SPEC.md');
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(issuePath, `${JSON.stringify(issue, null, 2)}\n`, 'utf8');
  fs.writeFileSync(specPath, `---\n${JSON.stringify({
    schema_version: 2,
    id: 'SPEC-0001',
    title: '예시',
    kind: 'feature',
    status: 'ready',
    revision: 1,
    supersedes: [],
    superseded_by: null,
    related_issues: ['PL-0001']
  }, null, 2)}\n---\n`, 'utf8');
  const before = fs.readFileSync(issuePath, 'utf8');

  const result = runIssue([
    'link-work', 'PL-0001', '--kind', 'spec', '--work-id', 'SPEC-0001',
    '--path', '.proofline/specs/SPEC-0001-example/SPEC.md',
    '--current-summary', 'Spec 연결됨', '--next-action', '구현한다',
    '--updated-at', '2026-08-17T01:00:00.000Z', '--root', fixture.issuesRoot,
    '--project-root', fixture.projectRoot
  ], fixture.env);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^no-op:/);
  assert.equal(fs.readFileSync(issuePath, 'utf8'), before);
  assert.equal(fs.existsSync(getRegistryPath({ env: fixture.env })), false);
});

test('Issue writer executes the shared register command instead of the registry module', () => {
  const content = fs.readFileSync(issueCli, 'utf8');
  assert.match(content, /register-project\.js/);
  assert.match(content, /spawnSync\(process\.execPath/);
  assert.doesNotMatch(content, /require\(['"]\.\.\/\.\.\/\.\.\/dashboard\/registry\.js['"]\)/);
});

for (const writer of documentWriters) {
  test(`${writer.label} successful write executes the shared register command`, (t) => {
    const fixture = makeFixture(t);
    const result = executeDocumentWriter(fixture, writer);
    assert.equal(result.writeStatus, 'written');
    assert.equal(result.registration.status, 0, result.registration.stderr);
    assert.equal(JSON.parse(result.registration.stdout).status, 'registered');
    assert.equal(fs.readFileSync(result.target, 'utf8'), writer.content);
    const registry = JSON.parse(fs.readFileSync(getRegistryPath({ env: fixture.env }), 'utf8'));
    assert.equal(registry.projects.length, 1);
    assert.equal(registry.projects[0].root, fs.realpathSync(fixture.projectRoot));
  });

  test(`${writer.label} no-op neither rewrites nor registers`, (t) => {
    const fixture = makeFixture(t);
    const target = path.join(fixture.projectRoot, writer.relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, writer.content, 'utf8');
    const before = fs.statSync(target).mtimeMs;
    const result = executeDocumentWriter(fixture, writer);
    assert.equal(result.writeStatus, 'no-op');
    assert.equal(result.writeAttempted, false);
    assert.equal(result.registration, null);
    assert.equal(fs.statSync(target).mtimeMs, before);
    assert.equal(fs.existsSync(getRegistryPath({ env: fixture.env })), false);
  });

  test(`${writer.label} filesystem write failure does not register`, (t) => {
    const fixture = makeFixture(t);
    const failingWriter = {
      ...writer,
      relativePath: path.join(path.dirname(writer.relativePath), `${'x'.repeat(300)}.md`)
    };
    const result = executeDocumentWriter(fixture, failingWriter);
    assert.equal(result.writeStatus, 'write-failed');
    assert.equal(result.writeAttempted, true);
    assert.ok(result.writeError);
    assert.equal(result.registration, null);
    assert.equal(fs.existsSync(getRegistryPath({ env: fixture.env })), false);
  });

  test(`${writer.label} registration failure preserves the successful document write`, (t) => {
    const fixture = makeFixture(t);
    const registryPath = getRegistryPath({ env: fixture.env });
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, '{bad json', 'utf8');
    const result = executeDocumentWriter(fixture, writer);
    assert.equal(result.writeStatus, 'written');
    assert.equal(result.registration.status, 1);
    assert.equal(JSON.parse(result.registration.stderr).error.code, 'registry-invalid');
    assert.equal(fs.readFileSync(result.target, 'utf8'), writer.content);
    assert.equal(fs.readFileSync(registryPath, 'utf8'), '{bad json');
  });

  test(`${writer.label} skill wires the executed shared command and result separation`, () => {
    const content = fs.readFileSync(path.join(repoRoot, writer.skill), 'utf8');
    assert.match(content, /dashboard\/register-project\.js register --project-root <absolute-project-root>/);
    assert.match(content, /Do not run it for reads, review, `no-op`, or failed writes/);
    assert.match(content, /registration failure does not change or roll back the completed/);
  });
}
