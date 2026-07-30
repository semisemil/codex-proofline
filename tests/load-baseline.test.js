const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const hookPath = path.join(repoRoot, 'hooks', 'load-baseline.js');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

// 실제 패키지 구조에서 훅이 본문을 출력하는지 확인한다.
test('baseline hook loads the packaged skill', () => {
  const result = spawnSync(process.execPath, [hookPath], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Proofline Baseline Quality/);
  assert.doesNotMatch(result.stdout, /^---/);
  assert.ok(result.stdout.includes(path.join(repoRoot, 'skills', 'proofline-baseline-quality', 'references', 'ui.md')));
  assert.ok(result.stdout.includes(path.join(repoRoot, 'skills', 'proofline-baseline-quality', 'references', 'code.md')));
});

// 누락된 패키지 파일은 조용히 넘어가지 않고 진단 가능한 오류를 반환해야 한다.
test('baseline hook reports a missing skill', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-hook-'));
  const tempHookDir = path.join(tempRoot, 'hooks');
  const tempHome = path.join(tempRoot, 'home');
  // 성공과 실패에 관계없이 테스트용 훅과 로그를 제거한다.
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  fs.mkdirSync(tempHookDir, { recursive: true });
  fs.copyFileSync(hookPath, path.join(tempHookDir, 'load-baseline.js'));

  const result = spawnSync(process.execPath, [path.join(tempHookDir, 'load-baseline.js')], {
    encoding: 'utf8',
    env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
  });
  const logPath = path.join(tempHome, '.codex', 'log', 'proofline-hook.log');
  const entry = JSON.parse(fs.readFileSync(logPath, 'utf8').trim());

  assert.equal(result.status, 1);
  assert.equal(entry.code, 'ENOENT');
  assert.match(entry.skillPath, /proofline-baseline-quality[\\/]SKILL\.md$/);
});

test('Spec v2 keeps lifecycle metadata separate from the contract body', () => {
  const skill = read('skills', 'proofline-implementation-spec', 'SKILL.md');
  const template = read('skills', 'proofline-implementation-spec', 'assets', 'templates', 'spec.md');

  assert.match(skill, /\.proofline\/specs\/<SPEC-ID>-<slug>\/SPEC\.md/);
  assert.match(skill, /schema_version: 2/);
  assert.match(skill, /nested `Behavior:` and observable `Done when:`/);
  assert.match(skill, /`Verification` only when a check\/environment is contractual/);
  assert.doesNotMatch(skill, /assets\/templates\/prd\.md|REQ-001`\/`AC-001/);

  assert.match(template, /"schema_version": 2/);
  assert.match(template, /{{spec_body}}/);
  assert.doesNotMatch(template, /created_at|updated_at|archived_at|# .*{{title}}/);

  const rendered = template
    .replace('{{spec_id_json}}', JSON.stringify('SPEC-0001'))
    .replace('{{title_json}}', JSON.stringify('Fix: settings #1'))
    .replace('{{kind_json}}', JSON.stringify('bug'))
    .replace('{{status_json}}', JSON.stringify('ready'))
    .replace('{{revision}}', '1')
    .replace('{{supersedes_json}}', '[]')
    .replace('{{related_issues_json}}', '["PL-0001"]')
    .replace('{{spec_body}}', '## Current\n\nObserved behavior.');
  const metadata = JSON.parse(rendered.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);

  assert.deepEqual(Object.keys(metadata), [
    'schema_version',
    'id',
    'title',
    'kind',
    'status',
    'revision',
    'supersedes',
    'superseded_by',
    'related_issues',
  ]);
  assert.equal(metadata.title, 'Fix: settings #1');
});

test('implementation review is opt-in before work and runs in a blind subagent after work', () => {
  const coordinator = read('skills', 'proofline-start-implementation', 'SKILL.md');
  const implementation = read('skills', 'proofline-start-implementation', 'references', 'implementation-prompt.md');
  const preReview = read('skills', 'proofline-start-implementation', 'references', 'pre-review-prompt.md');
  const postReview = read('skills', 'proofline-start-implementation', 'references', 'post-review-prompt.md');
  const modelRouting = read('skills', 'proofline-start-implementation', 'assets', 'model-routing.md');

  assert.match(coordinator, /Run only when the user explicitly requests it/);
  assert.match(coordinator, /Use no fixed (?:review-)?attempt limit/);
  assert.match(coordinator, /no_verdict.*missing implementation evidence/);
  assert.doesNotMatch(coordinator, /Allow three post-review attempts|\.proofline\/prds\/<PRD-ID>/);

  assert.match(implementation, /pre-existing changed paths/);
  assert.match(implementation, /task-attributable paths/);
  assert.match(preReview, /Do not block for implementation choices/);
  // 사후 검토가 별도 작업이나 이전 이력에 종속되지 않도록 실행 경계를 고정한다.
  assert.match(coordinator, /post-review.*`spawn_agent`.*`fork_turns: "none"`/i);
  assert.match(coordinator, /never use `create_thread` to run a post-review/i);
  assert.match(coordinator, /Never pass implementation or pre-review reports, prior review reports\/findings/);
  assert.match(postReview, /Independently review the current implementation/);
  assert.match(postReview, /Do not request or use work reports, prior reviews\/findings/);
  assert.doesNotMatch(postReview, /Latest report|implementation_report_text|implementation_task|review_attempt/);
  assert.match(modelRouting, /Pass no task\/report\/review history or expected conclusion/);
  assert.match(postReview, /exactly one verdict: `pass`, `changes_required`, or `no_verdict`/);
});

test('Work Slices are conditional, compact, and reviewed locally before final integration', () => {
  const coordinator = read('skills', 'proofline-start-implementation', 'SKILL.md');
  const slicing = read('skills', 'proofline-start-implementation', 'references', 'slicing.md');
  const template = read('skills', 'proofline-start-implementation', 'assets', 'templates', 'slice.md');
  const sliceReview = read('skills', 'proofline-start-implementation', 'references', 'post-review-slice.md');
  const finalReview = read('skills', 'proofline-start-implementation', 'references', 'post-review-final.md');

  assert.match(coordinator, /Default to direct implementation/);
  assert.match(coordinator, /Record the chain baseline before writing a Slice plan/);
  assert.match(coordinator, /never block because a ready Spec has none/);
  assert.match(coordinator, /mark only that Slice `completed`/);
  assert.match(coordinator, /fresh blind final review/);
  // 슬라이스 및 최종 검토도 이전 작업과 검토 결과를 입력으로 받지 않는다.
  for (const review of [sliceReview, finalReview]) {
    assert.match(review, /Do not request or use work reports, prior reviews\/findings/);
    assert.doesNotMatch(review, /Latest.*report|implementation_report_text|integration_report_text|review_attempt|review_references/);
  }

  assert.match(slicing, /Do not divide by file, component, layer, or test type/);
  assert.match(slicing, /reference parent `REQ-\*` IDs without copying their contract text/);
  assert.match(slicing, /readiness is derived, not stored/);
  assert.match(slicing, /use direct mode and create no Slice files/);

  assert.match(template, /"schema_version": 1/);
  assert.match(template, /"blocked_by": \{\{blocked_by_json\}\}/);
  assert.match(template, /\{\{slice_body\}\}/);
  assert.doesNotMatch(template, /created_at|updated_at|# .*\{\{title/);

  const rendered = template
    .replace('{{slice_id_json}}', JSON.stringify('SLICE-01'))
    .replace('{{spec_id_json}}', JSON.stringify('SPEC-0001'))
    .replace('{{spec_revision}}', '2')
    .replace('{{title_json}}', JSON.stringify('Deliver settings flow'))
    .replace('{{blocked_by_json}}', '[]')
    .replace('{{slice_body}}', '## Delivers\n\nSettings can be saved.\n\n## Covers\n\n- REQ-001');
  const metadata = JSON.parse(rendered.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  assert.deepEqual(Object.keys(metadata), [
    'schema_version',
    'id',
    'spec_id',
    'spec_revision',
    'title',
    'status',
    'blocked_by',
  ]);
  assert.equal(metadata.status, 'pending');

  assert.match(sliceReview, /Inspect the Slice outcome, assigned REQs/);
  assert.match(sliceReview, /ignore unrelated Spec areas/);
  assert.doesNotMatch(finalReview, /Treat passed Slice reviews as local proof/);
  assert.match(finalReview, /Inspect complete REQ coverage, cross-Slice integration/);
  assert.match(finalReview, /Use only the current Spec, project state/);
});

test('skill completion boundaries are single-sourced and checkable', () => {
  const baseline = read('skills', 'proofline-baseline-quality', 'SKILL.md');
  const baselineCode = read('skills', 'proofline-baseline-quality', 'references', 'code.md');
  const baselineUi = read('skills', 'proofline-baseline-quality', 'references', 'ui.md');
  const completion = read('skills', 'proofline-completion-evidence', 'SKILL.md');
  const exactPortReport = read('skills', 'proofline-exact-port', 'assets', 'templates', 'exact-port-report.md');
  const refactorReport = read('skills', 'proofline-refactor-proof', 'assets', 'templates', 'refactor-proof-report.md');
  const scope = read('skills', 'proofline-scope-integrity', 'SKILL.md');
  const growth = read('skills', 'proofline-capability-growth', 'SKILL.md');

  assert.match(baseline, /read and apply every rule in `references\/ui\.md`/);
  assert.match(baseline, /Before writing or changing visible UI text/);
  assert.match(baseline, /read and apply every rule in `references\/code\.md`/);
  assert.doesNotMatch(baseline, /clear names, cohesive functions|interface narration/);
  assert.match(baselineUi, /interface narration, intent paraphrases/);
  assert.match(baseline, /## Review and evidence\r?\n/);
  assert.match(baseline, /For review, audit, diagnosis, or critique/);
  // 표현 압축의 적용 범위와 명시적 선별, 판단 위임, 검토 형식이 보존 및 권한 규칙과 충돌하지 않아야 한다.
  assert.match(baseline, /Apply expression compression to every response and artifact/);
  assert.match(baseline, /controls how in-scope content is expressed, not what is in scope/);
  assert.match(baseline, /preserve information, structure, style, and the user's instructions/);
  assert.match(baseline, /Preserve source form for exact reproduction, evidentiary fidelity/);
  assert.doesNotMatch(baseline, /Preserve source text only when/);
  assert.match(baseline, /established whole-term expression in the intended output language/);
  assert.match(baseline, /If none exists in that language/);
  // 출력 언어 규칙은 중복된 소문자 검사에 의존하지 않아야 한다.
  assert.doesNotMatch(baseline, /Lowercase Latin prose outside protected spans/);
  assert.match(baseline, /Within the requested scope, preserve the meaning of retained source information/);
  assert.match(baseline, /Do not infer intent, preference, policy, or approval from absence, incompleteness, or incidental state/);
  assert.match(baseline, /Treat authoritative sources as evidence only for what they establish/);
  assert.match(baseline, /Permission to decide does not authorize dependent action/);
  assert.match(baseline, /explicitly delegates the substantive choice and separately requests the dependent action/);
  assert.match(baseline, /read-only answer can fully cover them without choosing among them/);
  assert.match(baseline, /Proceed without asking when context resolves the interpretation/);
  assert.match(baseline, /propose rather than apply language corrections/);
  assert.match(baseline, /answer's substance, an artifact's required content or target/);
  assert.match(baseline, /differ only in presentation while preserving the requested meaning and format/);
  assert.match(baseline, /follow the user's requested scope and any specified report format/);
  assert.match(baseline, /Use examples according to their communicative purpose/);
  assert.match(baseline, /may identify one case or demonstrate a broader issue/);
  assert.doesNotMatch(baseline, /Corrections apply only to the named case/);
  assert.match(baseline, /keep useful headings and lists, separate distinct information/);
  assert.match(baseline, /address the actual claim within its scope and exceptions/i);
  assert.doesNotMatch(baseline, /do not remove information from the source|do not merge its items into prose|Do not pack distinct information|Never strengthen it/);

  // 함수 크기와 지역적으로 가능한 상태가 불필요한 추출 및 방어 처리를 유도하지 않아야 한다.
  assert.match(baselineCode, /clear names, cohesive functions/);
  assert.doesNotMatch(baselineCode, /clear names, small functions/);
  assert.match(baselineCode, /local possibility as unproven reachability/);
  assert.match(baselineCode, /creation and validation paths and business rules/);
  assert.match(baselineCode, /upstream-excluded states outside normal flow/);
  assert.match(baselineCode, /ask the user first/);

  assert.match(baseline, /Reuse inspected task evidence for follow-ups while state is unchanged/);
  assert.match(baseline, /requested current verification, changed state, or missing detail/);
  assert.match(baseline, /Memory and other task history are locators until rechecked/);
  assert.match(completion, /separate completed work, passed checks, failed checks/);
  assert.match(completion, /including earlier turns while relevant state is unchanged/);
  assert.match(completion, /Answer follow-up questions about a reported result directly from that unchanged task evidence/);
  assert.match(completion, /including unchanged evidence from earlier turns/);
  assert.doesNotMatch(completion, /Never use intention, memory, past success/);
  assert.match(completion, /implementation-caused failed check makes the task incomplete/);
  assert.match(completion, /confirmed pre-existing or unrelated failure/);
  assert.match(completion, /uncertain attribution as unverified/);
  assert.doesNotMatch(exactPortReport, /## Issues recorded/);
  assert.doesNotMatch(refactorReport, /## Issues recorded/);

  assert.match(scope, /each non-negotiable requirement and checkpoint has an observed outcome/);
  assert.match(scope, /scope changes are approved/);
  assert.match(scope, /each planned verification has a result or unverified reason/);

  assert.equal((growth.match(/  - Complete when/g) || []).length, 3);
  assert.match(growth, /each inspected workflow is shortlisted/);
  assert.match(growth, /an inspected alternative is sufficient or an evidenced gap remains/);
  assert.match(growth, /artifact matches approved scope\/files/);
});

test('the copyable migration is one-to-one, atomic, and leaves legacy PRDs untouched', () => {
  const migration = read('docs', 'migrations', 'prd-to-spec.md');
  const readme = read('README.md');

  assert.match(migration, /Treat `\.proofline\/prds\/\*\*` as read-only/);
  assert.match(migration, /PRD-0007-<slug>\/PRD\.md` -> `SPEC-0007-<slug>\/SPEC\.md/);
  assert.match(migration, /write nothing and report every conflict/);
  assert.match(migration, /Do not edit, move, rename, or delete any source/);
  assert.match(readme, /docs\/migrations\/prd-to-spec\.md/);
});
