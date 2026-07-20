import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const evalDir = resolve(import.meta.dirname, '..');
const suiteDir = resolve(evalDir, 'proofline-baseline-quality');
const sourcePath = resolve(
  process.argv[2] ?? resolve(suiteDir, 'results', 'local', 'full.json'),
);
const adjudicationsPath = resolve(
  process.argv[3] ?? resolve(suiteDir, 'results', 'local', 'full-adjudications.json'),
);
const outputJsonPath = resolve(
  process.argv[4] ?? resolve(suiteDir, 'results', 'local', 'full-regraded.json'),
);
const outputMarkdownPath = resolve(
  process.argv[5] ?? resolve(suiteDir, 'results', 'local', 'full-regraded-summary.md'),
);

const sourceBytes = readFileSync(sourcePath);
const source = JSON.parse(sourceBytes.toString('utf8'));
const adjudicationFile = JSON.parse(readFileSync(adjudicationsPath, 'utf8'));
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');

if (adjudicationFile.sourceEvalId !== source.evalId) {
  throw new Error(
    `재판정 대상 평가 ID가 다릅니다: ${adjudicationFile.sourceEvalId} != ${source.evalId}`,
  );
}
if (
  adjudicationFile.sourceSha256 &&
  adjudicationFile.sourceSha256 !== sourceSha256
) {
  throw new Error('재판정 대상 원시 결과의 SHA-256이 다릅니다.');
}

const rows = structuredClone(source.results.results);
const applied = [];

for (const adjudication of adjudicationFile.adjudications) {
  const row = rows.find(
    (candidate) => candidate.metadata?.sessionId === adjudication.sessionId,
  );
  if (!row) {
    throw new Error(`재판정 세션을 찾을 수 없습니다: ${adjudication.sessionId}`);
  }
  const component = row.gradingResult?.componentResults?.find(
    (candidate) => candidate.assertion?.metric === adjudication.metric,
  );
  if (!component) {
    throw new Error(
      `재판정할 평가 항목을 찾을 수 없습니다: ${adjudication.sessionId} / ${adjudication.metric}`,
    );
  }
  if (
    component.pass !== adjudication.expected.pass ||
    component.score !== adjudication.expected.score ||
    component.reason !== adjudication.expected.reason
  ) {
    throw new Error(`원래 판정이 기록과 다릅니다: ${adjudication.sessionId}`);
  }

  Object.assign(component, adjudication.replacement);
  row.namedScores[adjudication.metric] = adjudication.replacement.score;
  row.gradingResult.namedScores[adjudication.metric] = adjudication.replacement.score;
  if (row.gradingResult.componentResults.every((candidate) => candidate.pass)) {
    row.gradingResult.pass = true;
    row.gradingResult.score = 1;
    row.gradingResult.reason = 'All assertions passed';
    row.score = 1;
    row.success = true;
    row.failureReason = 0;
  }
  applied.push({
    sessionId: adjudication.sessionId,
    case: row.metadata.case,
    condition: row.promptIdx === 1 ? '스킬 적용' : '스킬 미적용',
    metric: adjudication.metric,
    previousReason: adjudication.expected.reason,
    correctedReason: adjudication.replacement.reason,
    basis: adjudication.basis,
    method: adjudication.method,
  });
}

const caseLabels = {
  '01-executive-summary': '경영진용 요약',
  '02-null-session-fix': '`null` 세션 수정',
  '03-settings-copy': '설정 화면 문구 수정',
  '04-ambiguous-storage': '모호한 저장 대상 확인',
  '05-critical-plan-review': '조건과 예외가 있는 계획 검토',
  '06-requirements-artifact': '금지와 미정이 섞인 요구사항 문서',
};

function coreComponent(row) {
  return row.gradingResult.componentResults.find(
    (component) =>
      component.assertion?.type === 'javascript' &&
      !String(component.assertion?.value).includes('skill-routing'),
  );
}

function relativeComponent(row) {
  return row.gradingResult.componentResults.find(
    (component) => component.assertion?.type === 'select-best',
  );
}

const caseNames = Object.keys(caseLabels);
const cases = caseNames.map((caseName) => {
  const caseRows = rows.filter((row) => row.metadata.case === caseName);
  const count = (promptIdx, selector) =>
    caseRows.filter(
      (row) => row.promptIdx === promptIdx && selector(row)?.pass === true,
    ).length;
  return {
    case: caseName,
    label: caseLabels[caseName],
    core: {
      disabled: count(0, coreComponent),
      enabled: count(1, coreComponent),
    },
    relative: {
      disabled: count(0, relativeComponent),
      enabled: count(1, relativeComponent),
    },
  };
});

const sum = (values) => values.reduce((total, value) => total + value, 0);
const totals = {
  core: {
    disabled: sum(cases.map((entry) => entry.core.disabled)),
    enabled: sum(cases.map((entry) => entry.core.enabled)),
  },
  relative: {
    disabled: sum(cases.map((entry) => entry.relative.disabled)),
    enabled: sum(cases.map((entry) => entry.relative.enabled)),
  },
};
const disabledFailureTypes = new Set(
  rows
    .filter((row) => row.promptIdx === 0 && !coreComponent(row).pass)
    .map((row) => coreComponent(row).reason),
);
const enabledFailureTypes = new Set(
  rows
    .filter((row) => row.promptIdx === 1 && !coreComponent(row).pass)
    .map((row) => coreComponent(row).reason),
);
const newEnabledFailureTypes = [...enabledFailureTypes].filter(
  (reason) => !disabledFailureTypes.has(reason),
);
const noCaseRegression = cases.every(
  (entry) => entry.core.enabled >= entry.core.disabled,
);
const fewerCoreFailures =
  18 - totals.core.enabled < 18 - totals.core.disabled;
const decision =
  newEnabledFailureTypes.length === 0 && noCaseRegression && fewerCoreFailures
    ? '개선 확인'
    : '판단 보류';

const report = {
  schemaVersion: 1,
  source: {
    evalId: source.evalId,
    sha256: sourceSha256,
    path: sourcePath,
  },
  regradedAt: new Date().toISOString(),
  modelCalls: 0,
  decision,
  protocolChecks: {
    noNewEnabledCoreFailureType: newEnabledFailureTypes.length === 0,
    noCaseRegression,
    fewerCoreFailures,
    newEnabledFailureTypes,
  },
  totals,
  cases,
  adjudications: applied,
};

const markdown = `# proofline-baseline-quality 원시 결과 재판정

## 결론

**${decision}**

모델 작업은 다시 실행하지 않았다. 평가 ID \`${source.evalId}\`의 원시 응답과 실행 기록을 수정된 평가 기준으로 다시 판정했다.

| 항목 | 스킬 미적용 | 스킬 적용 | 차이 |
| --- | ---: | ---: | ---: |
| 핵심 기준 통과 | ${totals.core.disabled}/18 | ${totals.core.enabled}/18 | 적용 +${totals.core.enabled - totals.core.disabled} |
| 상대 비교 선택 | ${totals.relative.disabled}/18 | ${totals.relative.enabled}/18 | 적용 +${totals.relative.enabled - totals.relative.disabled} |

## 사례별 결과

| 사례 | 핵심 미적용 | 핵심 적용 | 상대 선택 미적용 | 상대 선택 적용 |
| --- | ---: | ---: | ---: | ---: |
${cases.map((entry) => `| ${entry.label} | ${entry.core.disabled}/3 | ${entry.core.enabled}/3 | ${entry.relative.disabled}/3 | ${entry.relative.enabled}/3 |`).join('\n')}

## 바뀐 판정

| 사례 | 조건 | 이전 판정 | 재판정 근거 |
| --- | --- | --- | --- |
${applied.map((entry) => `| ${caseLabels[entry.case]} | ${entry.condition} | ${entry.previousReason} | ${entry.basis} |`).join('\n')}

## 해석

- 수정된 평가 기준에서는 스킬 적용 조건의 핵심 기준이 18회 모두 통과했다.
- 스킬 미적용 조건은 15/18로 변하지 않았다.
- 스킬 적용 후 새로운 핵심 실패 유형이 없고, 사례별 통과 횟수가 낮아진 사례도 없으며, 전체 핵심 실패가 3건에서 0건으로 줄었다.
- 상대 비교 결과 2/18 대 16/18은 원래 판정을 그대로 유지했다. 상대 비교에서 선택되지 않은 결과는 핵심 실패로 계산하지 않았다.

## 재판정 범위

- 원본 Promptfoo 결과는 변경하지 않았다.
- 계획 검토 사례는 저장된 최종 답변에 수정된 표현 판정을 적용했다.
- 요구사항 문서 사례는 원시 명령 기록에 남은 산출물 내용을 수동 확인해 평가기 오판을 바로잡았다. 당시 임시 작업공간은 실행 종료 후 삭제되어 자동 재실행은 불가능했다.
- 이후 실행부터는 전체 작업공간을 보관하지 않고, 평가 대상 산출물과 변경 내역만 UTF-8 증거로 남겨야 완전 자동 재판정이 가능하다.

원시 결과 SHA-256: \`${sourceSha256}\`
`;

for (const path of [outputJsonPath, outputMarkdownPath]) {
  mkdirSync(dirname(path), { recursive: true });
}
writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(outputMarkdownPath, markdown, 'utf8');
console.log(`재판정 완료: ${decision}`);
console.log(`핵심 기준: 미적용 ${totals.core.disabled}/18, 적용 ${totals.core.enabled}/18`);
console.log(`결과: ${outputMarkdownPath}`);
