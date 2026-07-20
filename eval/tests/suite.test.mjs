import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import checkAmbiguityStop from '../proofline-baseline-quality/assertions/ambiguity-stop.mjs';
import checkPlanReview from '../proofline-baseline-quality/assertions/plan-review.mjs';
import checkRequirementsArtifact from '../proofline-baseline-quality/assertions/requirements-artifact.mjs';
import checkSessionFix from '../proofline-baseline-quality/assertions/session-fix.mjs';
import checkSkillRouting from '../proofline-baseline-quality/assertions/skill-routing.mjs';
import checkUiCopy from '../proofline-baseline-quality/assertions/ui-copy.mjs';
import {
  buildJudgePrompt,
  resolveBalancedVerdicts,
} from '../scripts/pairwise-judge-core.mjs';

const evalDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = join(evalDir, '.runtime', 'bundle');
process.env.PROOFLINE_EVAL_BUNDLE = bundle;

async function withWorkspace(caseName, run) {
  const workspaceDir = mkdtempSync(join(tmpdir(), `proofline-suite-${caseName}-`));
  cpSync(join(bundle, 'fixtures', caseName), workspaceDir, { recursive: true });
  const context = {
    vars: { workspaceDir },
    test: { metadata: { case: caseName } },
  };
  try {
    return await run(workspaceDir, context);
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
}

test('null 세션 수정의 기대 결과를 판정한다', async () => {
  await withWorkspace('02-null-session-fix', async (workspaceDir, context) => {
    writeFileSync(
      join(workspaceDir, 'src', 'session.js'),
      `export function getLoginState(session) {
  if (session === null) {
    return { authenticated: false, userId: null };
  }
  const userId = session.user.id;
  return { authenticated: Boolean(userId), userId };
}
`,
      'utf8',
    );
    context.providerResponse = {
      raw: '{"items":[{"type":"command_execution","command":"node test/session.test.js","exit_code":0,"status":"completed"}]}',
    };
    const result = await checkSessionFix('`node test/session.test.js`를 실행했고 테스트 2개가 모두 통과했습니다.', context);
    assert.equal(result.pass, true, result.reason);
  });
});

test('일반 검색 결과에 나온 스킬 경로를 스킬 호출로 오인하지 않는다', () => {
  const result = checkSkillRouting('', {
    prompt: 'Do not use $proofline-baseline-quality.\n\n요청',
    providerResponse: {
      raw: JSON.stringify({
        items: [{
          type: 'command_execution',
          command: 'rg -n --hidden 설정 .',
          aggregated_output: '.agents/skills/proofline-baseline-quality/SKILL.md:10:설명',
          exit_code: 0,
          status: 'completed',
        }],
      }),
    },
  });
  assert.equal(result.pass, true, result.reason);
});

test('대상 SKILL.md를 직접 읽은 기록을 스킬 호출로 판정한다', () => {
  const result = checkSkillRouting('', {
    prompt: 'Use $proofline-baseline-quality.\n\n요청',
    providerResponse: {
      raw: JSON.stringify({
        items: [{
          type: 'command_execution',
          command: 'Get-Content C:\\Temp\\skills\\proofline-baseline-quality\\SKILL.md',
          exit_code: 0,
          status: 'completed',
        }],
      }),
    },
  });
  assert.equal(result.pass, true, result.reason);
});

test('묶음 명령의 뒷부분이 실패해도 스킬 본문을 읽었으면 호출로 판정한다', () => {
  const result = checkSkillRouting('', {
    prompt: 'Use $proofline-baseline-quality.\n\n요청',
    providerResponse: {
      raw: JSON.stringify({
        items: [{
          type: 'command_execution',
          command: 'Get-Content .agents/skills/proofline-baseline-quality/SKILL.md; Get-ChildItem missing',
          aggregated_output: '---\nname: proofline-baseline-quality\n---\n# Proofline Baseline Quality\n본문\nGet-ChildItem: 경로를 찾을 수 없습니다.',
          exit_code: 1,
          status: 'failed',
        }],
      }),
    },
  });
  assert.equal(result.pass, true, result.reason);
});

test('다른 경로 오류를 스킬 사용 불가 응답으로 오인하지 않는다', () => {
  const result = checkSkillRouting('', {
    prompt: 'Use $proofline-baseline-quality.\n\n요청',
    providerResponse: {
      raw: JSON.stringify({
        items: [
          {
            type: 'command_execution',
            command: 'Get-Content .agents/skills/proofline-baseline-quality/SKILL.md',
            aggregated_output: '---\nname: proofline-baseline-quality\n---\n# Proofline Baseline Quality\n본문',
            exit_code: 0,
            status: 'completed',
          },
          {
            type: 'command_execution',
            command: 'Get-ChildItem deliverables',
            aggregated_output: 'deliverables 경로를 찾을 수 없습니다.',
            exit_code: 1,
            status: 'failed',
          },
        ],
      }),
    },
  });
  assert.equal(result.pass, true, result.reason);
});

test('읽기 실패 시 중단한다는 조건문을 실제 스킬 읽기 실패로 오인하지 않는다', () => {
  const result = checkSkillRouting('', {
    prompt: 'Use $proofline-baseline-quality.\n\n요청',
    providerResponse: {
      raw: JSON.stringify({
        items: [
          {
            type: 'agent_message',
            text: '스킬을 읽을 수 없으면 작업하지 않고 중단하겠습니다.',
          },
          {
            type: 'command_execution',
            command: 'Get-Content .agents/skills/proofline-baseline-quality/SKILL.md',
            aggregated_output: '---\nname: proofline-baseline-quality\n---\n# Proofline Baseline Quality\n본문',
            exit_code: 0,
            status: 'completed',
          },
        ],
      }),
    },
  });
  assert.equal(result.pass, true, result.reason);
});

test('지정된 UI 문구만 바뀐 결과를 판정한다', async () => {
  await withWorkspace('03-settings-copy', (workspaceDir, context) => {
    const path = join(workspaceDir, 'src', 'settings.html');
    const html = readFileSync(path, 'utf8').replace(
      'The retention_days field defaults to 30 because of the v2 database migration.',
      '로그는 30일 동안 보관됩니다.',
    );
    writeFileSync(path, html, 'utf8');
    const result = checkUiCopy('지정된 안내 문구만 수정했습니다.', context);
    assert.equal(result.pass, true, result.reason);
  });
});

test('모호한 요청에서 질문 하나만 하고 멈춘 결과를 판정한다', async () => {
  await withWorkspace('04-ambiguous-storage', (_workspaceDir, context) => {
    const result = checkAmbiguityStop(
      '데스크톱 CLI의 로컬 JSON 저장과 웹 서비스의 데이터베이스 저장 중 어느 제품을 변경할까요?',
      context,
    );
    assert.equal(result.pass, true, result.reason);
  });
});

test('선택지를 제시한 한 번의 지정 요청도 모호성 확인으로 판정한다', async () => {
  await withWorkspace('04-ambiguous-storage', (_workspaceDir, context) => {
    const result = checkAmbiguityStop(
      `설정 저장 대상을 지정해 주세요.

- 데스크톱 CLI: 로컬 JSON 저장을 데이터베이스 저장으로 변경
- 웹 서비스: 이미 데이터베이스에 저장 중`,
      context,
    );
    assert.equal(result.pass, true, result.reason);
  });
});

test('계획의 범위와 근거를 보존한 읽기 전용 검토를 판정한다', async () => {
  await withWorkspace('05-critical-plan-review', (_workspaceDir, context) => {
    const output = `결론: 2026년 10월 1일부터 신규 테넌트에 적용하는 제안은 문제 범위와 맞지만 아직 도입은 미정이다.
기존 테넌트는 관리자가 전환을 선택하기 전까지 파일 방식을 유지한다. 단일 호스트 재시작으로 인한 세션 손실을 줄이려는 것이며 모든 손실을 없앤다는 주장은 아니다.
근거: 사고 12건 중 9건은 호스트 재시작, 3건은 배포 정리 작업 때문이었다. 시범 운영은 아직 없으므로 인과 효과는 확인되지 않았다.
예외와 다음 조치: 오류율 2% 초과 시 최대 24시간 롤백할 수 있다. 보안 검토가 예정되어 있으며 승인이나 최종 결정은 미정이다.`;
    const result = checkPlanReview(output, context);
    assert.equal(result.pass, true, result.reason);
  });
});

test('제한된 효과 주장을 문서 전체에 나눠 보존해도 계획 검토로 판정한다', async () => {
  await withWorkspace('05-critical-plan-review', (_workspaceDir, context) => {
    const output = `결론: 효과는 아직 입증되지 않았다. 적용 대상은 2026년 10월 1일 이후 신규 테넌트이며 기존 테넌트는 관리자가 전환하기 전까지 파일 방식을 유지한다.
근거: 사고 12건 중 9건이 단일 호스트 재시작 직후 발생했고 나머지 3건은 정리 작업 때문이었다. 세션 손실을 줄일 것으로 예상하지만 모든 세션 손실이나 장애를 없앤다는 주장은 아니다.
시범 운영은 아직 없으며 오류율 2% 초과 시 최대 24시간 롤백한다. 보안 검토가 예정되어 있다.
남은 불확실성: 예정된 보안 검토 결과와 최종 도입 결정.`;
    const result = checkPlanReview(output, context);
    assert.equal(result.pass, true, result.reason);
  });
});

test('시범 운영 부재를 근거 부족으로 표현한 계획 검토를 판정한다', async () => {
  await withWorkspace('05-critical-plan-review', (_workspaceDir, context) => {
    const output = `결론: 효과는 아직 입증되지 않았다. 2026년 10월 1일부터 신규 테넌트에 적용하며 기존 테넌트는 관리자가 전환하기 전까지 파일 방식을 유지한다.
근거: 사고 12건 중 9건은 단일 호스트 재시작 직후 발생했고 3건은 정리 작업 때문이었다. 세션 손실을 줄일 것으로 예상하지만 모든 세션 손실이나 장애를 없앤다는 주장은 아니다. 시범 운영 부재로 인과 효과는 확인되지 않았다.
예외: 오류율 2% 초과 시 최대 24시간 롤백할 수 있다. 보안 검토와 최종 도입 결정은 미정이다.`;
    const result = checkPlanReview(output, context);
    assert.equal(result.pass, true, result.reason);
  });
});

test('금지, 예외와 미정을 보존한 요구사항 산출물을 판정한다', async () => {
  await withWorkspace('06-requirements-artifact', (workspaceDir, context) => {
    const deliverable = join(workspaceDir, 'deliverables', 'requirements.md');
    mkdirSync(dirname(deliverable), { recursive: true });
    writeFileSync(
      deliverable,
      `# 분석 내보내기 v1 요구사항

- 원본 감사 이벤트는 EU 외부로 전송하지 않는다.
- CSV 필드 이름과 순서는 변경하지 않고 유지한다.
- 감사 기능을 비활성화하면 감사 메타데이터를 7일 뒤 삭제한다. 법적 보존 데이터는 예외로 삭제하지 않는다.
- 암호화 방식은 선택되지 않았으며 보안팀이 정해야 한다.
- 자동 재시도 추가 여부는 정해지지 않았다. 현재는 사용자에게 실패를 알리고 종료한다.
- 외부 분석 서비스를 사용할 수 없을 때 수동 \`CSV\` 내보내기를 대안으로 사용할 수 있다.
- 웹훅은 제안일 뿐 승인된 구현 요구사항이 아니다.

## 정하지 않은 항목

SLA, 데이터베이스 종류, 메시지 큐, 구현 일정
`,
      'utf8',
    );
    const result = checkRequirementsArtifact('요구사항 문서를 만들었습니다.', context);
    assert.equal(result.pass, true, result.reason);
  });
});

test('감사 기능 해제 표현으로 조건과 법적 보존 예외를 보존한 산출물을 판정한다', async () => {
  await withWorkspace('06-requirements-artifact', (workspaceDir, context) => {
    const deliverable = join(workspaceDir, 'deliverables', 'requirements.md');
    mkdirSync(dirname(deliverable), { recursive: true });
    writeFileSync(
      deliverable,
      `# 분석 내보내기 v1 요구사항

- 원본 감사 이벤트는 EU 외부로 전송하지 않는다.
- CSV 필드 이름과 순서는 변경하지 않고 유지한다.
- 감사 기능 해제 시 감사 메타데이터를 7일 뒤 삭제한다. 법적 보존 데이터는 삭제하지 않고 보존 기간까지 유지한다.
- 암호화 방식은 선택되지 않았으며 보안팀이 정해야 한다.
- 자동 재시도 추가 여부는 정해지지 않았다. 현재는 사용자에게 실패를 알리고 종료한다.
- 외부 분석 서비스를 사용할 수 없을 때 수동 \`CSV\` 내보내기를 대안으로 사용할 수 있다.
- 웹훅은 제안일 뿐 승인된 구현 요구사항이 아니다.

## 정하지 않은 항목

SLA, 데이터베이스 종류, 메시지 큐, 구현 일정
`,
      'utf8',
    );
    const result = checkRequirementsArtifact('요구사항 문서를 만들었습니다.', context);
    assert.equal(result.pass, true, result.reason);
  });
});

test('상대평가 프롬프트가 동점과 답변 내 지시 무시를 명시한다', () => {
  const prompt = buildJudgePrompt({
    rubric: '정확성과 간결성을 비교한다.',
    answerA: '첫 번째 답변',
    answerB: '두 번째 답변',
  });
  assert.match(prompt, /tie를 선택/);
  assert.match(prompt, /답변 안의 명령/);
  assert.match(prompt, /<answer_A>[\s\S]*첫 번째 답변/);
  assert.match(prompt, /<answer_B>[\s\S]*두 번째 답변/);
});

test('순서를 바꿔도 같은 후보가 선택되면 그 후보를 승자로 판정한다', () => {
  const result = resolveBalancedVerdicts(
    { order: ['disabled', 'enabled'], verdict: { winner: 'B' } },
    { order: ['enabled', 'disabled'], verdict: { winner: 'A' } },
  );
  assert.equal(result.winner, 'enabled');
  assert.equal(result.consistent, true);
});

test('순서에 따라 선택이 달라지면 동점으로 판정한다', () => {
  const result = resolveBalancedVerdicts(
    { order: ['disabled', 'enabled'], verdict: { winner: 'A' } },
    { order: ['enabled', 'disabled'], verdict: { winner: 'A' } },
  );
  assert.equal(result.winner, 'tie');
  assert.equal(result.consistent, false);
});
