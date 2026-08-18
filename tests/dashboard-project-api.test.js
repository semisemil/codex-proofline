'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  SECURITY_HEADERS,
  createDashboardHttpServer,
} = require('../dashboard/server.js');
const { ProjectIndexService } = require('../dashboard/records/project-index.js');
const { MAX_RECORD_BYTES } = require('../dashboard/records/record-parser.js');

const AVAILABLE_ID = '11111111-1111-4111-8111-111111111111';
const UNAVAILABLE_ID = '22222222-2222-4222-8222-222222222222';
const INSTANCE_ID = '33333333-3333-4333-8333-333333333333';
const SECOND_AVAILABLE_ID = '44444444-4444-4444-8444-444444444444';

function makeIssue() {
  return {
    schema_version: 2,
    identity: { id: 'PL-0001', aliases: [], type: 'task', mode: 'simple', title: 'API', risk: 'low' },
    origin: { kind: 'request', summary: 'API', refs: [] },
    state: { status: 'open', current_summary: '대기', next_action: '구현' },
    objective: { summary: 'API 제공', constraints: [] },
    criteria: [{ id: 'C1', text: '응답한다.', evidence_refs: [] }],
    milestones: [], relations: [], context: [], artifacts: [], evidence: [], events: [],
    created_at: '2026-08-17T00:00:00.000Z',
    updated_at: '2026-08-17T00:00:00.000Z',
  };
}

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-project-api-'));
  const availableRoot = path.join(root, 'available');
  const unavailableRoot = path.join(root, 'missing');
  const issues = path.join(availableRoot, '.proofline', 'issues');
  fs.mkdirSync(issues, { recursive: true });
  fs.writeFileSync(path.join(issues, 'PL-0001.json'), JSON.stringify(makeIssue()), 'utf8');

  const registryPath = path.join(root, 'config', 'projects.json');
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify({
    schema_version: 1,
    projects: [
      { id: AVAILABLE_ID, root: availableRoot, registered_at: '2026-08-17T00:00:00.000Z' },
      { id: UNAVAILABLE_ID, root: unavailableRoot, registered_at: '2026-08-17T00:01:00.000Z' },
    ],
  }), 'utf8');

  const projectService = new ProjectIndexService({
    registryOptions: { registryPath },
    now: () => '2026-08-18T00:00:00.000Z',
  });
  const server = createDashboardHttpServer({
    instanceId: INSTANCE_ID,
    version: '0.6.2',
    projectService,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { availableRoot, projectService, root, registryPath, server };
}

function rawRequest(server, bytes) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => socket.write(bytes));
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    socket.on('error', reject);
  });
}

function linkExternalFile(externalFile, targetFile) {
  try {
    fs.symlinkSync(externalFile, targetFile, 'file');
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') {
      throw error;
    }
    fs.rmSync(path.dirname(targetFile), { recursive: true, force: true });
    fs.symlinkSync(
      path.dirname(externalFile),
      path.dirname(targetFile),
      'junction',
    );
  }
}

function request(server, values = {}) {
  const address = server.address();
  const expectedHost = `127.0.0.1:${address.port}`;
  return new Promise((resolve, reject) => {
    const call = http.request({
      host: '127.0.0.1',
      port: address.port,
      method: values.method || 'GET',
      path: values.path || '/api/v1/health',
      headers: {
        Host: values.host === undefined ? expectedHost : values.host,
        ...(values.origin === undefined ? {} : { Origin: values.origin }),
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
        expectedOrigin: `http://${expectedHost}`,
      }));
    });
    call.once('error', reject);
    call.end();
  });
}

function pathKey(filePath) {
  const normalized = path.normalize(String(filePath));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

async function measureReadBytes(action) {
  const originalOpen = fs.openSync;
  const originalRead = fs.readSync;
  const originalClose = fs.closeSync;
  const originalAlloc = Buffer.alloc;
  const pathsByDescriptor = new Map();
  const bytesByPath = new Map();
  const allocatedSizes = [];
  fs.openSync = function measuredOpen(filePath, ...args) {
    const descriptor = originalOpen.call(fs, filePath, ...args);
    pathsByDescriptor.set(descriptor, pathKey(filePath));
    return descriptor;
  };
  fs.readSync = function measuredRead(descriptor, ...args) {
    const count = originalRead.call(fs, descriptor, ...args);
    const filePath = pathsByDescriptor.get(descriptor);
    if (filePath) {
      bytesByPath.set(filePath, (bytesByPath.get(filePath) || 0) + count);
    }
    return count;
  };
  fs.closeSync = function measuredClose(descriptor) {
    pathsByDescriptor.delete(descriptor);
    return originalClose.call(fs, descriptor);
  };
  Buffer.alloc = function measuredAlloc(size, ...args) {
    allocatedSizes.push(size);
    return originalAlloc(size, ...args);
  };
  try {
    return { result: await action(), allocatedSizes, bytesByPath };
  } finally {
    fs.openSync = originalOpen;
    fs.readSync = originalRead;
    fs.closeSync = originalClose;
    Buffer.alloc = originalAlloc;
  }
}

test('HTTP boundary enforces Host, Origin, methods, raw paths, security headers, and HEAD', async (t) => {
  const { server } = await fixture(t);
  const health = await request(server);
  assert.equal(health.status, 200);
  assert.equal(health.headers['content-security-policy'], SECURITY_HEADERS['Content-Security-Policy']);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal(health.headers['access-control-allow-origin'], undefined);

  assert.equal((await request(server, { host: 'localhost:1' })).status, 403);
  assert.equal((await request(server, { origin: 'https://example.com' })).status, 403);
  assert.equal((await request(server, { method: 'POST' })).status, 405);
  assert.equal((await request(server, {
    method: 'DELETE', path: `/api/v1/projects/${UNAVAILABLE_ID}`,
  })).status, 403);
  assert.equal((await request(server, {
    path: `/api/v1/projects/%252e%252e/documents/issue/PL-0001`,
  })).status, 400);

  const head = await request(server, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);
});

test('raw NUL request targets receive the JSON clientError boundary response', async (t) => {
  const { server } = await fixture(t);
  const { port } = server.address();
  const raw = await rawRequest(server, Buffer.concat([
    Buffer.from('GET /api/v1/proj', 'ascii'),
    Buffer.from([0]),
    Buffer.from(`ects HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\n\r\n`, 'ascii'),
  ]));
  const [headerText, body] = raw.split('\r\n\r\n');
  assert.match(headerText, /^HTTP\/1\.1 400 Bad Request\r\n/);
  assert.match(headerText, new RegExp(`Content-Security-Policy: ${SECURITY_HEADERS['Content-Security-Policy']}`));
  assert.match(headerText, /X-Content-Type-Options: nosniff/);
  assert.match(headerText, /Cache-Control: no-store/);
  assert.doesNotMatch(headerText, /Access-Control-Allow-Origin/i);
  assert.deepEqual(JSON.parse(body), {
    error: {
      code: 'request-target-invalid',
      message: '요청 경로가 올바르지 않습니다.',
    },
  });
});

test('raw ordinary HTTP without Host reaches the secured JSON Host boundary', async (t) => {
  const { server } = await fixture(t);
  const raw = await rawRequest(
    server,
    Buffer.from('GET /api/v1/health HTTP/1.1\r\n\r\n', 'ascii'),
  );
  const [headerText, body] = raw.split('\r\n\r\n');
  assert.match(headerText, /^HTTP\/1\.1 403 Forbidden\r\n/);
  assert.match(headerText, new RegExp(`Content-Security-Policy: ${SECURITY_HEADERS['Content-Security-Policy']}`));
  assert.match(headerText, /X-Content-Type-Options: nosniff/);
  assert.match(headerText, /Cache-Control: no-store/);
  assert.doesNotMatch(headerText, /Access-Control-Allow-Origin/i);
  assert.deepEqual(JSON.parse(body), {
    error: {
      code: 'host-forbidden',
      message: 'Host가 허용되지 않습니다.',
    },
  });
});

test('raw ordinary HTTP rejects duplicate Host fields before Origin and routing', async (t) => {
  const { server } = await fixture(t);
  const { port } = server.address();
  const raw = await rawRequest(
    server,
    Buffer.from([
      'GET /api/v1/health HTTP/1.1',
      `Host: 127.0.0.1:${port}`,
      'Host: evil.example',
      'Origin: https://invalid.example',
      '',
      '',
    ].join('\r\n'), 'ascii'),
  );
  const [headerText, body] = raw.split('\r\n\r\n');
  assert.match(headerText, /^HTTP\/1\.1 403 Forbidden\r\n/);
  assert.match(headerText, new RegExp(`Content-Security-Policy: ${SECURITY_HEADERS['Content-Security-Policy']}`));
  assert.match(headerText, /X-Content-Type-Options: nosniff/);
  assert.match(headerText, /Cache-Control: no-store/);
  assert.doesNotMatch(headerText, /Access-Control-Allow-Origin/i);
  assert.deepEqual(JSON.parse(body), {
    error: {
      code: 'host-forbidden',
      message: 'Host가 허용되지 않습니다.',
    },
  });
});

test('raw CONNECT shares Host and Origin validation before method rejection', async (t) => {
  const { server } = await fixture(t);
  const { port } = server.address();
  const cases = [
    {
      headers: 'Host: invalid.example',
      status: '403 Forbidden',
      code: 'host-forbidden',
      message: 'Host가 허용되지 않습니다.',
    },
    {
      headers: '',
      status: '403 Forbidden',
      code: 'host-forbidden',
      message: 'Host가 허용되지 않습니다.',
    },
    {
      headers: `Host: 127.0.0.1:${port}\r\nHost: evil.example\r\nOrigin: https://invalid.example`,
      status: '403 Forbidden',
      code: 'host-forbidden',
      message: 'Host가 허용되지 않습니다.',
    },
    {
      headers: `Host: 127.0.0.1:${port}\r\nOrigin: https://invalid.example`,
      status: '403 Forbidden',
      code: 'origin-forbidden',
      message: 'Origin이 허용되지 않습니다.',
    },
    {
      headers: `Host: 127.0.0.1:${port}`,
      status: '405 Method Not Allowed',
      code: 'method-not-allowed',
      message: '허용되지 않은 method입니다.',
    },
  ];
  for (const expected of cases) {
    const raw = await rawRequest(
      server,
      Buffer.from(`CONNECT /api/v1/health HTTP/1.1\r\n${expected.headers}\r\n\r\n`, 'ascii'),
    );
    const [headerText, body] = raw.split('\r\n\r\n');
    assert.match(headerText, new RegExp(`^HTTP/1\\.1 ${expected.status}\\r\\n`));
    assert.match(headerText, new RegExp(`Content-Security-Policy: ${SECURITY_HEADERS['Content-Security-Policy']}`));
    assert.match(headerText, /X-Content-Type-Options: nosniff/);
    assert.match(headerText, /Cache-Control: no-store/);
    assert.doesNotMatch(headerText, /Access-Control-Allow-Origin/i);
    assert.deepEqual(JSON.parse(body), {
      error: { code: expected.code, message: expected.message },
    });
    if (expected.code === 'method-not-allowed') {
      assert.match(headerText, /Allow: GET, HEAD, DELETE/);
    }
  }
});

test('project APIs isolate records and only forget unavailable projects', async (t) => {
  const { registryPath, server } = await fixture(t);
  const projects = await request(server, { path: '/api/v1/projects' });
  assert.equal(projects.status, 200);
  const projectBody = JSON.parse(projects.body);
  assert.deepEqual(projectBody.projects.map((project) => project.availability).sort(), ['available', 'unavailable']);

  const index = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  assert.equal(index.status, 200);
  assert.deepEqual(JSON.parse(index.body).issues.map((issue) => issue.id), ['PL-0001']);

  const document = await request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/documents/issue/PL-0001`,
  });
  assert.equal(document.status, 200);
  assert.equal(JSON.parse(document.body).body.id, 'PL-0001');

  const availableDelete = await request(server, {
    method: 'DELETE',
    path: `/api/v1/projects/${AVAILABLE_ID}`,
    origin: (await request(server)).expectedOrigin,
  });
  assert.equal(availableDelete.status, 409);
  assert.equal(JSON.parse(availableDelete.body).error.code, 'project-available');

  const origin = (await request(server)).expectedOrigin;
  const unavailableDelete = await request(server, {
    method: 'DELETE', path: `/api/v1/projects/${UNAVAILABLE_ID}`, origin,
  });
  assert.equal(unavailableDelete.status, 204);
  assert.equal(unavailableDelete.body, '');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.deepEqual(registry.projects.map((project) => project.id), [AVAILABLE_ID]);
});

test('two simultaneously available projects never expose each other records', async (t) => {
  const { availableRoot, registryPath, root, server } = await fixture(t);
  const first = makeIssue();
  first.identity.title = 'ONLY-IN-PROJECT-A';
  fs.writeFileSync(
    path.join(availableRoot, '.proofline', 'issues', 'PL-0001.json'),
    JSON.stringify(first),
    'utf8',
  );

  const secondRoot = path.join(root, 'available-second');
  const secondIssues = path.join(secondRoot, '.proofline', 'issues');
  fs.mkdirSync(secondIssues, { recursive: true });
  const second = makeIssue();
  second.identity.id = 'PL-0002';
  second.identity.title = 'ONLY-IN-PROJECT-B';
  fs.writeFileSync(path.join(secondIssues, 'PL-0002.json'), JSON.stringify(second), 'utf8');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  registry.projects.push({
    id: SECOND_AVAILABLE_ID,
    root: secondRoot,
    registered_at: '2026-08-17T00:02:00.000Z',
  });
  fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

  const projects = JSON.parse((await request(server, { path: '/api/v1/projects' })).body).projects;
  assert.deepEqual(
    projects.filter((project) => project.availability === 'available').map((project) => project.id).sort(),
    [AVAILABLE_ID, SECOND_AVAILABLE_ID].sort(),
  );

  const indexA = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  const indexB = await request(server, { path: `/api/v1/projects/${SECOND_AVAILABLE_ID}/index` });
  assert.deepEqual(JSON.parse(indexA.body).issues.map((issue) => issue.id), ['PL-0001']);
  assert.deepEqual(JSON.parse(indexB.body).issues.map((issue) => issue.id), ['PL-0002']);
  assert.doesNotMatch(indexA.body, /ONLY-IN-PROJECT-B/);
  assert.doesNotMatch(indexB.body, /ONLY-IN-PROJECT-A/);

  const documentA = await request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/documents/issue/PL-0001`,
  });
  const documentB = await request(server, {
    path: `/api/v1/projects/${SECOND_AVAILABLE_ID}/documents/issue/PL-0002`,
  });
  assert.doesNotMatch(documentA.body, /ONLY-IN-PROJECT-B/);
  assert.doesNotMatch(documentB.body, /ONLY-IN-PROJECT-A/);
});

test('HTTP index rejects a file-link escape through a symlink or Windows junction fallback', async (t) => {
  const { availableRoot, root, server } = await fixture(t);
  const externalDirectory = path.join(root, 'external-plan');
  const externalFile = path.join(externalDirectory, 'PLAN.md');
  fs.mkdirSync(externalDirectory, { recursive: true });
  fs.writeFileSync(externalFile, [
    '---',
    'id: PLAN-0009',
    'title: EXTERNAL-FILE-SECRET',
    'status: ready',
    '---',
    'EXTERNAL-BODY-SECRET',
  ].join('\n'), 'utf8');
  const planDirectory = path.join(availableRoot, '.proofline', 'plan', 'PLAN-0009-file-link');
  fs.mkdirSync(planDirectory, { recursive: true });
  linkExternalFile(externalFile, path.join(planDirectory, 'PLAN.md'));

  const response = await request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/index?refresh=1`,
  });
  assert.equal(response.status, 200);
  const index = JSON.parse(response.body);
  assert.deepEqual(index.plans, []);
  assert.ok(index.diagnostics.some((item) => item.code === 'record-path-outside-project'
    && item.relative_path === '.proofline/plan/PLAN-0009-file-link/PLAN.md'));
  assert.doesNotMatch(response.body, /EXTERNAL-(?:FILE|BODY)-SECRET/);
});

test('HTTP index rejects records over 2 MiB with a relative-path diagnostic', async (t) => {
  const { availableRoot, server } = await fixture(t);
  const planDirectory = path.join(availableRoot, '.proofline', 'plan', 'PLAN-0010-too-large');
  const planPath = path.join(planDirectory, 'PLAN.md');
  fs.mkdirSync(planDirectory, { recursive: true });
  fs.writeFileSync(planPath, Buffer.concat([
    Buffer.from('---\nid: PLAN-0010\ntitle: Too Large\nstatus: ready\n---\n', 'utf8'),
    Buffer.alloc(MAX_RECORD_BYTES, 0x58),
  ]));
  assert.ok(fs.statSync(planPath).size > MAX_RECORD_BYTES);

  const response = await request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/index?refresh=1`,
  });
  assert.equal(response.status, 200);
  const index = JSON.parse(response.body);
  assert.deepEqual(index.plans, []);
  assert.ok(index.diagnostics.some((item) => item.code === 'record-too-large'
    && item.relative_path === '.proofline/plan/PLAN-0010-too-large/PLAN.md'));
});

test('HTTP never trusts a canonical project root replaced by a junction or symlink', async (t) => {
  const { availableRoot, root, server } = await fixture(t);
  const initial = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  assert.equal(initial.status, 200);
  assert.deepEqual(JSON.parse(initial.body).issues.map((issue) => issue.id), ['PL-0001']);

  const movedRoot = path.join(root, 'moved-original');
  const externalRoot = path.join(root, 'external');
  const externalIssues = path.join(externalRoot, '.proofline', 'issues');
  fs.mkdirSync(externalIssues, { recursive: true });
  const externalIssue = makeIssue();
  externalIssue.identity.id = 'PL-9999';
  externalIssue.identity.title = 'EXTERNAL-SECRET-RECORD';
  fs.writeFileSync(path.join(externalIssues, 'PL-9999.json'), JSON.stringify(externalIssue), 'utf8');
  fs.renameSync(availableRoot, movedRoot);
  fs.symlinkSync(externalRoot, availableRoot, process.platform === 'win32' ? 'junction' : 'dir');

  const projects = await request(server, { path: '/api/v1/projects' });
  assert.equal(projects.status, 200);
  const listed = JSON.parse(projects.body).projects.find((project) => project.id === AVAILABLE_ID);
  assert.equal(listed.availability, 'unavailable');
  assert.deepEqual(listed.counts, { active: null, blocked: null });
  assert.doesNotMatch(projects.body, /EXTERNAL-SECRET-RECORD/);

  const index = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  assert.equal(index.status, 200);
  assert.equal(JSON.parse(index.body).project.availability, 'unavailable');
  assert.deepEqual(JSON.parse(index.body).issues, []);
  assert.doesNotMatch(index.body, /EXTERNAL-SECRET-RECORD/);

  const document = await request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/documents/issue/PL-9999`,
  });
  assert.equal(document.status, 409);
  assert.equal(JSON.parse(document.body).error.code, 'project-unavailable');
  assert.doesNotMatch(document.body, /EXTERNAL-SECRET-RECORD/);
});

test('HTTP discards a cached index when the registry maps the same project ID to another canonical root', async (t) => {
  const { availableRoot, projectService, registryPath, root, server } = await fixture(t);
  const issueA = makeIssue();
  issueA.identity.title = 'SECRET-FROM-A';
  issueA.state.current_summary = 'SECRET-FROM-A';
  fs.writeFileSync(
    path.join(availableRoot, '.proofline', 'issues', 'PL-0001.json'),
    JSON.stringify(issueA),
    'utf8',
  );

  const fromA = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  assert.equal(fromA.status, 200);
  assert.match(fromA.body, /SECRET-FROM-A/);
  assert.equal(projectService.cache.get(AVAILABLE_ID).canonicalRootIdentity, pathKey(availableRoot));

  const rootB = path.join(root, 'available-b');
  const issuesB = path.join(rootB, '.proofline', 'issues');
  fs.mkdirSync(issuesB, { recursive: true });
  const issueB = makeIssue();
  issueB.identity.title = 'ROOT-B';
  issueB.state.current_summary = 'CURRENT-FROM-B';
  fs.writeFileSync(path.join(issuesB, 'PL-0001.json'), JSON.stringify(issueB), 'utf8');
  const canonicalB = fs.realpathSync.native(rootB);
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  registry.projects.find((project) => project.id === AVAILABLE_ID).root = canonicalB;
  fs.writeFileSync(registryPath, JSON.stringify(registry), 'utf8');

  const projects = await request(server, { path: '/api/v1/projects' });
  const listed = JSON.parse(projects.body).projects.find((project) => project.id === AVAILABLE_ID);
  assert.equal(listed.root, canonicalB);
  assert.equal(projectService.cache.get(AVAILABLE_ID).canonicalRootIdentity, pathKey(availableRoot));

  const fromB = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  assert.equal(fromB.status, 200);
  const indexB = JSON.parse(fromB.body);
  assert.equal(indexB.project.root, canonicalB);
  assert.equal(indexB.issues[0].title, 'ROOT-B');
  assert.doesNotMatch(fromB.body, /SECRET-FROM-A/);
  assert.equal(projectService.cache.get(AVAILABLE_ID).canonicalRootIdentity, pathKey(canonicalB));

  const documentB = await request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/documents/issue/PL-0001`,
  });
  assert.equal(documentB.status, 200);
  assert.equal(JSON.parse(documentB.body).body.currentSummary, 'CURRENT-FROM-B');
  assert.doesNotMatch(documentB.body, /SECRET-FROM-A/);
});

test('project list computes only sidebar summaries and never seeds the detail cache', async (t) => {
  const { availableRoot, projectService, server } = await fixture(t);
  const projects = await request(server, { path: '/api/v1/projects' });
  assert.equal(projects.status, 200);
  assert.equal(projectService.cache.size, 0);
  assert.doesNotMatch(projects.body, /current_summary|next_action|"raw"/);

  const changed = makeIssue();
  changed.state.status = 'blocked';
  changed.state.current_summary = 'CHANGED-AFTER-SIDEBAR';
  changed.state.next_action = '차단을 해소한다.';
  changed.state.blocker = '외부 조건';
  changed.state.unblock_condition = '외부 조건 완료';
  fs.writeFileSync(
    path.join(availableRoot, '.proofline', 'issues', 'PL-0001.json'),
    JSON.stringify(changed),
    'utf8',
  );

  const index = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  assert.equal(index.status, 200);
  assert.equal(JSON.parse(index.body).issues[0].status, 'blocked');
  assert.match(index.body, /CHANGED-AFTER-SIDEBAR/);
  assert.equal(projectService.cache.size, 1);
  const cached = projectService.cache.get(AVAILABLE_ID);
  assert.ok([...cached.index.recordMap.values()].every((record) => record.body === undefined));
});

test('sidebar summary validates every byte while retaining only bounded Plan and Spec prefixes', async (t) => {
  const { availableRoot, projectService, server } = await fixture(t);
  const planDirectory = path.join(availableRoot, '.proofline', 'plan', 'PLAN-0008-large');
  const specDirectory = path.join(availableRoot, '.proofline', 'specs', 'SPEC-0008-large');
  const planPath = path.join(planDirectory, 'PLAN.md');
  const specPath = path.join(specDirectory, 'SPEC.md');
  fs.mkdirSync(planDirectory, { recursive: true });
  fs.mkdirSync(specDirectory, { recursive: true });
  fs.writeFileSync(planPath, [
    '---',
    'id: PLAN-0008',
    'title: Large Plan',
    'status: ready',
    '---',
    'P'.repeat(128 * 1024),
  ].join('\n'), 'utf8');
  fs.writeFileSync(specPath, [
    '---',
    JSON.stringify({
      schema_version: 2,
      id: 'SPEC-0008',
      title: 'Large Spec',
      kind: 'feature',
      status: 'ready',
      revision: 1,
      supersedes: [],
      superseded_by: null,
      related_issues: [],
    }, null, 2),
    '---',
    'S'.repeat(128 * 1024),
  ].join('\n'), 'utf8');
  const planKey = pathKey(fs.realpathSync.native(planPath));
  const specKey = pathKey(fs.realpathSync.native(specPath));
  const planSize = fs.statSync(planPath).size;
  const specSize = fs.statSync(specPath).size;

  const sidebar = await measureReadBytes(() => request(server, { path: '/api/v1/projects' }));
  assert.equal(sidebar.result.status, 200);
  assert.equal(sidebar.bytesByPath.get(planKey), planSize);
  assert.equal(sidebar.bytesByPath.get(specKey), specSize);
  assert.equal(sidebar.allocatedSizes.includes(planSize), false);
  assert.equal(sidebar.allocatedSizes.includes(specSize), false);
  assert.equal(projectService.cache.size, 0);
  assert.doesNotMatch(sidebar.result.body, /P{128}|S{128}/);

  const index = await measureReadBytes(() => request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/index`,
  }));
  assert.equal(index.result.status, 200);
  assert.equal(index.bytesByPath.get(planKey), planSize);
  assert.equal(index.bytesByPath.get(specKey), specSize);
  assert.ok([...projectService.cache.get(AVAILABLE_ID).index.recordMap.values()]
    .every((record) => record.body === undefined));

  const document = await measureReadBytes(() => request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/documents/plan/PLAN-0008`,
  }));
  assert.equal(document.result.status, 200);
  assert.equal(document.bytesByPath.get(planKey), planSize);
  assert.equal(JSON.parse(document.result.body).body.length, 128 * 1024);
});

test('summary retains valid metadata past 64 KiB through its delimiter and streams the body', async (t) => {
  const { availableRoot, projectService, server } = await fixture(t);
  const planDirectory = path.join(availableRoot, '.proofline', 'plan', 'PLAN-0011-wide-metadata');
  const planPath = path.join(planDirectory, 'PLAN.md');
  const title = 'T'.repeat(70 * 1024);
  const bodyMarker = 'BODY-MUST-STAY-STREAMING-ONLY';
  fs.mkdirSync(planDirectory, { recursive: true });
  fs.writeFileSync(planPath, [
    '---',
    'id: PLAN-0011',
    `title: ${title}`,
    'status: ready',
    '---',
    bodyMarker,
    'B'.repeat(96 * 1024),
  ].join('\n'), 'utf8');
  const planKey = pathKey(fs.realpathSync.native(planPath));
  const planSize = fs.statSync(planPath).size;

  const summary = await measureReadBytes(() => request(server, { path: '/api/v1/projects' }));
  const listed = JSON.parse(summary.result.body).projects.find((item) => item.id === AVAILABLE_ID);
  assert.equal(summary.bytesByPath.get(planKey), planSize);
  assert.equal(summary.allocatedSizes.includes(planSize), false);
  assert.equal(listed.diagnostic_count, 0);
  assert.ok(listed.last_modified);
  assert.doesNotMatch(summary.result.body, new RegExp(bodyMarker));
  assert.equal(projectService.cache.size, 0);

  const indexResponse = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  const index = JSON.parse(indexResponse.body);
  assert.equal(index.plans.find((plan) => plan.id === 'PLAN-0011').title.length, title.length);
  assert.equal(index.diagnostics.some((item) => item.relative_path
    === '.proofline/plan/PLAN-0011-wide-metadata/PLAN.md'), false);
  assert.doesNotMatch(indexResponse.body, new RegExp(bodyMarker));
  assert.ok([...projectService.cache.get(AVAILABLE_ID).index.recordMap.values()]
    .every((record) => record.body === undefined));
});

test('project summary and index exclude invalid UTF-8 tails with safe diagnostics and no cached bodies', async (t) => {
  const { availableRoot, projectService, server } = await fixture(t);
  const planDirectory = path.join(availableRoot, '.proofline', 'plan', 'PLAN-0007-invalid');
  const specDirectory = path.join(availableRoot, '.proofline', 'specs', 'SPEC-0007-invalid');
  fs.mkdirSync(planDirectory, { recursive: true });
  fs.mkdirSync(specDirectory, { recursive: true });
  const invalidTail = Buffer.concat([Buffer.alloc(70 * 1024, 0x61), Buffer.from([0xc3, 0x28])]);
  const planPath = path.join(planDirectory, 'PLAN.md');
  const specPath = path.join(specDirectory, 'SPEC.md');
  fs.writeFileSync(planPath, Buffer.concat([
    Buffer.from('---\nid: PLAN-0007\ntitle: Invalid\nstatus: ready\n---\n', 'utf8'),
    invalidTail,
  ]));
  fs.writeFileSync(specPath, Buffer.concat([
    Buffer.from(`---\n${JSON.stringify({
      schema_version: 2,
      id: 'SPEC-0007',
      title: 'Invalid',
      kind: 'feature',
      status: 'ready',
      revision: 1,
      supersedes: [],
      superseded_by: null,
      related_issues: [],
    }, null, 2)}\n---\n`, 'utf8'),
    invalidTail,
  ]));

  const projects = await measureReadBytes(() => request(server, { path: '/api/v1/projects' }));
  const listed = JSON.parse(projects.result.body).projects.find((project) => project.id === AVAILABLE_ID);
  assert.equal(listed.diagnostic_count, 2);
  assert.equal(projects.bytesByPath.get(pathKey(fs.realpathSync.native(planPath))), fs.statSync(planPath).size);
  assert.equal(projects.bytesByPath.get(pathKey(fs.realpathSync.native(specPath))), fs.statSync(specPath).size);
  assert.equal(projectService.cache.size, 0);

  const index = await request(server, { path: `/api/v1/projects/${AVAILABLE_ID}/index` });
  const body = JSON.parse(index.body);
  assert.deepEqual(body.plans, []);
  assert.deepEqual(body.specs, []);
  assert.deepEqual(
    body.diagnostics.filter((item) => item.code === 'record-invalid-utf8').map((item) => item.relative_path),
    [
      '.proofline/plan/PLAN-0007-invalid/PLAN.md',
      '.proofline/specs/SPEC-0007-invalid/SPEC.md',
    ],
  );
  assert.ok([...projectService.cache.get(AVAILABLE_ID).index.recordMap.values()]
    .every((record) => record.body === undefined));

  const detail = await request(server, {
    path: `/api/v1/projects/${AVAILABLE_ID}/documents/spec/SPEC-0007`,
  });
  assert.equal(detail.status, 404);
  assert.equal(JSON.parse(detail.body).error.code, 'record-not-found');
});
