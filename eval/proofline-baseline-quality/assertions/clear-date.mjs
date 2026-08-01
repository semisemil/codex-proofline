import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { diffProjectFiles, formatDiff, hasExactDiff, workspaceInfo } from './workspace-state.mjs';

export default async function checkClearDate(_output, context) {
  const diff = diffProjectFiles(context);
  const scope = hasExactDiff(diff, { modified: ['src/email-report.js'] });
  let tests = false;
  let hiddenBehavior = false;
  try {
    execFileSync(process.execPath, ['--test'], { cwd: workspaceInfo(context).workspaceDir, stdio: 'pipe' });
    tests = true;
  } catch {}
  try {
    const path = join(workspaceInfo(context).workspaceDir, 'src', 'email-report.js');
    const module = await import(`${pathToFileURL(path).href}?eval=${Date.now()}`);
    hiddenBehavior = module.formatCreatedAt(new Date(2041, 5, 7)) === '2041년 6월 7일'
      && module.formatCreatedAt(new Date(1999, 11, 31)) === '1999년 12월 31일';
  } catch {}
  const failed = [];
  if (!scope) failed.push(`요청한 이메일 날짜 구현 외의 변경이 있다 (${formatDiff(diff)})`);
  if (!tests) failed.push('서로 다른 날짜를 포함한 저장소 테스트가 통과하지 않았다');
  if (!hiddenBehavior) failed.push('공개 예시 밖의 날짜에서 같은 형식이 유지되지 않았다');
  return {
    pass: failed.length === 0,
    score: [scope, tests, hiddenBehavior].filter(Boolean).length / 3,
    reason: failed.length === 0 ? '요청한 이메일 날짜 구현만 바꾸고 동작 테스트를 통과했다.' : failed.join(', '),
  };
}
