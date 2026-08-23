const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const hookPath = path.join(repoRoot, 'hooks', 'load-proofline.js');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

// 실제 패키지 구조에서 훅이 본문을 출력하는지 확인한다.
test('Proofline hook loads the packaged baseline and one supported response mode', () => {
  const result = spawnSync(process.execPath, [hookPath], {
    encoding: 'utf8',
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Proofline/);
  assert.doesNotMatch(result.stdout, /^---/);
  assert.match(result.stdout, /## Language and compression/);
  assert.match(result.stdout, /Treat as owner-component contracts: named protocol rules, untrusted-input boundaries, and lifecycle states/);
  assert.equal((result.stdout.match(/^# (?:Normal|Focus|Caveman) response mode$/gm) || []).length, 1);
});

// 누락된 패키지 파일은 조용히 넘어가지 않고 진단 가능한 오류를 반환해야 한다.
test('Proofline hook reports a missing skill', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-hook-'));
  const tempHookDir = path.join(tempRoot, 'hooks');
  const tempHome = path.join(tempRoot, 'home');
  // 성공과 실패에 관계없이 테스트용 훅과 로그를 제거한다.
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  fs.mkdirSync(tempHookDir, { recursive: true });
  fs.copyFileSync(hookPath, path.join(tempHookDir, 'load-proofline.js'));
  fs.copyFileSync(
    path.join(repoRoot, 'hooks', 'proofline-state.js'),
    path.join(tempHookDir, 'proofline-state.js'),
  );

  const result = spawnSync(process.execPath, [path.join(tempHookDir, 'load-proofline.js')], {
    encoding: 'utf8',
    env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }),
  });
  const logPath = path.join(tempHome, '.codex', 'log', 'proofline-hook.log');
  const entry = JSON.parse(fs.readFileSync(logPath, 'utf8').trim());

  assert.equal(result.status, 1);
  assert.equal(entry.code, 'ENOENT');
  assert.equal(entry.pluginRoot, tempRoot);
  assert.match(entry.skillPath, /proofline[\\/]SKILL\.md$/);
  assert.match(entry.filePath, /proofline[\\/]SKILL\.md$/);
});

test('Spec v2 keeps a fixed envelope and writes an adaptive standalone implementation document', () => {
  const skill = read('skills', 'implementation-spec', 'SKILL.md');
  const template = read('skills', 'implementation-spec', 'assets', 'templates', 'spec.md');

  assert.match(skill, /\.proofline\/specs\/<SPEC-ID>-<slug>\/SPEC\.md/);
  assert.match(skill, /schema_version: 2/);
  assert.match(skill, /standalone implementation document/);
  assert.match(skill, /Write the Spec body in the target language's conventional telegraphic style/);
  assert.match(skill, /Compress content as far as possible without loss of meaning/);
  assert.match(skill, /Use tables and bullets when they improve structure, preferring tables when either form works/);
  assert.match(skill, /Avoid terminal periods/);
  assert.match(skill, /Keep a short, dense development-document style/);
  assert.match(skill, /Keep each acceptance condition, its material boundaries and fixed decisions, and its planned evidence together enough for implementation and review/);
  assert.match(skill, /Use Mermaid for graph-shaped relationships with multiple branches or actors/);
  assert.doesNotMatch(skill, /Organize by outcomes that can be observed independently|Name each outcome for the result it defines|Match information to the work|Treat these as information needs rather than required headings/);
  assert.doesNotMatch(skill, /Use Mermaid when state transitions/);
  assert.doesNotMatch(skill, /let its information determine the internal structure|State constraints and evidence shared by several outcomes once for all of them|Omit a title heading|one authoritative location|minimum sufficient proof|telegraphic contract|compact items/);
  assert.match(skill, /When a ready Plan is supplied or linked, use it as the primary planning source/);
  assert.match(skill, /Convert the current intent into observable acceptance conditions and a pre-implementation test and verification plan/);
  assert.match(skill, /Every required result has planned evidence capable of deciding it; every acceptance condition is supported by a source/);
  assert.match(skill, /Do not add product behavior or generic error, performance, or quality conditions absent from the sources/);
  assert.match(skill, /Include linked information required for implementation or review/);
  assert.match(skill, /Current contract only/);
  assert.match(skill, /Every material source intent is represented, every acceptance condition is source-supported/);
  assert.match(skill, /the implementer can proceed without inventing product behavior/);
  assert.match(skill, /implementation requires a separate user request/);
  assert.doesNotMatch(skill, /Every product behavior traces to one of those sources|Expose material gaps and use `draft`|Discussion history, investigation logs, rejected alternatives, and repeated metadata|Repository-discoverable mechanics and ordinary validation commands do not prevent `ready`|Never ask for implementation approval/);
  assert.doesNotMatch(skill, /Build a review path before writing details|Give a small change one compact block|Name sections after what changes or what the reader must judge/);
  assert.doesNotMatch(skill, /`feature`: `Outcome`, `Contract`/);
  assert.doesNotMatch(skill, /assets\/templates\/prd\.md|REQ-\d+|nested `Behavior:`|observable `Done when:`|plausible adjacent behavior/);

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

test('planning intent becomes an acceptance and verification contract without fixed body sections', () => {
  const plan = read('skills', 'development-plan', 'SKILL.md');
  const spec = read('skills', 'implementation-spec', 'SKILL.md');
  const tenet = read('skills', 'tenet-me', 'SKILL.md');

  assert.match(plan, /initial idea, later clarifications, corrections, and confirmed choices as sources/);
  assert.match(plan, /without reopening the conversation or inventing a material product decision/);
  assert.match(plan, /leave observable acceptance conditions and the pre-implementation verification plan to a later Spec/);
  assert.doesNotMatch(plan, /Choose its structure, length, examples, tables, and diagrams|Keep facts, decisions, proposals or assumptions/);

  assert.match(spec, /ready Plan is supplied or linked[\s\S]*primary planning source/);
  assert.match(spec, /acceptance conditions and a pre-implementation test and verification plan/);
  assert.match(spec, /Every required result has planned evidence capable of deciding it/);
  assert.doesNotMatch(spec, /AC-\*|Gherkin|required acceptance table|fixed heading/);

  assert.match(tenet, /source intent to each acceptance condition and planned verification/);
  assert.match(tenet, /trace every acceptance condition back to its source intent and forward to verification capable of deciding it/);
  assert.match(tenet, /future code and results are not missing evidence/);
  assert.doesNotMatch(tenet, /`Outcome`|`Done when`|`Behavior`/);
});

test('Plan, Spec, and implementation share one conditional issue-link contract', () => {
  const plan = read('skills', 'development-plan', 'SKILL.md');
  const spec = read('skills', 'implementation-spec', 'SKILL.md');
  const implementation = read('skills', 'start-implementation', 'SKILL.md');
  const ledger = read('skills', 'issue-ledger', 'SKILL.md');
  const link = read('skills', 'issue-ledger', 'references', 'work-link.md');

  assert.match(plan, /optional nonempty `related_issues`/);
  assert.match(plan, /omit it for standalone Plans/);
  assert.match(spec, /issue-ledger\/references\/work-link\.md/);
  assert.equal((implementation.match(/\(\.\.\/issue-ledger\/references\/work-link\.md\)/g) || []).length, 1);
  assert.match(ledger, /apply `references\/work-link\.md`/);
  assert.match(link, /없으면 Issue Ledger에 접근하지 않는다/);
  assert.match(link, /같은 입력은 `no-op`/);
  assert.match(link, /이슈를 생성·재개·해결하지 않는다/);
  assert.match(link, /Slice는 Spec에 두고/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'work-on-issue')), false);
});

test('skill completion boundaries are single-sourced and checkable', () => {
  const baseline = read('skills', 'proofline', 'SKILL.md');
  const baselineBody = baseline.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const exactPortReport = read('skills', 'exact-port', 'assets', 'templates', 'exact-port-report.md');
  const refactorReport = read('skills', 'refactor-proof', 'assets', 'templates', 'refactor-proof-report.md');
  const scope = read('skills', 'scope-integrity', 'SKILL.md');
  const growth = read('skills', 'capability-growth', 'SKILL.md');

  assert.match(baseline, /Apply rules within: explicit task, requested output, authorized target, and scope/);
  assert.doesNotMatch(baseline, /Applicability: explicit task, requested output, authorized target, and scope only/);
  assert.match(baseline, /Target-language composition: compose directly in the target language; use its conventional syntax, collocations, and vocabulary/);
  assert.match(baseline, /render concepts from another language in the form used by the target-language community, not the source language's wording or structure/);
  assert.match(baseline, /Keep source text only for code, API names, CLI commands, identifiers, fixed protocol values, and exact errors that require exact matching/);
  assert.doesNotMatch(baseline, /technical terms|established product terms|official names|established product vocabulary/);
  assert.match(baseline, /Wording: preserve the expression's function/);
  assert.doesNotMatch(baseline, /Theory of mind|Use theory of mind|Correct the concrete misunderstanding/);
  assert.match(baseline, /Compression: repetition, not content/);
  assert.match(baseline, /where context carries shared meaning, express only distinctions in compact forms such as labels, noun phrases, state names, or action chains/);
  assert.match(baseline, /prefer tables for repeated fields or comparison axes/);
  assert.doesNotMatch(baseline, /State shared meaning once|Use full sentences|conventional telegraphic style|shortest conventional form/);
  assert.doesNotMatch(baseline, /Write all prose in the target language|Translate or conventionally transliterate/);
  assert.doesNotMatch(baseline, /can be translated naturally|required for copying, execution, or matching/);
  assert.match(baseline, /Source transformation: change only what the requested transformation requires/);
  assert.match(baseline, /preserve information, order, structure, tone, formality, useful headings and lists, with distinct propositions separate/);
  assert.match(baseline, /output-language localization is not a style change/);
  assert.match(baseline, /carry prior context into an output only when it applies to that output's target, scope, or purpose/);
  assert.match(baseline, /Preserve each retained proposition's actor, action, modality, status, conditions, exceptions, and decision authority/);
  assert.match(baseline, /Add no unsupported requirement, gate, rationale, action, or decision/);

  assert.match(baseline, /acceptance is explicit user acceptance of the specific choice required/);
  assert.match(baseline, /when feedback corrects a result that deviated from an applicable requirement, retain that requirement rather than the correction itself/);
  assert.match(baseline, /When feedback changes the desired result or adds, changes, or removes a requirement or constraint, apply the change/);
  assert.match(baseline, /Authority: authority to decide does not authorize executing that decision/);
  assert.match(baseline, /Change scope: base an authorized edit on the requested observable outcome and explicit boundaries, not just named artifacts/);
  assert.match(baseline, /parts that jointly deliver it on the changed surface or production path unless the user narrows it/);
  assert.match(baseline, /add a follow-on edit only if omitting it would leave the outcome incomplete/);
  assert.match(baseline, /directly affected required check inconclusive/);
  assert.match(baseline, /Leave other edits unchanged even if related or beneficial/);
  assert.doesNotMatch(baseline, /no authorization for dependent action|unrequested behavior, architecture|similarity alone does not authorize/);
  assert.match(baseline, /review, audit, diagnosis, explanation, and recommendation are read-only/);
  assert.match(baseline, /Ambiguity: ask one concise question only when it would materially change the answer or action/);
  assert.match(baseline, /otherwise use the interpretation best supported by context/);
  assert.match(baseline, /## Review and evidence\r?\n/);
  assert.match(baseline, /Review target: actual claim within its scope, conditions, and exceptions/);
  assert.match(baseline, /reuse inspected task evidence while relevant state is unchanged/);
  assert.match(baseline, /User-facing form: shortest preserving meaning/);
  assert.match(baseline, /every string should identify, distinguish, require, prevent, explain, clarify, or provide a necessary next step/);
  assert.match(baseline, /Consistent meaning across visible labels, accessible names, icons, layout, order, color, and state cues/);
  assert.doesNotMatch(baseline, /every string must identify|communicate the same meaning/);
  assert.doesNotMatch(baseline, /shortest natural whole expression/);
  assert.match(baseline, /Design: simplest preserving all information required for correct observable behavior/);
  assert.match(baseline, /Treat as owner-component contracts: named protocol rules, untrusted-input boundaries, and lifecycle states/);
  assert.match(baseline, /test each independently implemented path changing a required observable result/);
  assert.doesNotMatch(baselineBody, /^\s*[-*+]\s+/m);
  assert.doesNotMatch(baselineBody, /\.[ \t]*(?:\r?\n|$)/);

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
  assert.match(migration, /Group the contract by independently observable outcomes/);
  assert.doesNotMatch(migration, /Give a small change one compact block|headings that name the outcomes or review questions|condition -> observable result/);
  assert.doesNotMatch(migration, /REQ-\d+|Behavior:|Done when:|Create no separate `AC-/);
  assert.match(readme, /docs\/migrations\/prd-to-spec\.md/);
});
