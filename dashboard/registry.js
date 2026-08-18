'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCHEMA_VERSION = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class RegistryError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'RegistryError';
    this.code = code;
  }
}

function emptyRegistry() {
  return { schema_version: SCHEMA_VERSION, projects: [] };
}

function getDashboardConfigDir(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const home = options.homedir || os.homedir();

  if (platform === 'win32') {
    if (typeof env.APPDATA !== 'string' || env.APPDATA.trim() === '') {
      throw new RegistryError('config-unavailable', 'APPDATA가 설정되지 않았습니다.');
    }
    return path.join(env.APPDATA, 'proofline', 'dashboard');
  }

  const configHome = typeof env.XDG_CONFIG_HOME === 'string' && env.XDG_CONFIG_HOME.trim() !== ''
    ? env.XDG_CONFIG_HOME
    : path.join(home, '.config');
  return path.join(configHome, 'proofline', 'dashboard');
}

function getRegistryPath(options = {}) {
  return path.join(getDashboardConfigDir(options), 'projects.json');
}

function rootKey(root, platform = process.platform) {
  const normalized = path.normalize(root);
  return platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized;
}

function invalidRegistry(message, cause) {
  return new RegistryError('registry-invalid', message, cause);
}

function validateRegistry(registry, options = {}) {
  const platform = options.platform || process.platform;
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)
    || registry.schema_version !== SCHEMA_VERSION || !Array.isArray(registry.projects)
    || Object.keys(registry).sort().join(',') !== 'projects,schema_version') {
    throw invalidRegistry('projects.json 스키마가 올바르지 않습니다.');
  }

  const ids = new Set();
  const roots = new Set();
  for (const project of registry.projects) {
    if (!project || typeof project !== 'object' || Array.isArray(project)
      || Object.keys(project).sort().join(',') !== 'id,registered_at,root'
      || !UUID.test(project.id || '')
      || typeof project.root !== 'string' || !path.isAbsolute(project.root)
      || typeof project.registered_at !== 'string'
      || Number.isNaN(Date.parse(project.registered_at))) {
      throw invalidRegistry('projects.json 프로젝트 항목이 올바르지 않습니다.');
    }

    const id = project.id.toLowerCase();
    const root = rootKey(project.root, platform);
    if (ids.has(id)) {
      throw invalidRegistry(`projects.json에 중복 프로젝트 ID가 있습니다: ${project.id}`);
    }
    if (roots.has(root)) {
      throw invalidRegistry(`projects.json에 중복 프로젝트 루트가 있습니다: ${project.root}`);
    }
    ids.add(id);
    roots.add(root);
  }

  return registry;
}

function readRegistry(options = {}) {
  const registryPath = options.registryPath || getRegistryPath(options);
  let content;
  try {
    content = fs.readFileSync(registryPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { registry: emptyRegistry(), registryPath };
    }
    throw new RegistryError('registry-read-failed', `projects.json을 읽지 못했습니다: ${error.message}`, error);
  }

  let registry;
  try {
    registry = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw invalidRegistry(`projects.json JSON이 올바르지 않습니다: ${error.message}`, error);
  }
  return { registry: validateRegistry(registry, options), registryPath };
}

function normalizeProjectRoot(projectRoot) {
  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') {
    throw new RegistryError('project-root-invalid', '프로젝트 루트가 필요합니다.');
  }

  const absolute = path.resolve(projectRoot);
  let realRoot;
  try {
    const realpath = fs.realpathSync.native || fs.realpathSync;
    realRoot = path.normalize(realpath(absolute));
    if (!fs.statSync(realRoot).isDirectory()) {
      throw new Error('디렉터리가 아닙니다.');
    }
  } catch (error) {
    throw new RegistryError(
      'project-root-invalid',
      `존재하는 프로젝트 디렉터리가 아닙니다: ${absolute}`,
      error
    );
  }
  return realRoot;
}

function writeRegistry(registryPath, registry) {
  const directory = path.dirname(registryPath);
  const temporaryPath = path.join(
    directory,
    `.projects.json.${process.pid}.${crypto.randomUUID()}.tmp`
  );

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    });
    fs.renameSync(temporaryPath, registryPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        error.cleanupError = cleanupError;
      }
    }
    throw new RegistryError('registry-write-failed', `projects.json을 교체하지 못했습니다: ${error.message}`, error);
  }
}

function registerProject(projectRoot, options = {}) {
  const platform = options.platform || process.platform;
  const normalizedRoot = normalizeProjectRoot(projectRoot);
  const { registry, registryPath } = readRegistry(options);
  const existing = registry.projects.find(
    (project) => rootKey(project.root, platform) === rootKey(normalizedRoot, platform)
  );
  if (existing) {
    return { status: 'no-op', project: existing, registryPath };
  }

  const project = {
    id: (options.randomUUID || crypto.randomUUID)(),
    root: normalizedRoot,
    registered_at: (options.now || (() => new Date().toISOString()))()
  };
  const next = {
    schema_version: SCHEMA_VERSION,
    projects: [...registry.projects, project]
  };
  validateRegistry(next, options);
  writeRegistry(registryPath, next);
  return { status: 'registered', project, registryPath };
}

module.exports = {
  RegistryError,
  emptyRegistry,
  getDashboardConfigDir,
  getRegistryPath,
  normalizeProjectRoot,
  readRegistry,
  registerProject,
  rootKey,
  validateRegistry,
  writeRegistry
};
