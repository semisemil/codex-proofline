import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

const IGNORED_TOP_LEVEL = new Set(['.agents', '.git']);

function listProjectFiles(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current)) {
    const path = join(current, entry);
    const relativePath = relative(root, path).replaceAll('\\', '/');
    if (IGNORED_TOP_LEVEL.has(relativePath.split('/')[0])) continue;
    if (statSync(path).isDirectory()) files.push(...listProjectFiles(root, path));
    else files.push(relativePath);
  }
  return files.sort();
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function workspaceInfo(context) {
  const workspaceDir = context.vars?.workspaceDir;
  const caseName = context.test?.metadata?.case;
  const bundle = process.env.PROOFLINE_EVAL_BUNDLE;
  if (typeof workspaceDir !== 'string' || typeof caseName !== 'string' || !bundle) {
    throw new Error('평가 작업공간 정보를 찾지 못했습니다.');
  }
  return {
    caseName,
    fixtureDir: resolve(bundle, 'fixtures', caseName),
    workspaceDir: resolve(workspaceDir),
  };
}

export function diffProjectFiles(context) {
  const { fixtureDir, workspaceDir } = workspaceInfo(context);
  const before = new Set(listProjectFiles(fixtureDir));
  const after = new Set(listProjectFiles(workspaceDir));
  return {
    created: [...after].filter((path) => !before.has(path)),
    deleted: [...before].filter((path) => !after.has(path)),
    modified: [...before].filter(
      (path) => after.has(path) && hashFile(join(fixtureDir, path)) !== hashFile(join(workspaceDir, path)),
    ),
  };
}

export function readWorkspaceFile(context, relativePath) {
  const { workspaceDir } = workspaceInfo(context);
  const path = resolve(workspaceDir, relativePath);
  const fromWorkspace = relative(workspaceDir, path);
  if (fromWorkspace.startsWith('..') || isAbsolute(fromWorkspace) || !existsSync(path)) {
    throw new Error(`평가 결과 파일을 찾지 못했습니다: ${relativePath}`);
  }
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
}

export function hasExactDiff(actual, expected = {}) {
  return ['created', 'deleted', 'modified'].every(
    (kind) => JSON.stringify(actual[kind]) === JSON.stringify([...(expected[kind] ?? [])].sort()),
  );
}

export function formatDiff(diff) {
  return ['created', 'modified', 'deleted']
    .flatMap((kind) => diff[kind].map((path) => `${kind}:${path}`))
    .join(', ') || '변경 없음';
}
