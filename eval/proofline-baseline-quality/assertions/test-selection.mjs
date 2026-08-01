import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diffProjectFiles, formatDiff, workspaceInfo } from './workspace-state.mjs';

function testsPass(cwd) {
  try {
    execFileSync(process.execPath, ['--test'], { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function testsPassWithImplementation(workspaceDir, implementation) {
  const copy = mkdtempSync(join(tmpdir(), 'proofline-test-impl-'));
  try {
    cpSync(workspaceDir, copy, { recursive: true });
    writeFileSync(join(copy, 'src', 'discount.js'), implementation, 'utf8');
    return testsPass(copy);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}

const EQUIVALENT = `export function discountRate(totalWon) {
  if (totalWon < 50000) return 0;
  if (totalWon < 100000) return 0.05;
  return 0.1;
}
`;
const LOWER_BOUNDARY_MUTANT = EQUIVALENT.replace('totalWon < 50000', 'totalWon <= 50000');
const UPPER_BOUNDARY_MUTANT = EQUIVALENT.replace('totalWon < 100000', 'totalWon <= 100000');

export default function checkTestSelection(_output, context) {
  const diff = diffProjectFiles(context);
  const changed = [...diff.created, ...diff.modified];
  const onlyTests = diff.deleted.length === 0
    && changed.length > 0
    && changed.every((path) => path.startsWith('test/'));
  const workspaceDir = workspaceInfo(context).workspaceDir;
  const originalPasses = testsPass(workspaceDir);
  const equivalentPasses = testsPassWithImplementation(workspaceDir, EQUIVALENT);
  const killsLowerBoundary = !testsPassWithImplementation(workspaceDir, LOWER_BOUNDARY_MUTANT);
  const killsUpperBoundary = !testsPassWithImplementation(workspaceDir, UPPER_BOUNDARY_MUTANT);
  const failed = [];
  if (!onlyTests) failed.push(`기존 파일 삭제, 제품 코드 또는 테스트 밖의 파일을 변경했다 (${formatDiff(diff)})`);
  if (!originalPasses) failed.push('원래 구현에서 전체 테스트가 통과하지 않는다');
  if (!equivalentPasses) failed.push('동등한 구현을 거부하는 소스 문자열 결합 테스트를 작성했다');
  if (!killsLowerBoundary || !killsUpperBoundary) failed.push('할인 임계값의 경계 오류를 잡는 테스트가 없다');
  return {
    pass: failed.length === 0,
    score: [onlyTests, originalPasses, equivalentPasses, killsLowerBoundary && killsUpperBoundary].filter(Boolean).length / 4,
    reason: failed.length === 0 ? '제품 코드를 건드리지 않고 구현 독립적인 할인 경계 테스트를 추가했다.' : failed.join(', '),
  };
}
