import { diffProjectFiles, formatDiff, hasExactDiff } from './workspace-state.mjs';

export default function checkAmbiguityStop(output, context) {
  const diff = diffProjectFiles(context);
  const unchanged = hasExactDiff(diff, {});
  const namesBothTargets =
    /(데스크톱|CLI|로컬|JSON)/i.test(output) && /(웹|서비스|데이터베이스)/i.test(output);
  const imperativeClarification =
    /(어느|어떤|둘 중|대상)[^\n.]{0,100}(지정|선택|알려|말해)[^\n.]{0,20}주세요/.test(output);
  const questionMarks = output.match(/\?/g)?.length ?? 0;
  const asksWhich =
    /(어느|어떤|둘 중|대상)/.test(output) &&
    (questionMarks === 1 || imperativeClarification);
  const oneQuestion = questionMarks === 1 || (questionMarks === 0 && imperativeClarification);
  const concise = output.length <= 500;
  const failed = [];
  if (!unchanged) failed.push(`질문 전에 파일을 변경함 (${formatDiff(diff)})`);
  if (!namesBothTargets || !asksWhich) failed.push('두 저장 대상 중 어느 쪽인지 명확히 묻지 않음');
  if (!oneQuestion || !concise) failed.push('한 번의 간결한 확인 질문 뒤 멈추지 않음');
  return {
    pass: failed.length === 0,
    score: [unchanged, namesBothTargets && asksWhich, oneQuestion && concise].filter(Boolean).length / 3,
    reason: failed.length === 0 ? '모호한 두 대상을 확인하고 파일을 바꾸지 않은 채 질문 하나로 멈췄다.' : failed.join(', '),
  };
}
