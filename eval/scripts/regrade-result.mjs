import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  artifactEvidence,
  conditionOf,
  findCoreComponent,
  workspaceEvidence,
} from './pairwise-judge-core.mjs';

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
const pairwisePath = resolve(
  process.argv[6] ?? resolve(suiteDir, 'results', 'local', 'full-pairwise.json'),
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
    condition: conditionOf(row) === 'treatment' ? 'Proofline 적용' : 'Proofline 없음',
    metric: adjudication.metric,
    previousReason: adjudication.expected.reason,
    correctedReason: adjudication.replacement.reason,
    basis: adjudication.basis,
    method: adjudication.method,
  });
}

let pairwise;
if (existsSync(pairwisePath)) {
  const candidate = JSON.parse(readFileSync(pairwisePath, 'utf8'));
  const recordedAdjudications = [...(candidate.appliedAdjudications ?? [])].sort();
  const currentAdjudications = applied.map((entry) => entry.sessionId).sort();
  if (
    candidate.schemaVersion === 3
    && candidate.source?.evalId === source.evalId
    && candidate.source?.sha256 === sourceSha256
    && JSON.stringify(recordedAdjudications) === JSON.stringify(currentAdjudications)
  ) {
    pairwise = candidate;
  }
}

const caseLabels = {
  '01-correction-repair': '지적 오류를 짚은 사용자 의도 반영',
  '02-updated-priority': '변경된 판단 기준으로 추천 갱신',
  '03-mixed-language-output': '한국어 중심 혼합 언어 출력',
  '04-expression-compression': '동등한 정보의 표현 압축',
  '05-review-no-edit': '멀티턴 검토의 수정 권한 제한',
  '06-ambiguous-date-format': '효과가 다른 대상 확인',
  '07-clear-date-format': '명확한 요청 즉시 실행',
  '08-strawman-review': '실제 주장에 근거한 검토',
  '09-ui-information-design': 'UI 문구와 정보 설계',
  '10-code-no-fallback': '과잉 방어·fallback 없는 구현',
  '11-code-test-selection': '필요한 테스트 선택',
  '12-code-cohesion': '사소한 함수 분해 방지',
};

const caseNames = Object.keys(caseLabels).filter((caseName) =>
  rows.some((row) => row.metadata.case === caseName),
);
const cases = caseNames.map((caseName) => {
  const caseRows = rows.filter((row) => row.metadata.case === caseName);
  const relativeComparisons = (pairwise?.comparisons ?? []).filter(
    (comparison) => comparison.case === caseName,
  );
  const count = (condition, selector) =>
    caseRows.filter(
      (row) => conditionOf(row) === condition && selector(row)?.pass === true,
    ).length;
  return {
    case: caseName,
    label: caseLabels[caseName],
    repetitions: caseRows.filter((row) => conditionOf(row) === 'control').length,
    core: {
      disabled: count('control', findCoreComponent),
      enabled: count('treatment', findCoreComponent),
    },
    relative: {
      disabled: relativeComparisons.filter((comparison) => comparison.winner === 'disabled').length,
      enabled: relativeComparisons.filter((comparison) => comparison.winner === 'enabled').length,
      tie: relativeComparisons.filter((comparison) => comparison.winner === 'tie').length,
      evaluated: relativeComparisons.length,
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
    tie: sum(cases.map((entry) => entry.relative.tie)),
    evaluated: sum(cases.map((entry) => entry.relative.evaluated)),
  },
};
const comparisonCount = sum(cases.map((entry) => entry.repetitions));

const pairwiseByTest = new Map(
  (pairwise?.comparisons ?? []).map((comparison) => [comparison.testIdx, comparison]),
);
const groupedRows = new Map();
for (const row of rows) {
  if (!groupedRows.has(row.testIdx)) groupedRows.set(row.testIdx, []);
  groupedRows.get(row.testIdx).push(row);
}
const evidenceComparisons = [...groupedRows.entries()].map(([testIdx, pair]) => {
  const disabled = pair.find((row) => conditionOf(row) === 'control');
  const enabled = pair.find((row) => conditionOf(row) === 'treatment');
  if (!disabled || !enabled) throw new Error(`재판정 비교 쌍이 완전하지 않습니다: testIdx ${testIdx}`);
  const comparisonMode = enabled.metadata.comparison ?? 'response';
  const recordedComparison = pairwiseByTest.get(testIdx);
  let compression = null;
  if (comparisonMode === 'compression') {
    compression = recordedComparison?.compression ?? {
      included: null,
      exclusionReason: '독립 의미 판정 결과가 없어 표현 압축 길이 비교를 재판정하지 않았다.',
      disabledChars: null,
      enabledChars: null,
      change: null,
      changePercent: null,
    };
  }
  return {
    testIdx,
    case: enabled.metadata.case,
    comparisonMode,
    artifact: comparisonMode === 'artifact' ? {
      disabled: artifactEvidence(disabled),
      enabled: artifactEvidence(enabled),
    } : null,
    turnMonitoring: enabled.metadata.case === '05-review-no-edit' ? {
      disabled: workspaceEvidence(disabled),
      enabled: workspaceEvidence(enabled),
    } : null,
    compression,
    relativeEvaluation: recordedComparison ? {
      winner: recordedComparison.winner,
      method: recordedComparison.method,
      reason: recordedComparison.reason,
      artifactEvaluation: recordedComparison.artifactEvaluation ?? null,
      semantic: recordedComparison.semantic ?? null,
    } : null,
  };
});

function failureTypes(row) {
  return findCoreComponent(row).reason
    .replace(/\s*\([^)]*\)/g, '')
    .split(', ')
    .map((reason) => reason.trim());
}

const disabledFailureTypes = new Set(
  rows
    .filter((row) => conditionOf(row) === 'control' && !findCoreComponent(row).pass)
    .flatMap(failureTypes),
);
const enabledFailureTypes = new Set(
  rows
    .filter((row) => conditionOf(row) === 'treatment' && !findCoreComponent(row).pass)
    .flatMap(failureTypes),
);
const newEnabledFailureTypes = [...enabledFailureTypes].filter(
  (reason) => !disabledFailureTypes.has(reason),
);
const noCaseRegression = cases.every(
  (entry) => entry.core.enabled >= entry.core.disabled,
);
const fewerCoreFailures =
  comparisonCount - totals.core.enabled < comparisonCount - totals.core.disabled;
const decision =
  newEnabledFailureTypes.length === 0 && noCaseRegression && fewerCoreFailures
    ? '개선 확인'
    : '판단 보류';

const report = {
  schemaVersion: 2,
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
  evidenceComparisons,
};

const artifactEvidenceCount = evidenceComparisons.filter(
  (entry) => entry.artifact !== null,
).length;
const monitoredTurnComparisonCount = evidenceComparisons.filter(
  (entry) => entry.turnMonitoring !== null,
).length;
const compressionEvidence = evidenceComparisons.filter(
  (entry) => entry.compression !== null,
);
const includedCompressionCount = compressionEvidence.filter(
  (entry) => entry.compression.included === true,
).length;
const excludedCompressionCount = compressionEvidence.filter(
  (entry) => entry.compression.included === false,
).length;
const pendingCompressionCount = compressionEvidence.filter(
  (entry) => entry.compression.included === null,
).length;

const markdown = `# proofline-baseline-quality 원시 결과 재판정

## 결론

**${decision}**

모델 작업은 다시 실행하지 않았다. 평가 ID \`${source.evalId}\`의 원시 응답과 실행 기록을 수정된 평가 기준으로 다시 판정했다.

| 항목 | Proofline 없음 | Proofline 적용 | 차이 |
| --- | ---: | ---: | ---: |
| 핵심 기준 통과 | ${totals.core.disabled}/${comparisonCount} | ${totals.core.enabled}/${comparisonCount} | 적용 +${totals.core.enabled - totals.core.disabled} |
| 상대 비교 선택 | ${totals.relative.disabled}/${totals.relative.evaluated} | ${totals.relative.enabled}/${totals.relative.evaluated} | 적용 +${totals.relative.enabled - totals.relative.disabled} |

## 사례별 결과

| 사례 | 핵심 미적용 | 핵심 적용 | 상대 선택 미적용 | 상대 선택 적용 |
| --- | ---: | ---: | ---: | ---: |
${cases.map((entry) => `| ${entry.label} | ${entry.core.disabled}/${entry.repetitions} | ${entry.core.enabled}/${entry.repetitions} | ${entry.relative.disabled}/${entry.relative.evaluated} | ${entry.relative.enabled}/${entry.relative.evaluated} |`).join('\n')}

## 바뀐 판정

| 사례 | 조건 | 이전 판정 | 재판정 근거 |
| --- | --- | --- | --- |
${applied.map((entry) => `| ${caseLabels[entry.case]} | ${entry.condition} | ${entry.previousReason} | ${entry.basis} |`).join('\n')}

## 해석

- 수정된 평가 기준에서 Proofline 적용 조건의 핵심 기준은 ${totals.core.enabled}/${comparisonCount}, 없음 조건은 ${totals.core.disabled}/${comparisonCount} 통과했다.
- Proofline 적용 후 새로운 핵심 실패 유형은 ${newEnabledFailureTypes.length}개이며, 사례별 회귀 여부는 ${noCaseRegression ? '없음' : '있음'}, 전체 핵심 실패는 ${comparisonCount - totals.core.disabled}건에서 ${comparisonCount - totals.core.enabled}건으로 바뀌었다.
- 상대 비교 선택은 스키마 3 상대평가 결과가 있는 ${totals.relative.evaluated}개 비교에서 미적용 ${totals.relative.disabled}, 적용 ${totals.relative.enabled}, 동점 ${totals.relative.tie}이다. 상대평가 결과가 없으면 기존 최종 응답 기반 판정을 재사용하지 않고 미판정으로 남긴다.

## 재판정 범위

- 원본 Promptfoo 결과는 변경하지 않았다.
- 실제 artifact 증거가 보존된 비교: ${artifactEvidenceCount}개
- 턴별 snapshot과 쓰기 감시 증거가 보존된 비교: ${monitoredTurnComparisonCount}개
- 표현 압축 길이 비교: 포함 ${includedCompressionCount}개, 제외 ${excludedCompressionCount}개, 독립 의미 판정 미기록 ${pendingCompressionCount}개
- 독립 의미 판정은 원본과 재판정 기록이 일치하는 상대평가 결과가 있을 때만 재사용한다. 없으면 모델을 다시 호출하지 않고 미판정으로 남긴다.
- 사례 09~12의 우열은 스키마 3 상대평가에 기록된 실제 artifact 판정만 재사용한다. 최종 보고 기반의 이전 상대판정은 재사용하지 않는다.

원시 결과 SHA-256: \`${sourceSha256}\`
`;

for (const path of [outputJsonPath, outputMarkdownPath]) {
  mkdirSync(dirname(path), { recursive: true });
}
writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(outputMarkdownPath, markdown, 'utf8');
console.log(`재판정 완료: ${decision}`);
console.log(`핵심 기준: 미적용 ${totals.core.disabled}/${comparisonCount}, 적용 ${totals.core.enabled}/${comparisonCount}`);
console.log(`결과: ${outputMarkdownPath}`);
