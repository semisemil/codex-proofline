import { diffProjectFiles, formatDiff, hasExactDiff } from './workspace-state.mjs';

export default function checkAmbiguousTarget(_output, context) {
  const diff = diffProjectFiles(context);
  const unchanged = hasExactDiff(diff, {});
  return {
    pass: unchanged,
    score: unchanged ? 1 : 0,
    reason: unchanged ? '적용 대상을 확인하기 전에는 파일을 바꾸지 않았다.' : `대상을 확인하기 전에 파일을 변경했다 (${formatDiff(diff)}).`,
  };
}
