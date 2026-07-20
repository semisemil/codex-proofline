import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

const bundle = process.env.PROOFLINE_EVAL_BUNDLE;
if (!bundle) {
  throw new Error('PROOFLINE_EVAL_BUNDLE 환경 변수가 없습니다. npm 스크립트로 실행해 주세요.');
}

const workspaceRoot = resolve(bundle, '..', 'workspaces');
const fixtureRoot = join(bundle, 'fixtures');
const skillRoot = join(bundle, 'skill', 'proofline-baseline-quality');

function ensureDisposableWorkspace(path) {
  const normalized = resolve(path);
  const fromRoot = relative(workspaceRoot, normalized);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new Error(`임시 평가 작업공간 밖의 경로입니다: ${normalized}`);
  }
  return normalized;
}

function initializeRepository(workspaceDir) {
  const gitDir = join(workspaceDir, '.git');
  mkdirSync(join(gitDir, 'objects'), { recursive: true });
  mkdirSync(join(gitDir, 'refs', 'heads'), { recursive: true });
  writeFileSync(join(gitDir, 'HEAD'), 'ref: refs/heads/eval\n', 'utf8');
  writeFileSync(
    join(gitDir, 'config'),
    '[core]\n\trepositoryformatversion = 0\n\tbare = false\n',
    'utf8',
  );
}

export async function extensionHook(hookName, context) {
  if (hookName === 'beforeEach') {
    const caseName = context.test.metadata?.case;
    if (typeof caseName !== 'string' || !/^\d{2}-[a-z0-9-]+$/.test(caseName)) {
      throw new Error('평가 사례 metadata.case가 올바르지 않습니다.');
    }
    const fixtureDir = resolve(fixtureRoot, caseName);
    const fromFixtureRoot = relative(fixtureRoot, fixtureDir);
    if (
      fromFixtureRoot.startsWith('..') ||
      isAbsolute(fromFixtureRoot) ||
      !existsSync(fixtureDir)
    ) {
      throw new Error(`평가 사례 파일을 찾을 수 없습니다: ${caseName}`);
    }

    mkdirSync(workspaceRoot, { recursive: true });
    const workspaceDir = ensureDisposableWorkspace(
      join(workspaceRoot, randomUUID()),
    );
    cpSync(fixtureDir, workspaceDir, { recursive: true });
    cpSync(
      skillRoot,
      join(workspaceDir, '.agents', 'skills', 'proofline-baseline-quality'),
      { recursive: true },
    );
    initializeRepository(workspaceDir);
    return {
      test: {
        ...context.test,
        vars: {
          ...context.test.vars,
          workspaceDir,
        },
      },
    };
  }

  if (hookName === 'afterAll') {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}
