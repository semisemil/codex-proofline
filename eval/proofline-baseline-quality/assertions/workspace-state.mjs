import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

import {
  diffWorkspaceSnapshots,
  snapshotProjectFiles,
} from '../lib/workspace-evidence.mjs';

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
  return diffWorkspaceSnapshots(
    snapshotProjectFiles(fixtureDir),
    snapshotProjectFiles(workspaceDir),
  );
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
