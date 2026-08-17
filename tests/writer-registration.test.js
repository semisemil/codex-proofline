'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const issueCli = path.join(repoRoot, 'skills', 'issue-ledger', 'scripts', 'issue-ledger.js');
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
  const input = path.join(fixture.root, 'invalid.json');
  fs.writeFileSync(input, JSON.stringify({ schema_version: 2 }), 'utf8');
  const result = runIssue(['create', '--input', input, '--root', fixture.issuesRoot], fixture.env);

  assert.equal(result.status, 1);
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

test('Plan and Spec writer contracts use the shared command only after successful writes', () => {
  for (const relativePath of [
    'skills/development-plan/SKILL.md',
    'skills/implementation-spec/SKILL.md'
  ]) {
    const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    assert.match(content, /dashboard\/register-project\.js register --project-root <absolute-project-root>/);
    assert.match(content, /Do not run it for reads, review, `no-op`, or failed writes/);
    assert.match(content, /registration failure does not change or roll back the completed/);
  }
});
