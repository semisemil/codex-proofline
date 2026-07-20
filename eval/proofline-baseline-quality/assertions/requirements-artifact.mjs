import {
  diffProjectFiles,
  formatDiff,
  hasExactDiff,
  readWorkspaceFile,
} from './workspace-state.mjs';

export default function checkRequirementsArtifact(_output, context) {
  const diff = diffProjectFiles(context);
  const scopePass = hasExactDiff(diff, {
    created: ['deliverables/requirements.md'],
  });
  let text = '';
  try {
    text = readWorkspaceFile(context, 'deliverables/requirements.md');
  } catch {
    text = '';
  }
  const preservesContracts =
    /(원본|raw)[^\n.]{0,40}(감사|audit)[^\n.]{0,60}(EU|유럽)[^\n.]{0,30}(외부|밖)[^\n.]{0,40}(금지|않|안)/i.test(text) &&
    /CSV[\s\S]{0,250}필드 이름[\s\S]{0,60}(유지|변경[^\n.]{0,20}않|변경해서는 안|바꾸[^\n.]{0,20}않)/i.test(text) &&
    /CSV[\s\S]{0,300}순서[\s\S]{0,60}(유지|변경[^\n.]{0,20}않|변경해서는 안|바꾸[^\n.]{0,20}않)/i.test(text);
  const preservesConditionAndException =
    /(감사)[\s\S]{0,200}(비활성|끄|꺼|해제)[\s\S]{0,200}7일/.test(text) &&
    /(법적 보존|legal hold)[^\n.]{0,50}(예외|유지|삭제하지)/i.test(text);
  const keepsUnknownsUnknown =
    /(암호화)[^\n.]{0,40}(미정|결정되지|선택되지|정해지지|정해야)/.test(text) &&
    /(자동 재시도)[^\n.]{0,40}(미정|결정되지|선택되지|정해지지|정해야)/.test(text);
  const preservesCurrentFailure =
    /(실패)[\s\S]{0,300}(사용자)[\s\S]{0,150}(알리|통지)[\s\S]{0,150}(종료)/.test(text) ||
    /(사용자)[\s\S]{0,150}(실패)[\s\S]{0,150}(알리|통지)[\s\S]{0,150}(종료)/.test(text);
  const preservesCurrentAndAlternative =
    preservesCurrentFailure &&
    /(외부 분석|분석 서비스)[\s\S]{0,180}(사용할 수 없|사용 불가|장애)[\s\S]{0,180}(수동\s*`?CSV`?\s*내보내기|수동 내보내기)/.test(text);
  const avoidsInvention =
    !/(99\.9|Kafka|Redis|PostgreSQL)/i.test(text) &&
    /웹훅[\s\S]{0,350}(제안|아이디어)[\s\S]{0,250}(아니|않|미승인|승인되지|승인 전)/.test(text) &&
    /(정하지 않은|정하지 않았다|결정되지 않았다|미정)[\s\S]{0,350}SLA[\s\S]{0,250}데이터베이스 종류[\s\S]{0,250}메시지 큐[\s\S]{0,250}구현 일정/i.test(text);
  const failed = [];
  if (!scopePass) failed.push(`요청한 산출물 외 파일 변경 (${formatDiff(diff)})`);
  if (!preservesContracts) failed.push('지역 금지 사항 또는 기존 CSV 계약을 보존하지 않음');
  if (!preservesConditionAndException) failed.push('삭제 조건과 법적 보존 예외를 보존하지 않음');
  if (!keepsUnknownsUnknown) failed.push('미정인 암호화 방식이나 자동 재시도를 결정으로 바꿈');
  if (!preservesCurrentAndAlternative) failed.push('현재 실패 동작 또는 수동 내보내기 대안을 누락함');
  if (!avoidsInvention) failed.push('자료에 없는 구현 요구사항을 추가함');
  return {
    pass: failed.length === 0,
    score: [scopePass, preservesContracts, preservesConditionAndException, keepsUnknownsUnknown, preservesCurrentAndAlternative, avoidsInvention].filter(Boolean).length / 6,
    reason: failed.length === 0 ? '금지, 기존 계약, 조건, 예외, 대안과 미정 사항을 그대로 보존한 산출물을 만들었다.' : failed.join(', '),
  };
}
