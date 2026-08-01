import { Codex } from '@openai/codex-sdk';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  applyAdjudications,
  artifactEvidence,
  artifactTranscript,
  assistantTranscript,
  buildArtifactJudgePrompt,
  buildJudgePrompt,
  buildSemanticJudgePrompt,
  compressionComparison,
  conditionOf,
  findCoreComponent,
  judgeOutputSchema,
  resolveBalancedVerdicts,
  semanticOutputSchema,
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
const judgeConcurrency = Math.max(1, Number.parseInt(process.env.PROOFLINE_JUDGE_CONCURRENCY ?? '3', 10) || 3);

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

let adjudicationFile;
if (existsSync(defaultAdjudicationsPath)) {
  const candidate = JSON.parse(readFileSync(defaultAdjudicationsPath, 'utf8'));
  if (candidate.sourceEvalId === source.evalId && (!candidate.sourceSha256 || candidate.sourceSha256 === sourceSha256)) {
    adjudicationFile = candidate;
  }
}
const appliedAdjudications = applyAdjudications(rows, adjudicationFile);

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

async function judgeOnce(codex, rubric, order, answers, lengths) {
  const thread = codex.startThread({
    model: 'gpt-5.6-sol',
    modelReasoningEffort: 'medium',
    workingDirectory: suiteDir,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  });
  const turn = await thread.run(buildJudgePrompt({
    rubric,
    answerA: answers[order[0]],
    answerB: answers[order[1]],
    lengthA: lengths[order[0]],
    lengthB: lengths[order[1]],
  }), { outputSchema: judgeOutputSchema });
  return { kind: 'response', order, verdict: JSON.parse(turn.finalResponse), usage: turn.usage };
}

async function judgeArtifactOnce(codex, rubric, order, artifacts) {
  const thread = codex.startThread({
    model: 'gpt-5.6-sol',
    modelReasoningEffort: 'medium',
    workingDirectory: suiteDir,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  });
  const turn = await thread.run(buildArtifactJudgePrompt({
    rubric,
    artifactA: artifacts[order[0]],
    artifactB: artifacts[order[1]],
  }), { outputSchema: judgeOutputSchema });
  return { kind: 'artifact', order, verdict: JSON.parse(turn.finalResponse), usage: turn.usage };
}

async function judgeSemanticOnce(codex, rubric, candidate, answer) {
  const thread = codex.startThread({
    model: 'gpt-5.6-sol',
    modelReasoningEffort: 'medium',
    workingDirectory: suiteDir,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchMode: 'disabled',
  });
  const turn = await thread.run(
    buildSemanticJudgePrompt({ rubric, answer }),
    { outputSchema: semanticOutputSchema },
  );
  return { kind: 'semantic', candidate, verdict: JSON.parse(turn.finalResponse), usage: turn.usage };
}

function readCaseRubric(row, caseName) {
  const relativePath = row.metadata?.artifactRubric ?? `rubrics/${caseName}.md`;
  const path = resolve(suiteDir, relativePath);
  const fromSuite = relative(suiteDir, path);
  if (fromSuite.startsWith('..') || isAbsolute(fromSuite)) {
    throw new Error(`평가 rubric 경로가 suite 밖을 가리킵니다: ${relativePath}`);
  }
  return readFileSync(path, 'utf8');
}

function compressionExcluded(disabledCore, enabledCore) {
  const failed = [];
  if (!disabledCore.pass) failed.push(`Proofline 없음 자동 핵심 기준 FAIL: ${disabledCore.reason}`);
  if (!enabledCore.pass) failed.push(`Proofline 적용 자동 핵심 기준 FAIL: ${enabledCore.reason}`);
  return {
    included: false,
    exclusionReason: failed.join(', '),
    disabledChars: null,
    enabledChars: null,
    change: null,
    changePercent: null,
  };
}

function usageTotal(calls) {
  return calls.reduce((total, call) => {
    for (const key of Object.keys(total)) total[key] += call.usage?.[key] ?? 0;
    return total;
  }, { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 });
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError;
  async function worker() {
    while (!firstError) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try { results[index] = await fn(items[index], index); }
      catch (error) { firstError ??= error; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => worker()));
  if (firstError) throw firstError;
  return results;
}

const grouped = new Map();
for (const row of rows) {
  if (!grouped.has(row.testIdx)) grouped.set(row.testIdx, []);
  grouped.get(row.testIdx).push(row);
}
const groupEntries = [...grouped.entries()].sort((a, b) => a[0] - b[0]).slice(0, judgeLimit > 0 ? judgeLimit : undefined);

const codexHome = createIsolatedCodexHome();
let comparisons;
try {
  const codex = new Codex({ env: isolatedEnvironment(codexHome) });
  comparisons = await mapWithConcurrency(groupEntries, judgeConcurrency, async ([testIdx, pair], index) => {
    const control = pair.find((row) => conditionOf(row) === 'control');
    const treatment = pair.find((row) => conditionOf(row) === 'treatment');
    if (!control || !treatment) throw new Error(`비교 쌍이 완전하지 않습니다: testIdx ${testIdx}`);
    const disabledCore = findCoreComponent(control);
    const enabledCore = findCoreComponent(treatment);
    if (!disabledCore || !enabledCore) throw new Error(`핵심 판정을 찾지 못했습니다: testIdx ${testIdx}`);
    const caseName = treatment.metadata.case;
    const comparisonMode = treatment.metadata.comparison ?? 'response';
    const artifacts = comparisonMode === 'artifact'
      ? { disabled: artifactEvidence(control), enabled: artifactEvidence(treatment) }
      : null;
    const base = {
      testIdx,
      case: caseName,
      label: caseLabels[caseName],
      comparisonMode,
      core: {
        disabled: { pass: disabledCore.pass, reason: disabledCore.reason },
        enabled: { pass: enabledCore.pass, reason: enabledCore.reason },
      },
      finalResponseChars: {
        disabled: String(control.response?.output ?? '').length,
        enabled: String(treatment.response?.output ?? '').length,
      },
      ...(artifacts ? { artifacts } : {}),
    };

    let result;
    if (disabledCore.pass !== enabledCore.pass) {
      const winner = enabledCore.pass ? 'enabled' : 'disabled';
      result = {
        ...base, winner, method: '핵심 기준 우선', consistent: true,
        reason: `${winner === 'enabled' ? 'Proofline 적용' : 'Proofline 없음'} 결과만 핵심 기준을 통과했다.`,
        judgeCalls: [],
        ...(comparisonMode === 'compression'
          ? { compression: compressionExcluded(disabledCore, enabledCore) }
          : {}),
        ...(comparisonMode === 'artifact'
          ? { artifactEvaluation: { performed: false, reason: '한쪽 artifact만 자동 핵심 기준을 통과했다.' } }
          : {}),
      };
    } else if (!disabledCore.pass) {
      result = {
        ...base, winner: 'tie', method: '양쪽 핵심 기준 실패', consistent: true,
        reason: '두 결과 모두 핵심 기준을 통과하지 못해 상대 우위를 인정하지 않았다.',
        judgeCalls: [],
        ...(comparisonMode === 'compression'
          ? { compression: compressionExcluded(disabledCore, enabledCore) }
          : {}),
        ...(comparisonMode === 'artifact'
          ? { artifactEvaluation: { performed: false, reason: '두 artifact 모두 자동 핵심 기준을 통과하지 못했다.' } }
          : {}),
      };
    } else if (comparisonMode === 'compression') {
      const rubric = readCaseRubric(treatment, caseName);
      const answers = { disabled: assistantTranscript(control), enabled: assistantTranscript(treatment) };
      const [disabledCall, enabledCall] = await Promise.all([
        judgeSemanticOnce(codex, rubric, 'disabled', answers.disabled),
        judgeSemanticOnce(codex, rubric, 'enabled', answers.enabled),
      ]);
      const semantic = {
        disabled: disabledCall.verdict,
        enabled: enabledCall.verdict,
      };
      const compression = compressionComparison({
        disabledPass: semantic.disabled.pass,
        enabledPass: semantic.enabled.pass,
        disabledChars: base.finalResponseChars.disabled,
        enabledChars: base.finalResponseChars.enabled,
      });
      const winner = semantic.disabled.pass === semantic.enabled.pass
        ? 'tie'
        : semantic.enabled.pass ? 'enabled' : 'disabled';
      result = {
        ...base,
        winner,
        method: '독립 의미 판정 후 표현 압축 측정',
        consistent: true,
        reason: compression.included
          ? '두 응답이 의미 PASS여서 이 반복을 표현 압축 길이 비교에 포함했다.'
          : compression.exclusionReason,
        semantic,
        compression,
        judgeCalls: [disabledCall, enabledCall],
      };
    } else if (
      comparisonMode === 'artifact'
      && typeof treatment.metadata.artifactRubric === 'string'
    ) {
      const rubric = readCaseRubric(treatment, caseName);
      const artifactAnswers = {
        disabled: artifactTranscript(control),
        enabled: artifactTranscript(treatment),
      };
      const [first, second] = await Promise.all([
        judgeArtifactOnce(codex, rubric, ['disabled', 'enabled'], artifactAnswers),
        judgeArtifactOnce(codex, rubric, ['enabled', 'disabled'], artifactAnswers),
      ]);
      result = {
        ...base,
        ...resolveBalancedVerdicts(first, second),
        method: 'artifact rubric 순서 교차 평가',
        artifactEvaluation: {
          performed: true,
          rubric: treatment.metadata.artifactRubric,
          basis: '수집된 실제 변경 artifact',
        },
        judgeCalls: [first, second],
      };
    } else if (comparisonMode === 'artifact') {
      result = {
        ...base,
        winner: 'tie',
        method: 'artifact 자동 핵심 기준 동급',
        consistent: true,
        reason: '두 artifact가 자동 핵심 기준을 통과했고 별도 artifactRubric이 없어 동점 처리했다.',
        artifactEvaluation: {
          performed: false,
          reason: 'artifactRubric이 지정되지 않았다.',
        },
        judgeCalls: [],
      };
    } else {
      const rubric = readCaseRubric(treatment, caseName);
      const answers = { disabled: assistantTranscript(control), enabled: assistantTranscript(treatment) };
      const lengths = base.finalResponseChars;
      const [first, second] = await Promise.all([
        judgeOnce(codex, rubric, ['disabled', 'enabled'], answers, lengths),
        judgeOnce(codex, rubric, ['enabled', 'disabled'], answers, lengths),
      ]);
      result = {
        ...base,
        ...resolveBalancedVerdicts(first, second),
        method: '순서 교차 LLM 평가',
        judgeCalls: [first, second],
      };
    }
    console.log(`[${index + 1}/${groupEntries.length}] ${caseLabels[caseName]}: ${result.winner}`);
    return result;
  });
} finally {
  rmSync(codexHome, { recursive: true, force: true });
}

const countWinner = (winner) => comparisons.filter((entry) => entry.winner === winner).length;
const cases = Object.entries(caseLabels).map(([caseName, label]) => {
  const entries = comparisons.filter((entry) => entry.case === caseName);
  const compressionEntries = entries.filter((entry) => entry.compression);
  const includedCompression = compressionEntries.filter((entry) => entry.compression.included);
  const disabledChars = includedCompression.reduce(
    (total, entry) => total + entry.compression.disabledChars,
    0,
  );
  const enabledChars = includedCompression.reduce(
    (total, entry) => total + entry.compression.enabledChars,
    0,
  );
  const change = enabledChars - disabledChars;
  return {
    case: caseName,
    label,
    disabled: entries.filter((entry) => entry.winner === 'disabled').length,
    enabled: entries.filter((entry) => entry.winner === 'enabled').length,
    tie: entries.filter((entry) => entry.winner === 'tie').length,
    artifactComparisons: entries.filter((entry) => entry.artifactEvaluation?.performed).length,
    compression: compressionEntries.length > 0 ? {
      included: includedCompression.length,
      excluded: compressionEntries.length - includedCompression.length,
      exclusions: compressionEntries
        .filter((entry) => !entry.compression.included)
        .map((entry) => ({ testIdx: entry.testIdx, reason: entry.compression.exclusionReason })),
      disabledChars,
      enabledChars,
      change,
      changePercent: disabledChars > 0
        ? Number(((change / disabledChars) * 100).toFixed(2))
        : null,
    } : null,
  };
}).filter((entry) => entry.disabled + entry.enabled + entry.tie > 0);
const allCalls = comparisons.flatMap((entry) => entry.judgeCalls);
const report = {
  schemaVersion: 3,
  source: { evalId: source.evalId, sha256: sourceSha256, path: sourcePath },
  judgedAt: new Date().toISOString(),
  judge: {
    model: 'gpt-5.6-sol', reasoningEffort: 'medium', order: 'AB와 BA 모두 평가',
    tieAllowed: true, comparisonConcurrency: judgeConcurrency,
  },
  taskModelCalls: 0,
  judgeModelCalls: allCalls.length,
  appliedAdjudications,
  totals: { disabled: countWinner('disabled'), enabled: countWinner('enabled'), tie: countWinner('tie') },
  usage: usageTotal(allCalls),
  cases,
  comparisons,
};

const compressionCase = cases.find((entry) => entry.compression);
const markdown = `# proofline-baseline-quality 순서 교차 평가\n\n| Proofline 없음 | Proofline 적용 | 동점 |\n| ---: | ---: | ---: |\n| ${report.totals.disabled} | ${report.totals.enabled} | ${report.totals.tie} |\n\n- 평가자: \`gpt-5.6-sol\`, 추론 강도 \`medium\`\n- 평가자 호출: ${report.judgeModelCalls}회\n- artifact 사례는 실제 변경 파일과 사례별 artifact rubric으로 평가\n- 표현 압축 길이 비교: 포함 ${compressionCase?.compression.included ?? 0}회, 제외 ${compressionCase?.compression.excluded ?? 0}회\n`;
for (const path of [outputJsonPath, outputMarkdownPath]) mkdirSync(dirname(path), { recursive: true });
writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(outputMarkdownPath, markdown, 'utf8');
console.log(`상대 평가 완료: 없음 ${report.totals.disabled}, 적용 ${report.totals.enabled}, 동점 ${report.totals.tie}`);
