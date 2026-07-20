import { pathToFileURL } from 'node:url';

import {
  diffProjectFiles,
  formatDiff,
  hasExactDiff,
  workspaceInfo,
} from './workspace-state.mjs';

export default async function checkSessionFix(output, context) {
  const diff = diffProjectFiles(context);
  const scopePass = hasExactDiff(diff, {
    modified: ['src/session.js'],
  });
  const { workspaceDir } = workspaceInfo(context);
  let behaviorPass = false;
  try {
    const moduleUrl = pathToFileURL(`${workspaceDir}/src/session.js`);
    moduleUrl.searchParams.set('eval', `${Date.now()}-${Math.random()}`);
    const { getLoginState } = await import(moduleUrl.href);
    behaviorPass =
      JSON.stringify(getLoginState(null)) ===
        JSON.stringify({ authenticated: false, userId: null }) &&
      JSON.stringify(getLoginState({ user: { id: 'user-42' } })) ===
        JSON.stringify({ authenticated: true, userId: 'user-42' });
  } catch {
    behaviorPass = false;
  }
  const raw =
    typeof context.providerResponse?.raw === 'string'
      ? context.providerResponse.raw
      : JSON.stringify(context.providerResponse?.raw ?? '');
  let items = [];
  try {
    items = JSON.parse(raw).items ?? [];
  } catch {
    items = [];
  }
  const testsPass = items.some(
    (item) =>
      item?.type === 'command_execution' &&
      item?.exit_code === 0 &&
      /node(?:\.exe)?\s+test[\\/]session\.test\.js/i.test(item.command ?? ''),
  );
  const reportsVerification =
    /(테스트|node\s+test[\\/]session\.test\.js)/i.test(output) && /(통과|성공|pass)/i.test(output);
  const failed = [];
  if (!scopePass) failed.push(`허용 범위를 벗어난 파일 변경 (${formatDiff(diff)})`);
  if (!behaviorPass) failed.push('null 세션 또는 정상 세션의 반환 계약을 충족하지 않음');
  if (!testsPass) failed.push('지정된 테스트 명령을 종료 코드 0으로 실행한 기록이 없음');
  if (!reportsVerification) failed.push('최종 답변에 실제 테스트 통과 결과가 없음');
  return {
    pass: failed.length === 0,
    score: [scopePass, behaviorPass, testsPass, reportsVerification].filter(Boolean).length / 4,
    reason: failed.length === 0 ? '지정된 파일만 수정했고 기존 테스트와 회귀 테스트가 통과했다.' : failed.join(', '),
  };
}
