import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const evalDir = resolve(import.meta.dirname, '..');
const suiteDir = join(evalDir, 'proofline-baseline-quality');
const localResultsDir = join(suiteDir, 'results', 'local');
const rawPath = resolve(process.argv[2] ?? join(localResultsDir, 'full.json'));
const pairwisePath = resolve(process.argv[3] ?? join(localResultsDir, 'full-pairwise.json'));
const adjudicationsPath = join(localResultsDir, 'full-adjudications.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(
    /[A-Za-z]:[\\/](?:[^\\/\r\n]+[\\/])*?eval[\\/]\.runtime[\\/]workspaces[\\/][0-9a-f-]+/gi,
    '<evaluation-workspace>',
  );
}

function taskUsage(row) {
  const usage = row.response?.tokenUsage ?? row.tokenUsage ?? {};
  return {
    total: usage.total ?? 0,
    prompt: usage.prompt ?? 0,
    completion: usage.completion ?? 0,
    cached: usage.cached ?? 0,
    reasoning: usage.completionDetails?.reasoning ?? 0,
  };
}

const rawBytes = readFileSync(rawPath);
const raw = JSON.parse(rawBytes.toString('utf8'));
const pairwise = readJson(pairwisePath);
const rawSha256 = sha256Bytes(rawBytes);
const comparisonRun = raw.metadata?.prooflineComparison;

if (comparisonRun?.architecture !== 'one-identical-prompt-two-isolated-providers') {
  throw new Error('새 격리 환경 방식으로 생성되지 않은 원시 결과는 현재 발행기로 공개할 수 없습니다.');
}

if (pairwise.source.evalId !== raw.evalId || pairwise.source.sha256 !== rawSha256) {
  throw new Error('상대평가 결과가 지정한 원시 결과와 일치하지 않습니다.');
}

const packageJson = readJson(join(evalDir, 'package.json'));
const packageLock = readJson(join(evalDir, 'package-lock.json'));
const taskProvider = raw.config?.providers?.[0]?.config ?? {};
const publishDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(pairwise.judgedAt));
const outputDir = resolve(
  process.argv[4] ?? join(suiteDir, 'results', 'published', publishDate),
);
if (['summary.md', 'metadata.json', 'result.json'].some((name) => existsSync(join(outputDir, name)))) {
  throw new Error(`기존 공개 결과를 덮어쓸 수 없습니다: ${outputDir}`);
}

const rowsByTest = new Map();
for (const row of raw.results.results) {
  if (!rowsByTest.has(row.testIdx)) rowsByTest.set(row.testIdx, []);
  rowsByTest.get(row.testIdx).push(row);
}

const appliedAdjudicationIds = new Set(pairwise.appliedAdjudications ?? []);
let publicAdjudications = [];
if (appliedAdjudicationIds.size > 0) {
  if (!existsSync(adjudicationsPath)) {
    throw new Error('상대평가에 적용된 재판정 기록이 없습니다.');
  }
  const adjudicationFile = readJson(adjudicationsPath);
  if (
    adjudicationFile.sourceEvalId !== raw.evalId ||
    adjudicationFile.sourceSha256 !== rawSha256
  ) {
    throw new Error('재판정 기록이 지정한 원시 결과와 일치하지 않습니다.');
  }
  const applied = adjudicationFile.adjudications.filter((entry) =>
    appliedAdjudicationIds.has(entry.sessionId),
  );
  if (applied.length !== appliedAdjudicationIds.size) {
    throw new Error('상대평가에 적용된 재판정 일부를 찾을 수 없습니다.');
  }
  publicAdjudications = applied.map((entry) => {
    const row = raw.results.results.find(
      (candidate) => candidate.metadata?.sessionId === entry.sessionId,
    );
    if (!row) throw new Error('재판정 대상 응답을 원시 결과에서 찾을 수 없습니다.');
    return {
      case: row.metadata.case,
      condition: row.promptIdx === 1 ? 'Proofline 적용' : 'Proofline 없음',
      metric: entry.metric,
      previousReason: entry.expected.reason,
      correctedReason: entry.replacement.reason,
      method: entry.method,
      basis: entry.basis,
    };
  });
}

const caseRepeats = new Map();
const comparisons = [...pairwise.comparisons]
  .sort((a, b) => a.testIdx - b.testIdx)
  .map((comparison) => {
    const rows = rowsByTest.get(comparison.testIdx) ?? [];
    const disabled = rows.find((row) => row.promptIdx === 0);
    const enabled = rows.find((row) => row.promptIdx === 1);
    if (!disabled || !enabled) {
      throw new Error(`공개할 비교 쌍이 완전하지 않습니다: testIdx ${comparison.testIdx}`);
    }
    const repeat = (caseRepeats.get(comparison.case) ?? 0) + 1;
    caseRepeats.set(comparison.case, repeat);
    const variant = (row, name) => ({
      executionIndex: comparison.testIdx * 2 + row.promptIdx + 1,
      variant: name,
      finalResponse: sanitizeText(row.response?.output ?? ''),
      core: comparison.core[name],
      usage: taskUsage(row),
    });
    return {
      comparison: comparison.testIdx + 1,
      case: comparison.case,
      label: comparison.label,
      category: enabled.metadata.category,
      repeat,
      variants: {
        disabled: variant(disabled, 'disabled'),
        enabled: variant(enabled, 'enabled'),
      },
      verdict: {
        winner: comparison.winner,
        method: comparison.method,
        consistentAcrossOrder: comparison.consistent,
        reason: comparison.reason,
        judgeCalls: comparison.judgeCalls.map((call) => ({
          order: call.order,
          winner: call.verdict.winner,
          reason: call.verdict.reason,
          criteria: call.verdict.criteria,
        })),
      },
    };
  });

const publishedCases = pairwise.cases.map((entry) => ({
  ...entry,
  label: entry.label,
}));
const caseMetrics = publishedCases.map((publishedCase) => {
  const caseComparisons = comparisons.filter((entry) => entry.case === publishedCase.case);
  const disabledChars = caseComparisons.reduce(
    (total, entry) => total + entry.variants.disabled.finalResponse.length,
    0,
  );
  const enabledChars = caseComparisons.reduce(
    (total, entry) => total + entry.variants.enabled.finalResponse.length,
    0,
  );
  const change = enabledChars - disabledChars;
  return {
    case: publishedCase.case,
    label: publishedCase.label,
    comparisons: caseComparisons.length,
    finalResponseChars: {
      disabled: disabledChars,
      enabled: enabledChars,
      change,
      changePercent: disabledChars > 0
        ? Number(((change / disabledChars) * 100).toFixed(2))
        : null,
    },
    corePass: {
      disabled: caseComparisons.filter((entry) => entry.variants.disabled.core.pass).length,
      enabled: caseComparisons.filter((entry) => entry.variants.enabled.core.pass).length,
    },
    pairwise: {
      disabled: publishedCase.disabled,
      enabled: publishedCase.enabled,
      tie: publishedCase.tie,
    },
  };
});

function formatCharacterChange({ change, changePercent }) {
  if (change === 0) return '차이 없음';
  const direction = change < 0 ? '감소' : '증가';
  const percentage = changePercent === null ? '-' : `${Math.abs(changePercent)}%`;
  return `${Math.abs(change)}자 ${direction} (${percentage})`;
}

const metadata = {
  schemaVersion: 1,
  suite: 'proofline-baseline-quality',
  suiteVersion: packageJson.version,
  evaluatedAt: raw.metadata?.evaluationCreatedAt,
  judgedAt: pairwise.judgedAt,
  repetitionsPerVariant: raw.runtimeOptions?.repeat,
  source: {
    evalId: raw.evalId,
    rawResultSha256: rawSha256,
  },
  target: {
    plugin: 'proofline',
    pluginVersion: comparisonRun.conditions.treatment.pluginVersion,
    pluginManifestSha256: comparisonRun.conditions.treatment.pluginManifestSha256,
    sessionStartHooksSha256: comparisonRun.conditions.treatment.hooksSha256,
    baselineSkillSha256: comparisonRun.conditions.treatment.baselineSkillSha256,
  },
  comparison: {
    userPromptTemplateSha256: comparisonRun.userPromptTemplateSha256,
    userPromptIdenticalAcrossConditions: true,
    control: 'isolated CODEX_HOME without Proofline plugin or hook',
    treatment: 'separate isolated CODEX_HOME with frozen Proofline plugin and SessionStart hook',
    sessionChecks: comparisonRun.sessionChecks,
    modelInputChecks: comparisonRun.modelInputChecks,
  },
  versions: {
    promptfoo: raw.metadata?.promptfooVersion ?? packageJson.devDependencies.promptfoo,
    codexSdk: packageLock.packages?.['node_modules/@openai/codex-sdk']?.version,
    node: raw.metadata?.nodeVersion,
  },
  taskModel: {
    model: taskProvider.model,
    reasoningEffort: taskProvider.model_reasoning_effort,
    sandboxMode: taskProvider.sandbox_mode,
    approvalPolicy: taskProvider.approval_policy,
    networkAccessEnabled: taskProvider.network_access_enabled,
    webSearchMode: taskProvider.web_search_mode,
  },
  judgeModel: pairwise.judge,
  execution: {
    maxConcurrency: raw.runtimeOptions?.maxConcurrency,
    cache: raw.runtimeOptions?.cache,
    order: '각 반복에서 Proofline 없음 후 Proofline 적용 순서로 실행',
  },
  adjudicationCount: publicAdjudications.length,
};

const result = {
  schemaVersion: 1,
  metadata,
  totals: pairwise.totals,
  cases: publishedCases,
  caseMetrics,
  taskModelCalls: comparisons.length * 2,
  judgeModelCalls: pairwise.judgeModelCalls,
  adjudications: publicAdjudications,
  comparisons,
};

const methodTotals = {
  core: { disabled: 0, enabled: 0, tie: 0 },
  judge: { disabled: 0, enabled: 0, tie: 0 },
};
for (const comparison of comparisons) {
  const method = comparison.verdict.judgeCalls.length > 0 ? 'judge' : 'core';
  methodTotals[method][comparison.verdict.winner] += 1;
}
const corePass = {
  disabled: comparisons.filter((entry) => entry.variants.disabled.core.pass).length,
  enabled: comparisons.filter((entry) => entry.variants.enabled.core.pass).length,
};
const orderConflicts = comparisons.filter(
  (entry) => entry.verdict.judgeCalls.length > 0 && !entry.verdict.consistentAcrossOrder,
).length;
const comparisonsPerVariant = comparisons.length;
const caseCount = pairwise.cases.length;
const repeatCount = caseCount > 0 ? comparisonsPerVariant / caseCount : 0;

const summary = `# proofline-baseline-quality 공개 평가 결과

## 전체 결과

| Proofline 없음 선택 | Proofline 적용 선택 | 동점 |
| ---: | ---: | ---: |
| ${pairwise.totals.disabled} | ${pairwise.totals.enabled} | ${pairwise.totals.tie} |

| 판정 단계 | Proofline 없음 | Proofline 적용 | 동점 |
| --- | ---: | ---: | ---: |
| 핵심 기준 우선 | ${methodTotals.core.disabled} | ${methodTotals.core.enabled} | ${methodTotals.core.tie} |
| 최종 답변 교차평가 | ${methodTotals.judge.disabled} | ${methodTotals.judge.enabled} | ${methodTotals.judge.tie} |

핵심 기준은 Proofline 없음 결과가 ${corePass.disabled}/${comparisonsPerVariant}, Proofline 적용 결과가 ${corePass.enabled}/${comparisonsPerVariant} 통과했다. 최종 답변 교차평가에서 순서를 바꿨을 때 판정이 달라진 ${orderConflicts}건은 동점 처리했다.

자동 평가 오판 ${publicAdjudications.length}건은 저장된 최종 응답과 실행 기록을 대조해 재판정했다. 공개한 재판정 근거는 [result.json](result.json)에 포함돼 있다.

## 사례별 결과

| 사례 | 핵심 통과<br>미적용 | 핵심 통과<br>적용 | 최종 선택<br>미적용/적용/동점 | 답변 길이 합계<br>미적용 | 답변 길이 합계<br>적용 | 적용 후 증감 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${caseMetrics.map((entry) => `| ${entry.label} | ${entry.corePass.disabled}/${entry.comparisons} | ${entry.corePass.enabled}/${entry.comparisons} | ${entry.pairwise.disabled}/${entry.pairwise.enabled}/${entry.pairwise.tie} | ${entry.finalResponseChars.disabled}자 | ${entry.finalResponseChars.enabled}자 | ${formatCharacterChange(entry.finalResponseChars)} |`).join('\n')}

답변 길이는 각 사례의 세 번 실행에서 사용자에게 표시된 최종 답변 문자 수를 합산했다. 길이 증감만으로 품질을 판정하지 않고, 같은 행의 핵심 기준 통과와 최종 비교 결과를 함께 본다.

## 실행 정보

- 평가 세트: \`proofline-baseline-quality\` ${packageJson.version}
- 반복: 조건별 ${raw.runtimeOptions?.repeat}회, 총 ${comparisons.length * 2}회 작업 실행
- 작업 모델: \`${taskProvider.model}\`, 추론 강도 \`${taskProvider.model_reasoning_effort}\`
- 평가 모델: \`${pairwise.judge.model}\`, 추론 강도 \`${pairwise.judge.reasoningEffort}\`
- 버전: Promptfoo \`${metadata.versions.promptfoo}\`, Codex SDK \`${metadata.versions.codexSdk}\`, Node.js \`${metadata.versions.node}\`
- 작업 실행 순서: 각 반복에서 Proofline 없음 후 Proofline 적용, 동시 실행 수 1. 매 실행은 새 세션과 새 작업공간을 사용
- 상대평가: A/B와 B/A 두 순서가 같은 실제 답변을 선택할 때만 승리
- 원시 결과 SHA-256: \`${rawSha256}\`
- 평가 대상 플러그인: Proofline \`${metadata.target.pluginVersion}\`
- 플러그인 manifest SHA-256: \`${metadata.target.pluginManifestSha256}\`
- SessionStart hook SHA-256: \`${metadata.target.sessionStartHooksSha256}\`
- baseline skill SHA-256: \`${metadata.target.baselineSkillSha256}\`
- 동일 사용자 프롬프트 SHA-256: \`${metadata.comparison.userPromptTemplateSha256}\`

## 해석 범위

이 결과는 공개된 ${caseCount}개 사례를 각 조건에서 ${repeatCount}회 실행한 범위에 한정된다. 모든 작업에서의 일반적인 우위를 의미하지 않는다. 각 실행은 서로 격리되지만 순차 실행 중 발생할 수 있는 모델의 시간대별 변동은 분리하지 않는다.

개별 최종 답변, 핵심 기준 판정과 순서 교차 평가 이유는 [result.json](result.json)에 포함돼 있다.
`;

const serializedResult = `${JSON.stringify(result, null, 2)}\n`;
if (/[A-Za-z]:[\\/]/.test(serializedResult) || /proofline-(?:eval|judge)-codex-/i.test(serializedResult)) {
  throw new Error('공개 결과에 로컬 절대 경로나 임시 Codex 폴더가 남아 있습니다.');
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
writeFileSync(join(outputDir, 'result.json'), serializedResult, 'utf8');
writeFileSync(join(outputDir, 'summary.md'), summary, 'utf8');

if (!existsSync(join(outputDir, 'result.json'))) {
  throw new Error('공개 결과 파일을 생성하지 못했습니다.');
}
console.log(`공개 결과 생성 완료: ${outputDir}`);
