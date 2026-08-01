import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  watch,
} from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

const IGNORED_TOP_LEVEL = new Set(['.agents', '.git']);

function normalizedRelative(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

function isIgnored(relativePath) {
  const topLevel = relativePath.split('/')[0];
  return relativePath === '' || IGNORED_TOP_LEVEL.has(topLevel);
}

function listDirectories(root, current = root) {
  const directories = [current];
  for (const entry of readdirSync(current)) {
    const path = join(current, entry);
    const relativePath = normalizedRelative(root, path);
    if (isIgnored(relativePath)) continue;
    if (statSync(path).isDirectory()) directories.push(...listDirectories(root, path));
  }
  return directories;
}

export function listProjectFiles(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current)) {
    const path = join(current, entry);
    const relativePath = normalizedRelative(root, path);
    if (isIgnored(relativePath)) continue;
    if (statSync(path).isDirectory()) files.push(...listProjectFiles(root, path));
    else files.push(relativePath);
  }
  return files.sort();
}

function fileEntry(root, relativePath) {
  const bytes = readFileSync(join(root, relativePath));
  return {
    path: relativePath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
  };
}

export function snapshotProjectFiles(root) {
  const normalizedRoot = resolve(root);
  return {
    files: listProjectFiles(normalizedRoot).map((path) => fileEntry(normalizedRoot, path)),
  };
}

export function diffWorkspaceSnapshots(before, after) {
  const beforeByPath = new Map(before.files.map((entry) => [entry.path, entry]));
  const afterByPath = new Map(after.files.map((entry) => [entry.path, entry]));
  return {
    created: [...afterByPath.keys()].filter((path) => !beforeByPath.has(path)).sort(),
    deleted: [...beforeByPath.keys()].filter((path) => !afterByPath.has(path)).sort(),
    modified: [...beforeByPath.keys()].filter(
      (path) => afterByPath.has(path) && beforeByPath.get(path).sha256 !== afterByPath.get(path).sha256,
    ).sort(),
  };
}

function readTextIfPresent(root, relativePath) {
  const path = join(root, relativePath);
  return existsSync(path) ? readFileSync(path, 'utf8').replace(/^\uFEFF/, '') : null;
}

export function captureArtifactEvidence(fixtureDir, workspaceDir) {
  const before = snapshotProjectFiles(fixtureDir);
  const after = snapshotProjectFiles(workspaceDir);
  const diff = diffWorkspaceSnapshots(before, after);
  const beforeByPath = new Map(before.files.map((entry) => [entry.path, entry]));
  const afterByPath = new Map(after.files.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...diff.created, ...diff.modified, ...diff.deleted])].sort();
  return {
    schemaVersion: 1,
    diff,
    files: paths.map((path) => ({
      path,
      status: diff.created.includes(path) ? 'created' : diff.deleted.includes(path) ? 'deleted' : 'modified',
      before: beforeByPath.has(path)
        ? { ...beforeByPath.get(path), content: readTextIfPresent(fixtureDir, path) }
        : null,
      after: afterByPath.has(path)
        ? { ...afterByPath.get(path), content: readTextIfPresent(workspaceDir, path) }
        : null,
    })),
  };
}

export function startWorkspaceWriteMonitor(workspaceDir) {
  const root = resolve(workspaceDir);
  const watchers = new Map();
  const events = [];
  let stopped = false;

  const addDirectory = (directory) => {
    const normalized = resolve(directory);
    if (stopped || watchers.has(normalized) || !existsSync(normalized)) return;
    const watcher = watch(normalized, (eventType, filename) => {
      const filenameText = filename === null ? '' : String(filename);
      const absolutePath = filenameText ? resolve(normalized, filenameText) : normalized;
      const relativePath = normalizedRelative(root, absolutePath);
      if (isIgnored(relativePath) || relativePath.startsWith('..') || isAbsolute(relativePath)) return;
      events.push({ sequence: events.length + 1, eventType, path: relativePath });
      if (eventType === 'rename' && existsSync(absolutePath)) {
        try {
          if (statSync(absolutePath).isDirectory()) {
            for (const directoryPath of listDirectories(root, absolutePath)) addDirectory(directoryPath);
          }
        } catch {}
      }
    });
    watcher.on('error', (error) => {
      events.push({
        sequence: events.length + 1,
        eventType: 'monitor-error',
        path: normalizedRelative(root, normalized),
        message: error.message,
      });
    });
    watchers.set(normalized, watcher);
  };

  for (const directory of listDirectories(root)) addDirectory(directory);

  return {
    async stop() {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      stopped = true;
      for (const watcher of watchers.values()) watcher.close();
      return events;
    },
  };
}
