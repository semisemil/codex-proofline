'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const registerCli = path.join(repoRoot, 'dashboard', 'register-project.js');
const {
  getDashboardConfigDir,
  getRegistryPath,
  readRegistry,
  registerProject
} = require('../dashboard/registry.js');

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-registry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function configEnv(configRoot) {
  return process.platform === 'win32'
    ? { ...process.env, APPDATA: configRoot }
    : { ...process.env, XDG_CONFIG_HOME: configRoot };
}

function registryOptions(configRoot, overrides = {}) {
  return {
    env: configEnv(configRoot),
    randomUUID: () => '11111111-1111-4111-8111-111111111111',
    now: () => '2026-08-17T00:00:00.000Z',
    ...overrides
  };
}

test('registry normalizes real roots, deduplicates aliases, and atomically retains distinct roots', (t) => {
  const root = makeRoot(t);
  const configRoot = path.join(root, 'config');
  const firstRoot = path.join(root, 'one', 'same-name');
  const secondRoot = path.join(root, 'two', 'same-name');
  const aliasRoot = path.join(root, 'alias');
  fs.mkdirSync(firstRoot, { recursive: true });
  fs.mkdirSync(secondRoot, { recursive: true });
  fs.symlinkSync(firstRoot, aliasRoot, process.platform === 'win32' ? 'junction' : 'dir');

  const relativeFirst = path.relative(process.cwd(), firstRoot);
  const first = registerProject(relativeFirst, registryOptions(configRoot));
  const duplicate = registerProject(aliasRoot, registryOptions(configRoot, {
    randomUUID: () => '22222222-2222-4222-8222-222222222222'
  }));
  const second = registerProject(secondRoot, registryOptions(configRoot, {
    randomUUID: () => '33333333-3333-4333-8333-333333333333',
    now: () => '2026-08-17T00:01:00.000Z'
  }));

  assert.equal(first.status, 'registered');
  assert.equal(duplicate.status, 'no-op');
  assert.equal(duplicate.project.id, first.project.id);
  assert.equal(second.status, 'registered');
  assert.notEqual(second.project.root, first.project.root);

  const { registry, registryPath } = readRegistry(registryOptions(configRoot));
  assert.equal(registry.projects.length, 2);
  assert.deepEqual(registry.projects.map((project) => project.id), [
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333'
  ]);
  assert.equal(path.dirname(registryPath), getDashboardConfigDir(registryOptions(configRoot)));
  assert.deepEqual(
    fs.readdirSync(path.dirname(registryPath)).filter((name) => name.endsWith('.tmp')),
    []
  );

  if (process.platform === 'win32') {
    const caseVariant = registerProject(firstRoot.toUpperCase(), registryOptions(configRoot));
    assert.equal(caseVariant.status, 'no-op');
  }
});

test('missing roots are rejected without creating global state', (t) => {
  const root = makeRoot(t);
  const configRoot = path.join(root, 'config');
  assert.throws(
    () => registerProject(path.join(root, 'missing'), registryOptions(configRoot)),
    (error) => error.code === 'project-root-invalid'
  );
  assert.equal(fs.existsSync(getRegistryPath(registryOptions(configRoot))), false);
});

test('invalid registries are rejected and never overwritten', (t) => {
  const root = makeRoot(t);
  const projectRoot = path.join(root, 'project');
  const configRoot = path.join(root, 'config');
  const options = registryOptions(configRoot);
  const registryPath = getRegistryPath(options);
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });

  const invalidCases = [
    '{bad json',
    JSON.stringify({ schema_version: 2, projects: [] }),
    JSON.stringify({ schema_version: 1, projects: [], extra: true }),
    JSON.stringify({
      schema_version: 1,
      projects: [
        { id: '11111111-1111-4111-8111-111111111111', root: projectRoot, registered_at: '2026-08-17T00:00:00.000Z' },
        { id: '11111111-1111-4111-8111-111111111111', root: path.join(root, 'other'), registered_at: '2026-08-17T00:00:00.000Z' }
      ]
    }),
    JSON.stringify({
      schema_version: 1,
      projects: [
        { id: '11111111-1111-4111-8111-111111111111', root: projectRoot, registered_at: '2026-08-17T00:00:00.000Z' },
        { id: '22222222-2222-4222-8222-222222222222', root: projectRoot, registered_at: '2026-08-17T00:00:00.000Z' }
      ]
    })
  ];

  for (const content of invalidCases) {
    fs.writeFileSync(registryPath, content, 'utf8');
    assert.throws(
      () => registerProject(projectRoot, options),
      (error) => error.code === 'registry-invalid'
    );
    assert.equal(fs.readFileSync(registryPath, 'utf8'), content);
  }
});

test('register CLI reports registered, no-op, and registry-invalid as stable results', (t) => {
  const root = makeRoot(t);
  const projectRoot = path.join(root, 'project');
  const configRoot = path.join(root, 'config');
  const env = configEnv(configRoot);
  fs.mkdirSync(projectRoot, { recursive: true });

  const first = spawnSync(process.execPath, [registerCli, 'register', '--project-root', projectRoot], {
    encoding: 'utf8', env
  });
  const second = spawnSync(process.execPath, [registerCli, 'register', '--project-root', projectRoot], {
    encoding: 'utf8', env
  });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).status, 'registered');
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).status, 'no-op');

  const registryPath = getRegistryPath({ env });
  fs.writeFileSync(registryPath, '{bad json', 'utf8');
  const invalid = spawnSync(process.execPath, [registerCli, 'register', '--project-root', projectRoot], {
    encoding: 'utf8', env
  });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stderr).error.code, 'registry-invalid');
  assert.equal(fs.readFileSync(registryPath, 'utf8'), '{bad json');

  const malformed = spawnSync(process.execPath, [registerCli, 'register', '--unknown', projectRoot], {
    encoding: 'utf8', env
  });
  assert.equal(malformed.status, 1);
  assert.equal(JSON.parse(malformed.stderr).error.code, 'invalid-argument');
});
