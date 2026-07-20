import { Codex } from '@openai/codex-sdk';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  applyAdjudications,
  buildJudgePrompt,
  findCoreComponent,
  judgeOutputSchema,
  resolveBalancedVerdicts,
} from './pairwise-judge-core.mjs';

const evalDir = resolve(import.meta.dirname, '..');
const suiteDir = join(evalDir, 'proofline-baseline-quality');
const sourcePath = resolve(process.argv[2] ?? join(suiteDir, 'results', 'local', 'full.json'));
const outputJsonPath = resolve(process.argv[3] ?? join(suiteDir, 'results', 'local', 'full-pairwise.json'));
const outputMarkdownPath = resolve(process.argv[4] ?? join(suiteDir, 'results', 'local', 'full-pairwise-summary.md'));
const defaultAdjudicationsPath = join(suiteDir, 'results', 'local', 'full-adjudications.json');
const sourceBytes = readFileSync(sourcePath);
const source = JSON.parse(sourceBytes.toString('utf8'));
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const rows = structuredClone(source.results.results);
const judgeLimit = Number.parseInt(process.env.PROOFLINE_JUDGE_LIMIT ?? '0', 10);
const judgeConcurrency = Math.max(
  1,
  Number.parseInt(process.env.PROOFLINE_JUDGE_CONCURRENCY ?? '3', 10) || 3,
);

let adjudicationFile;
if (existsSync(defaultAdjudicationsPath)) {
  const candidate = JSON.parse(readFileSync(defaultAdjudicationsPath, 'utf8'));
  if (candidate.sourceEvalId === source.evalId && (!candidate.sourceSha256 || candidate.sourceSha256 === sourceSha256)) {
    adjudicationFile = candidate;
  }
}
const appliedAdjudications = applyAdjudications(rows, adjudicationFile);

const rubricPath = (caseName) => join(suiteDir, 'rubrics', `${caseName}.md`);
const caseLabels = {
  '01-executive-summary': '경영진용 요약',
  '02-null-session-fix': '`null` 세션 수정',
  '03-settings-copy': '설정 화면 문구 수정',
  '04-ambiguous-storage': '모호한 저장 대상 확인',
  '05-critical-plan-review': '조건과 예외가 있는 계획 검토',
  '06-requirements-artifact': '금지와 미정이 섞인 요구사항 문서',
};

function createIsolatedCodexHome() {
  const isolatedHome = mkdtempSync(join(tmpdir(), 'proofline-judge-codex-'));
  if (process.platform === 'win32') {
    writeFileSync(join(isolatedHome, 'config.toml'), '[windows]\nsandbox = "unelevated"\n', 'utf8');
  }
  if (!process.env.OPENAI_API_KEY && !process.env.CODEX_API_KEY) {
    const sourceAuth = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
    if (!existsSync(sourceAuth)) throw new Error('Codex 로그인 정보를 찾지 못했습니다.');
    copyFileSync(sourceAuth, join(isolatedHome, 'auth.json'));
  }
  return isolatedHome;
}

function isolatedEnvironment(codexHome) {
  const names = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'OPENAI_API_KEY', 'CODEX_API_KEY'];
  return Object.fromEntries([
    ...names.filter((name) => process.env[name]).map((name) => [name, process.env[name]]),
    ['CODEX_HOME', codexHome],
    ['HOME', codexHome],
    ['USERPROFILE', codexHome],
  ]);
}

async function judgeOnce(codex, rubric, order, answers) {
  const thread = codex.startThread({
    model: 'gpt-5.6-sol',
    modelReasoningEffort: 'low',
    workingDirectory: suiteDir,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  });
  const turn = await thread.run(
    buildJudgePrompt({ rubric, answerA: answers[order[0]], answerB: answers[order[1]] }),
    { outputSchema: judgeOutputSchema },
  );
  const verdict = JSON.parse(turn.finalResponse);
  return { order, verdict, usage: turn.usage };
}

function usageTotal(calls) {
  return calls.reduce(
    (total, call) => {
      for (const key of Object.keys(total)) total[key] += call.usage?.[key] ?? 0;
      return total;
    },
    { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 },
  );
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError;

  async function worker() {
    while (!firstError) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        firstError ??= error;
      }
    }
  }

  const workerCount = Math.min(concurrency, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (firstError) throw firstError;
  return results;
}

const grouped = new Map();
for (const row of rows) {
  if (!grouped.has(row.testIdx)) grouped.set(row.testIdx, []);
  grouped.get(row.testIdx).push(row);
}

const codexHome = createIsolatedCodexHome();
let comparisons;
const groupEntries = [...grouped.entries()]
  .sort((a, b) => a[0] - b[0])
  .slice(0, judgeLimit > 0 ? judgeLimit : undefined);
try {
  const codex = new Codex({ env: isolatedEnvironment(codexHome) });
  comparisons = await mapWithConcurrency(groupEntries, judgeConcurrency, async ([testIdx, pair], index) => {
    const current = index + 1;
    const disabled = pair.find((row) => row.promptIdx === 0);
    const enabled = pair.find((row) => row.promptIdx === 1);
    if (!disabled || !enabled) throw new Error(`비교 쌍이 완전하지 않습니다: testIdx ${testIdx}`);
    const disabledCore = findCoreComponent(disabled);
    const enabledCore = findCoreComponent(enabled);
    const caseName = enabled.metadata.case;
    const base = {
      testIdx,
      case: caseName,
      label: caseLabels[caseName],
      core: {
        disabled: { pass: disabledCore.pass, reason: disabledCore.reason },
        enabled: { pass: enabledCore.pass, reason: enabledCore.reason },
      },
    };
    if (disabledCore.pass !== enabledCore.pass) {
      const winner = enabledCore.pass ? 'enabled' : 'disabled';
      const result = {
        ...base,
        winner,
        method: '핵심 기준 우선',
        consistent: true,
        reason: `${winner === 'enabled' ? '스킬 적용' : '스킬 미적용'} 결과만 핵심 기준을 통과했다.`,
        judgeCalls: [],
      };
      console.log(`[${current}/${groupEntries.length}] ${caseLabels[caseName]}: 핵심 기준으로 ${winner}`);
      return result;
    }
    if (!disabledCore.pass) {
      const result = {
        ...base,
        winner: 'tie',
        method: '둘 다 핵심 기준 실패',
        consistent: true,
        reason: '두 결과 모두 핵심 기준을 통과하지 못해 상대 우위를 인정하지 않았다.',
        judgeCalls: [],
      };
      console.log(`[${current}/${groupEntries.length}] ${caseLabels[caseName]}: 둘 다 핵심 실패`);
      return result;
    }

    const rubric = readFileSync(rubricPath(caseName), 'utf8');
    const answers = { disabled: disabled.response.output, enabled: enabled.response.output };
    const [first, second] = await Promise.all([
      judgeOnce(codex, rubric, ['disabled', 'enabled'], answers),
      judgeOnce(codex, rubric, ['enabled', 'disabled'], answers),
    ]);
    const resolution = resolveBalancedVerdicts(first, second);
    const result = {
      ...base,
      ...resolution,
      method: '순서 교차 LLM 평가',
      judgeCalls: [first, second],
    };
    console.log(`[${current}/${groupEntries.length}] ${caseLabels[caseName]}: ${resolution.winner}${resolution.consistent ? '' : ' (순서 불일치)'}`);
    return result;
  });
} finally {
  rmSync(codexHome, { recursive: true, force: true });
}

const countWinner = (winner) => comparisons.filter((entry) => entry.winner === winner).length;
const cases = Object.entries(caseLabels).map(([caseName, label]) => {
  const entries = comparisons.filter((entry) => entry.case === caseName);
  return {
    case: caseName,
    label,
    disabled: entries.filter((entry) => entry.winner === 'disabled').length,
    enabled: entries.filter((entry) => entry.winner === 'enabled').length,
    tie: entries.filter((entry) => entry.winner === 'tie').length,
  };
});
const allCalls = comparisons.flatMap((entry) => entry.judgeCalls);
const report = {
  schemaVersion: 1,
  source: { evalId: source.evalId, sha256: sourceSha256, path: sourcePath },
  judgedAt: new Date().toISOString(),
  judge: {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'low',
    order: 'AB와 BA 모두 평가',
    tieAllowed: true,
    comparisonConcurrency: judgeConcurrency,
  },
  taskModelCalls: 0,
  judgeModelCalls: allCalls.length,
  appliedAdjudications,
  totals: { disabled: countWinner('disabled'), enabled: countWinner('enabled'), tie: countWinner('tie') },
  usage: usageTotal(allCalls),
  cases,
  comparisons,
};

const details = comparisons.map((entry) => {
  const calls = entry.judgeCalls.map((call, index) => {
    const order = call.order.map((value) => (value === 'enabled' ? '스킬 적용' : '스킬 미적용')).join(' / ');
    const criteria = call.verdict.criteria.map((item) => `  - ${item.criterion}: ${item.winner} — ${item.reason}`).join('\n');
    return `#### 순서 ${index + 1}: ${order}\n\n- 판정: ${call.verdict.winner}\n- 이유: ${call.verdict.reason}\n${criteria}`;
  }).join('\n\n');
  return `<details>\n<summary>${entry.testIdx + 1}. ${entry.label} — ${entry.winner}</summary>\n\n- 방식: ${entry.method}\n- 최종 이유: ${entry.reason}\n\n${calls}\n\n</details>`;
}).join('\n\n');
const markdown = `# proofline-baseline-quality 순서 교차 상대평가

## 결과

| 스킬 미적용 선택 | 스킬 적용 선택 | 동점 |
| ---: | ---: | ---: |
| ${report.totals.disabled} | ${report.totals.enabled} | ${report.totals.tie} |

기존 작업 응답을 재사용했으며 작업 모델 호출은 0회다. 핵심 기준에서 한쪽만 통과하면 그 결과를 선택하고, 둘 다 통과한 경우에만 같은 평가자가 A/B와 B/A 두 순서로 평가했다. 순서별 판정이 다르면 동점으로 처리했다.

## 사례별 결과

| 사례 | 미적용 | 적용 | 동점 |
| --- | ---: | ---: | ---: |
${cases.map((entry) => `| ${entry.label} | ${entry.disabled} | ${entry.enabled} | ${entry.tie} |`).join('\n')}

## 실행 정보

- 원본 평가 ID: \`${source.evalId}\`
- 평가자: \`gpt-5.6-sol\`, 추론 강도 \`low\`
- 평가자 호출: ${report.judgeModelCalls}회
- 원본 작업 모델 재호출: 0회
- 재판정 보정 적용: ${appliedAdjudications.length}건
- 원본 SHA-256: \`${sourceSha256}\`

## 비교별 이유

${details}
`;

for (const path of [outputJsonPath, outputMarkdownPath]) mkdirSync(dirname(path), { recursive: true });
writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(outputMarkdownPath, markdown, 'utf8');
console.log(`상대평가 완료: 미적용 ${report.totals.disabled}, 적용 ${report.totals.enabled}, 동점 ${report.totals.tie}`);
console.log(`결과: ${outputMarkdownPath}`);
