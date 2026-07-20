import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const evalDir = resolve(import.meta.dirname, '..');
const repositoryDir = resolve(evalDir, '..');
const suiteDir = join(evalDir, 'proofline-baseline-quality');
const localResultsDir = join(suiteDir, 'results', 'local');
const rawPath = resolve(process.argv[2] ?? join(localResultsDir, 'full.json'));
const pairwisePath = resolve(process.argv[3] ?? join(localResultsDir, 'full-pairwise.json'));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function sanitizeText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(
    /[A-Za-z]:[\\/](?:[^\\/\r\n]+[\\/])*?eval[\\/]\.runtime[\\/]workspaces[\\/][0-9a-f-]+/gi,
    '<evaluation-workspace>',
  );
}

function routingResult(row) {
  const component = row.gradingResult?.componentResults?.find(
    (candidate) => candidate.assertion?.metric === '스킬 호출 정확성',
  );
  if (!component) throw new Error(`스킬 호출 판정이 없습니다: testIdx ${row.testIdx}`);
  return { pass: component.pass, reason: component.reason };
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

if (pairwise.source.evalId !== raw.evalId || pairwise.source.sha256 !== rawSha256) {
  throw new Error('상대평가 결과가 지정한 원시 결과와 일치하지 않습니다.');
}

const packageJson = readJson(join(evalDir, 'package.json'));
const packageLock = readJson(join(evalDir, 'package-lock.json'));
const skillPath = join(repositoryDir, 'skills', 'proofline-baseline-quality', 'SKILL.md');
const taskProvider = raw.config?.providers?.[0]?.config ?? {};
const publishDate = pairwise.judgedAt.slice(0, 10);
const outputDir = resolve(
  process.argv[4] ?? join(suiteDir, 'results', 'published', publishDate),
);

const rowsByTest = new Map();
for (const row of raw.results.results) {
  if (!rowsByTest.has(row.testIdx)) rowsByTest.set(row.testIdx, []);
  rowsByTest.get(row.testIdx).push(row);
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
      skillRouting: routingResult(row),
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
    skill: 'proofline-baseline-quality',
    skillSha256: sha256File(skillPath),
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
    order: '각 반복에서 스킬 미적용 후 스킬 적용 순서로 실행',
  },
};

const result = {
  schemaVersion: 1,
  metadata,
  totals: pairwise.totals,
  cases: pairwise.cases,
  taskModelCalls: comparisons.length * 2,
  judgeModelCalls: pairwise.judgeModelCalls,
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

const summary = `# proofline-baseline-quality 공개 평가 결과

## 전체 결과

| 스킬 미적용 선택 | 스킬 적용 선택 | 동점 |
| ---: | ---: | ---: |
| ${pairwise.totals.disabled} | ${pairwise.totals.enabled} | ${pairwise.totals.tie} |

| 판정 단계 | 스킬 미적용 | 스킬 적용 | 동점 |
| --- | ---: | ---: | ---: |
| 핵심 기준 우선 | ${methodTotals.core.disabled} | ${methodTotals.core.enabled} | ${methodTotals.core.tie} |
| 최종 답변 교차평가 | ${methodTotals.judge.disabled} | ${methodTotals.judge.enabled} | ${methodTotals.judge.tie} |

핵심 기준은 스킬 미적용 결과가 ${corePass.disabled}/18, 스킬 적용 결과가 ${corePass.enabled}/18 통과했다. 최종 답변 교차평가에서 순서를 바꿨을 때 판정이 달라진 ${orderConflicts}건은 동점 처리했다.

## 사례별 결과

| 사례 | 스킬 미적용 | 스킬 적용 | 동점 |
| --- | ---: | ---: | ---: |
${pairwise.cases.map((entry) => `| ${entry.label} | ${entry.disabled} | ${entry.enabled} | ${entry.tie} |`).join('\n')}

## 실행 정보

- 평가 세트: \`proofline-baseline-quality\` ${packageJson.version}
- 반복: 조건별 ${raw.runtimeOptions?.repeat}회, 총 ${comparisons.length * 2}회 작업 실행
- 작업 모델: \`${taskProvider.model}\`, 추론 강도 \`${taskProvider.model_reasoning_effort}\`
- 평가 모델: \`${pairwise.judge.model}\`, 추론 강도 \`${pairwise.judge.reasoningEffort}\`
- 버전: Promptfoo \`${metadata.versions.promptfoo}\`, Codex SDK \`${metadata.versions.codexSdk}\`, Node.js \`${metadata.versions.node}\`
- 작업 실행 순서: 각 반복에서 스킬 미적용 후 스킬 적용, 동시 실행 수 1
- 상대평가: A/B와 B/A 두 순서가 같은 실제 답변을 선택할 때만 승리
- 원시 결과 SHA-256: \`${rawSha256}\`
- 평가 대상 스킬 SHA-256: \`${metadata.target.skillSha256}\`

## 해석 범위

이 결과는 공개된 6개 사례를 각 조건에서 3회 실행한 범위에 한정된다. 모든 작업에서의 일반적인 우위를 의미하지 않는다. 작업 실행 순서를 무작위화하지 않았으므로 시간에 따른 모델 변동 가능성도 한계로 남는다.

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
