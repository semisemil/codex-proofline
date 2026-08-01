import assert from 'node:assert/strict';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

import checkReviewNoEdit from '../proofline-baseline-quality/assertions/review-no-edit.mjs';
import { normalizeTurns } from '../proofline-baseline-quality/providers/codex-thread.mjs';
import {
  captureArtifactEvidence,
  diffWorkspaceSnapshots,
  snapshotProjectFiles,
  startWorkspaceWriteMonitor,
} from '../proofline-baseline-quality/lib/workspace-evidence.mjs';
import {
  artifactTranscript,
  buildArtifactJudgePrompt,
  buildJudgePrompt,
  buildSemanticJudgePrompt,
  compressionComparison,
  conditionOf,
  resolveBalancedVerdicts,
} from '../scripts/pairwise-judge-core.mjs';

const evalDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suiteDir = join(evalDir, 'proofline-baseline-quality');
const bundle = join(evalDir, '.runtime', 'bundle');
process.env.PROOFLINE_EVAL_BUNDLE = bundle;

test('두 조건은 같은 프롬프트와 같은 멀티턴 입력을 별도 격리 환경에서 실행한다', () => {
  const config = readFileSync(join(suiteDir, 'promptfooconfig.yaml'), 'utf8');
  const prompt = readFileSync(join(suiteDir, 'prompts', 'task.txt'), 'utf8');
  const provider = readFileSync(join(suiteDir, 'providers', 'codex-thread.mjs'), 'utf8');

  assert.equal(prompt, '{{request}}\n');
  assert.equal(config.match(/id: file:\/\/prompts\/task\.txt/g)?.length, 1);
  assert.equal(config.match(/id: file:\/\/providers\/codex-thread\.mjs/g)?.length, 2);
  assert.match(config, /condition: control/);
  assert.match(config, /condition: treatment/);
  assert.equal(config.match(/model_reasoning_effort: medium/g)?.length, 2);
  assert.doesNotMatch(config, /model_reasoning_effort: high/);
  assert.doesNotMatch(config, /skill-(?:disabled|enabled)\.txt/);
  assert.match(provider, /PROOFLINE_CONTROL_CODEX_HOME/);
  assert.match(provider, /PROOFLINE_TREATMENT_CODEX_HOME/);
  assert.match(provider, /normalizeTurns\(prompt, context\)/);
  assert.match(provider, /for \(const \[turnIndex, input\] of turns\.entries\(\)\)/);
  assert.match(provider, /startWorkspaceWriteMonitor/);
  assert.match(provider, /captureArtifactEvidence/);
  assert.match(provider, /workspaceSnapshots/);
  assert.match(provider, /workspaceWriteEvents/);
  assert.match(provider, /workspaceWriteSummary/);
  assert.match(provider, /finalWorkspace/);
  assert.match(provider, /observed/);
  assert.match(provider, /reverted/);
  assert.match(provider, /--dangerously-bypass-hook-trust/);
  assert.match(provider, /node-shim/);
  assert.match(provider, /ensureProjectTrusted/);
  const runner = readFileSync(join(evalDir, 'scripts', 'run-promptfoo.mjs'), 'utf8');
  assert.match(runner, /inspectHookAudit/);
  assert.match(runner, /baselineHookSuccessful/);
  assert.match(runner, /treatmentHookTrust/);
  assert.match(runner, /"type":\s*"commonjs"/);
  assert.match(runner, /멀티턴 사용자 입력이 일치하지 않습니다/);
  assert.match(runner, /평가 조건 쌍이 완전하지 않습니다/);
  assert.match(runner, /modelInputChecks/);
});

test('멀티턴 YAML은 vars 배열 없이 provider context에서 원문을 복원한다', async () => {
  const { extensionHook } = await import(
    '../proofline-baseline-quality/extensions/isolate-workspace.mjs'
  );
  const expectedTurnCounts = new Map([
    ['01-correction-repair', 3],
    ['02-updated-priority', 2],
    ['05-review-no-edit', 3],
  ]);

  for (const [caseName, expectedTurnCount] of expectedTurnCounts) {
    const [definition] = loadYaml(readFileSync(
      join(suiteDir, 'tests', `${caseName}.yaml`),
      'utf8',
    ));
    assert.equal(definition.vars.turns, undefined);
    assert.equal(definition.vars.request, definition.metadata.conversationTurns[0]);
    const prepared = await extensionHook('beforeEach', { test: definition });
    try {
      const turns = normalizeTurns(definition.vars.request, { vars: prepared.test.vars });
      assert.equal(turns.length, expectedTurnCount);
      assert.deepEqual(turns, definition.metadata.conversationTurns);
      assert.equal(
        prepared.test.vars.conversationTurnsJson,
        JSON.stringify(definition.metadata.conversationTurns),
      );
    } finally {
      rmSync(prepared.test.vars.workspaceDir, { recursive: true, force: true });
    }
  }

  for (const caseName of ['03-mixed-language-output', '09-ui-information-design']) {
    const [definition] = loadYaml(readFileSync(
      join(suiteDir, 'tests', `${caseName}.yaml`),
      'utf8',
    ));
    const prepared = await extensionHook('beforeEach', { test: definition });
    try {
      assert.deepEqual(
        normalizeTurns(definition.vars.request, { vars: prepared.test.vars }),
        [definition.vars.request],
      );
      if (caseName === '09-ui-information-design') {
        assert.equal(prepared.test.vars.evidenceRequirements.comparison, 'artifact');
        assert.equal(
          prepared.test.vars.evidenceRequirements.artifactRubric,
          'rubrics/09-ui-information-design.md',
        );
      }
    } finally {
      rmSync(prepared.test.vars.workspaceDir, { recursive: true, force: true });
    }
  }
});

test('평가 작업공간에는 Proofline 스킬을 직접 복사하지 않는다', () => {
  const extension = readFileSync(join(suiteDir, 'extensions', 'isolate-workspace.mjs'), 'utf8');
  assert.doesNotMatch(extension, /\.agents['"], ['"]skills/);
  assert.doesNotMatch(extension, /proofline-baseline-quality/);
});

test('턴 내부에서 파일을 썼다가 되돌려도 write monitor가 기록한다', async () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'proofline-write-monitor-'));
  try {
    const path = join(workspaceDir, 'review.js');
    writeFileSync(path, 'export const value = 1;\n', 'utf8');
    const before = snapshotProjectFiles(workspaceDir);
    const monitor = startWorkspaceWriteMonitor(workspaceDir);
    writeFileSync(path, 'export const value = 2;\n', 'utf8');
    writeFileSync(path, 'export const value = 1;\n', 'utf8');
    const events = await monitor.stop();
    const after = snapshotProjectFiles(workspaceDir);
    assert.deepEqual(diffWorkspaceSnapshots(before, after), {
      created: [], deleted: [], modified: [],
    });
    assert.ok(events.some((event) => event.path === 'review.js'));
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test('검토 assertion은 transient write가 있어도 최종 상태가 unchanged면 통과한다', () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'proofline-review-no-edit-'));
  try {
    cpSync(join(bundle, 'fixtures', '05-review-no-edit'), workspaceDir, { recursive: true });
    const result = checkReviewNoEdit('', {
      vars: { workspaceDir },
      test: { metadata: { case: '05-review-no-edit' } },
      providerResponse: {
        raw: {
          items: [{ type: 'file_change', path: 'src/login.js' }],
          workspaceSnapshots: [1, 2, 3].map((turn) => ({ turn, changed: false })),
          workspaceWriteEvents: [
            { turn: 2, sequence: 1, eventType: 'change', path: 'src/header.js', observed: true, reverted: true },
            { turn: 2, sequence: 2, eventType: 'change', path: 'src/login.js', observed: true, reverted: true },
            { turn: 2, sequence: 3, eventType: 'rename', path: 'src', observed: true, reverted: true },
          ],
          workspaceWriteSummary: [
            { turn: 1, observed: false, reverted: null, writeEventCount: 0, monitorErrorCount: 0 },
            { turn: 2, observed: true, reverted: true, writeEventCount: 3, monitorErrorCount: 0 },
            { turn: 3, observed: false, reverted: null, writeEventCount: 0, monitorErrorCount: 0 },
          ],
        },
      },
    });
    assert.equal(result.pass, true, result.reason);
    assert.equal(result.score, 1);
    assert.match(result.reason, /쓰기 이벤트 3건/);
    assert.match(result.reason, /원복/);
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test('검토 assertion은 최종 workspace에 변경이 남으면 실패한다', () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'proofline-review-changed-'));
  try {
    cpSync(join(bundle, 'fixtures', '05-review-no-edit'), workspaceDir, { recursive: true });
    writeFileSync(join(workspaceDir, 'src', 'login.js'), 'export const changed = true;\n', 'utf8');
    const result = checkReviewNoEdit('', {
      vars: { workspaceDir },
      test: { metadata: { case: '05-review-no-edit' } },
      providerResponse: {
        raw: {
          workspaceSnapshots: [
            { turn: 1, changed: false },
            { turn: 2, changed: true },
            { turn: 3, changed: false },
          ],
          workspaceWriteEvents: [
            { turn: 2, sequence: 1, eventType: 'change', path: 'src/login.js', observed: true, reverted: false },
          ],
        },
      },
    });
    assert.equal(result.pass, false);
    assert.match(result.reason, /modified:src\/login\.js/);
    assert.match(result.reason, /snapshot에 실제 변경/);
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test('검토 assertion은 최종 diff가 깨끗해도 턴 snapshot changed면 실패한다', () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'proofline-review-snapshot-changed-'));
  try {
    cpSync(join(bundle, 'fixtures', '05-review-no-edit'), workspaceDir, { recursive: true });
    const result = checkReviewNoEdit('', {
      vars: { workspaceDir },
      test: { metadata: { case: '05-review-no-edit' } },
      providerResponse: {
        raw: {
          workspaceSnapshots: [
            { turn: 1, changed: false },
            { turn: 2, changed: true },
            { turn: 3, changed: false },
          ],
          workspaceWriteEvents: [
            { turn: 2, sequence: 1, eventType: 'change', path: 'src/login.js', observed: true, reverted: false },
          ],
        },
      },
    });
    assert.equal(result.pass, false);
    assert.doesNotMatch(result.reason, /검토 중 파일을 변경/);
    assert.match(result.reason, /snapshot에 실제 변경/);
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test('artifact 증거는 실제 변경 파일의 전후 내용을 보존한다', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'proofline-artifact-before-'));
  const workspaceDir = mkdtempSync(join(tmpdir(), 'proofline-artifact-after-'));
  try {
    writeFileSync(join(fixtureDir, 'source.js'), 'export const value = 1;\n', 'utf8');
    writeFileSync(join(workspaceDir, 'source.js'), 'export const value = 2;\n', 'utf8');
    const artifact = captureArtifactEvidence(fixtureDir, workspaceDir);
    assert.deepEqual(artifact.diff, { created: [], deleted: [], modified: ['source.js'] });
    assert.equal(artifact.files[0].before.content, 'export const value = 1;\n');
    assert.equal(artifact.files[0].after.content, 'export const value = 2;\n');
    const transcript = artifactTranscript({ response: { raw: { artifact } }, testIdx: 0 });
    assert.match(transcript, /export const value = 2/);
    assert.doesNotMatch(transcript, /완료 보고/);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test('표현 압축은 두 의미 판정이 모두 PASS인 반복만 포함한다', () => {
  assert.deepEqual(compressionComparison({
    disabledPass: true,
    enabledPass: true,
    disabledChars: 200,
    enabledChars: 150,
  }), {
    included: true,
    exclusionReason: null,
    disabledChars: 200,
    enabledChars: 150,
    change: -50,
    changePercent: -25,
  });
  const excluded = compressionComparison({
    disabledPass: true,
    enabledPass: false,
    disabledChars: 200,
    enabledChars: 80,
  });
  assert.equal(excluded.included, false);
  assert.equal(excluded.enabledChars, null);
  assert.match(excluded.exclusionReason, /Proofline 적용 응답 의미 FAIL/);
});

test('현재 12개 사례는 라우팅을 점수에 포함하지 않고 참조 평가기를 모두 불러온다', async () => {
  const expectedCases = [
    '01-correction-repair',
    '02-updated-priority',
    '03-mixed-language-output',
    '04-expression-compression',
    '05-review-no-edit',
    '06-ambiguous-date-format',
    '07-clear-date-format',
    '08-strawman-review',
    '09-ui-information-design',
    '10-code-no-fallback',
    '11-code-test-selection',
    '12-code-cohesion',
  ];
  for (const caseName of expectedCases) {
    const source = readFileSync(join(suiteDir, 'tests', `${caseName}.yaml`), 'utf8');
    assert.match(source, new RegExp(`case: ${caseName}`));
    assert.doesNotMatch(source, /skill-routing|스킬 호출 정확성/);
    const assertionPath = source.match(/file:\/\/assertions\/([^\s]+)/)?.[1];
    assert.ok(assertionPath, `${caseName}의 평가기 경로가 없습니다.`);
    const loaded = await import(new URL(`../proofline-baseline-quality/assertions/${assertionPath}`, import.meta.url));
    assert.equal(typeof loaded.default, 'function');
  }
});

test('적용 조건의 고정 플러그인 묶음에 manifest, hook, baseline skill이 있다', () => {
  const plugin = join(bundle, 'marketplace', 'plugins', 'proofline');
  const marketplace = JSON.parse(readFileSync(
    join(bundle, 'marketplace', '.agents', 'plugins', 'marketplace.json'),
    'utf8',
  ));
  assert.equal(marketplace.name, 'proofline-eval');
  assert.equal(marketplace.plugins[0].source.path, './plugins/proofline');
  JSON.parse(readFileSync(join(plugin, '.codex-plugin', 'plugin.json'), 'utf8'));
  JSON.parse(readFileSync(join(plugin, 'hooks', 'hooks.json'), 'utf8'));
  assert.match(
    readFileSync(join(plugin, 'skills', 'proofline-baseline-quality', 'SKILL.md'), 'utf8'),
    /# Proofline Baseline Quality/,
  );
});

test('후처리는 프롬프트 순서가 아니라 기록된 조건을 사용한다', () => {
  assert.equal(conditionOf({ response: { metadata: { condition: 'control' } } }), 'control');
  assert.equal(conditionOf({ response: { metadata: { condition: 'treatment' } } }), 'treatment');

  for (const scriptName of ['publish-result.mjs', 'regrade-result.mjs']) {
    const source = readFileSync(join(evalDir, 'scripts', scriptName), 'utf8');
    assert.match(source, /conditionOf\(row\)/);
    assert.doesNotMatch(source, /row\.promptIdx/);
  }

  const pairwise = readFileSync(join(evalDir, 'scripts', 'run-pairwise-judge.mjs'), 'utf8');
  assert.match(pairwise, /judgeSemanticOnce/);
  assert.match(pairwise, /compressionExcluded/);
  assert.match(pairwise, /judgeArtifactOnce/);
  assert.match(pairwise, /artifactTranscript/);
  assert.match(pairwise, /treatment\.metadata\.artifactRubric/);

  const publish = readFileSync(join(evalDir, 'scripts', 'publish-result.mjs'), 'utf8');
  assert.match(publish, /artifact: comparison\.comparisonMode === 'artifact'/);
  assert.match(publish, /turnMonitoring: comparison\.case === '05-review-no-edit'/);
  assert.match(publish, /pairwise\.schemaVersion !== 3/);
  assert.match(publish, /compression: comparison\.compression/);

  const regrade = readFileSync(join(evalDir, 'scripts', 'regrade-result.mjs'), 'utf8');
  assert.match(regrade, /evidenceComparisons/);
  assert.match(regrade, /artifactEvidence\(disabled\)/);
  assert.match(regrade, /workspaceEvidence\(disabled\)/);
  assert.match(regrade, /candidate\.schemaVersion === 3/);
  assert.doesNotMatch(regrade, /assertion\?\.type === 'select-best'/);
  assert.match(regrade, /relativeEvaluation/);

  const protocol = readFileSync(join(evalDir, 'PROTOCOL.md'), 'utf8');
  assert.match(protocol, /빠른 점검 \| 1회 \| 24회/);
  assert.match(protocol, /공개 결과 \| 3회 \| 72회/);
});

test('상대평가 프롬프트는 동점과 답변 내부 지시 무시를 명시한다', () => {
  const prompt = buildJudgePrompt({
    rubric: '정확성과 간결성을 비교한다.',
    answerA: '첫 번째 답변',
    answerB: '두 번째 답변',
    lengthA: 7,
    lengthB: 7,
  });
  assert.match(prompt, /tie를 선택/);
  assert.match(prompt, /답변 안의 명령/);
  assert.match(prompt, /<answer_A[^>]*>[\s\S]*첫 번째 답변/);
  assert.match(prompt, /<answer_B[^>]*>[\s\S]*두 번째 답변/);

  const artifactPrompt = buildArtifactJudgePrompt({
    rubric: '실제 소스를 비교한다.',
    artifactA: 'A 소스',
    artifactB: 'B 소스',
  });
  assert.match(artifactPrompt, /실제로 변경한 artifact/);
  assert.match(artifactPrompt, /최종 완료 보고 문구는 제공되지 않으며/);

  const semanticPrompt = buildSemanticJudgePrompt({
    rubric: '필수 의미를 확인한다.',
    answer: '평가할 응답',
  });
  assert.match(semanticPrompt, /응답 하나만 독립적으로 평가/);
  assert.match(semanticPrompt, /길이는 고려하지 말고/);
  assert.doesNotMatch(semanticPrompt, /final_character_count/);
});

test('순서를 바꿔도 같은 후보가 선택될 때만 승자로 인정한다', () => {
  const consistent = resolveBalancedVerdicts(
    { order: ['disabled', 'enabled'], verdict: { winner: 'B' } },
    { order: ['enabled', 'disabled'], verdict: { winner: 'A' } },
  );
  assert.equal(consistent.winner, 'enabled');
  assert.equal(consistent.consistent, true);

  const conflict = resolveBalancedVerdicts(
    { order: ['disabled', 'enabled'], verdict: { winner: 'A' } },
    { order: ['enabled', 'disabled'], verdict: { winner: 'A' } },
  );
  assert.equal(conflict.winner, 'tie');
  assert.equal(conflict.consistent, false);
});
