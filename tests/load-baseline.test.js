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
test('Proofline hook loads the packaged baseline and default mode once', () => {
  const result = spawnSync(process.execPath, [hookPath], {
    encoding: 'utf8',
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /# Proofline/);
  assert.doesNotMatch(result.stdout, /^---/);
  assert.match(result.stdout, /## Language and compression/);
  assert.match(result.stdout, /Treat as owner-component contracts: named protocol rules, untrusted-input boundaries, and lifecycle states/);
  assert.equal((result.stdout.match(/# Normal response mode/g) || []).length, 1);
  assert.doesNotMatch(result.stdout, /# Focus response mode|# Caveman response mode/);
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
  assert.match(skill, /Keep material conditions, boundaries, fixed decisions, and minimum evidence with the part of the contract they qualify/);
  assert.match(skill, /Use Mermaid for graph-shaped relationships with multiple branches or actors/);
  assert.doesNotMatch(skill, /Organize by outcomes that can be observed independently|Name each outcome for the result it defines|Match information to the work|Treat these as information needs rather than required headings/);
  assert.doesNotMatch(skill, /Use Mermaid when state transitions/);
  assert.doesNotMatch(skill, /let its information determine the internal structure|State constraints and evidence shared by several outcomes once for all of them|Omit a title heading|one authoritative location|minimum sufficient proof|telegraphic contract|compact items/);
  assert.match(skill, /Request, confirmed decisions, current project evidence, and authoritative domain or linked documents/);
  assert.match(skill, /Include linked information required for implementation or review/);
  assert.match(skill, /Current contract only/);
  assert.match(skill, /The implementer can proceed without inventing product behavior/);
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

test('implementation composes role-owned Gates with one bounded blind review cycle', () => {
  const coordinator = read('skills', 'start-implementation', 'SKILL.md');
  const modelRouting = read('skills', 'start-implementation', 'assets', 'model-routing.md');

  assert.match(coordinator, /Before creating each implementer or reviewer, read `assets\/model-routing\.md`/);
  assert.match(modelRouting, /Direct and base `create_thread`: set `model` and `thinking`/);
  assert.match(modelRouting, /Forked implementer: set `model` and `thinking` in its first implementation `send_message_to_thread`/);
  assert.match(modelRouting, /Reviewer `spawn_agent`: set `model`, `reasoning_effort`, and `fork_turns: "none"`/);
  assert.match(coordinator, /Implementation[\s\S]*smallest affected build[\s\S]*focused changed-behavior tests/);
  assert.match(coordinator, /Review[\s\S]*without defect, omission, or scope violation/);
  assert.match(coordinator, /Integration[\s\S]*reviewer-owned Spec-wide checks/);
  assert.match(coordinator, /successful Implementation Gate and reviewer `pass`/);
  assert.match(coordinator, /Send exactly these fields: target and domain-document paths; requested change; user constraint delta; one-line Implementation Gate; report contract/);
  assert.match(coordinator, /End the implementer message there/);
  assert.match(coordinator, /reports changed paths, commands, results, completion state, and stop reason/);
  assert.match(coordinator, /Review only a `complete` report whose Gate succeeded/);
  assert.match(coordinator, /fresh blind, read-only reviewer with `fork_turns: "none"`/);
  assert.match(coordinator, /`pass` when the Gate is met, `fail` with findings, or `need_confirm` with the required decision/);
  assert.match(coordinator, /Exclude implementation history and expected judgment/);
  assert.match(coordinator, /call `wait_agent` until judgment returns/);
  assert.match(coordinator, /unresolved findings, constraint delta, and one-line Gate/);
  assert.match(coordinator, /Do not call `wait_threads`/);
  assert.match(coordinator, /three `fail` judgments/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'start-implementation', 'references', 'git-sliced.md')), false);
  assert.doesNotMatch(modelRouting, /task\/report\/review history|expected conclusion/);
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
  assert.match(implementation, /issue-ledger\/references\/work-link\.md` once/);
  assert.match(implementation, /outside implementer and reviewer context/);
  assert.match(ledger, /apply `references\/work-link\.md`/);
  assert.match(link, /없으면 Issue Ledger에 접근하지 않는다/);
  assert.match(link, /같은 입력은 `no-op`/);
  assert.match(link, /이슈를 생성·재개·해결하지 않는다/);
  assert.match(link, /Slice는 Spec에 두고/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'work-on-issue')), false);
});

test('Direct and Sliced modes keep different VCS behavior', () => {
  const coordinator = read('skills', 'start-implementation', 'SKILL.md');
  const slicing = read('skills', 'spec-slice', 'SKILL.md');
  const template = read('skills', 'spec-slice', 'assets', 'templates', 'slice.md');

  assert.match(coordinator, /## Direct[\s\S]*shared-local implementer with routed `model` and `thinking`/);
  assert.match(coordinator, /## Direct[\s\S]*without staging or committing/);
  assert.match(coordinator, /current revision's `\$spec-slice` result/);
  assert.match(coordinator, /ask the user to run `\$spec-slice`; do not invoke it automatically/);
  assert.match(coordinator, /inspect-slice-plan\.js <slice-directory>/);
  assert.match(coordinator, /Non-Git projects[\s\S]*one Slice implementer at a time/);
  assert.match(coordinator, /v2 use at most two Slices from `dispatch`/);
  assert.match(coordinator, /temporary-worktree integration base/);
  assert.match(coordinator, /Send ready with send_message_to_thread to <codex_delegation><source_thread_id>, then end the turn/);
  assert.match(coordinator, /callback source ID as the base `threadId`/);
  assert.match(coordinator, /first implementation message/);
  assert.match(coordinator, /stage and commit only reviewed target-scope product\/test paths/);
  assert.match(coordinator, /strictly in integration order/);
  assert.match(coordinator, /fresh worktree from the current base/);
  assert.match(coordinator, /Rerun the inspector after each completion/);
  assert.match(coordinator, /fresh entire-Spec Integration review/);
  assert.match(coordinator, /Do not push, merge, rebase, squash, remove worktrees, or delete branches automatically/);

  assert.match(slicing, /Choose `Direct` when no independent sub-goal/);
  assert.match(slicing, /Choose `Sliced` when independent outcomes/);
  assert.match(slicing, /result prerequisites in `blocked_by`/);
  assert.match(slicing, /unsafe or uncertain concurrent execution in `run_after`/);
  assert.match(slicing, /combined graph acyclic/);
  assert.match(slicing, /Slice-unique and integration-only checks/);
  assert.match(slicing, /relative links to the Spec's `Slices` section/);
  assert.match(slicing, /Create no Slice documents or other mode artifact/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'start-implementation', 'assets', 'templates', 'slice.md')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'spec-slice', 'scripts', 'inspect-slice-plan.js')), true);

  assert.match(template, /"schema_version": 2/);
  assert.match(template, /"blocked_by": \{\{blocked_by_json\}\}/);
  assert.match(template, /"run_after": \{\{run_after_json\}\}/);
  assert.match(template, /## Outcome[\s\S]*\{\{outcome\}\}/);
  assert.match(template, /## Spec section[\s\S]*\{\{spec_section_link\}\}/);
  assert.match(template, /## Concurrency boundary[\s\S]*\{\{concurrency_boundary\}\}/);
  assert.match(template, /## Slice checks[\s\S]*\{\{slice_checks\}\}/);
  assert.match(template, /## Integration checks[\s\S]*\{\{integration_checks\}\}/);
  assert.doesNotMatch(template, /created_at|updated_at|# .*\{\{title/);

  const rendered = template
    .replace('{{slice_id_json}}', JSON.stringify('SLICE-01'))
    .replace('{{spec_id_json}}', JSON.stringify('SPEC-0001'))
    .replace('{{spec_revision}}', '2')
    .replace('{{title_json}}', JSON.stringify('Deliver settings flow'))
    .replace('{{blocked_by_json}}', '[]')
    .replace('{{run_after_json}}', '[]')
    .replace('{{outcome}}', 'Settings can be saved.')
    .replace('{{spec_section_link}}', '[Settings flow](../SPEC.md#settings-flow)')
    .replace('{{concurrency_boundary}}', 'No shared resources.')
    .replace('{{slice_checks}}', 'Focused settings tests.')
    .replace('{{integration_checks}}', 'None');
  const metadata = JSON.parse(rendered.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  assert.deepEqual(Object.keys(metadata), [
    'schema_version',
    'id',
    'spec_id',
    'spec_revision',
    'title',
    'status',
    'blocked_by',
    'run_after',
  ]);
  assert.equal(metadata.status, 'pending');
});

test('skill completion boundaries are single-sourced and checkable', () => {
  const baseline = read('skills', 'proofline', 'SKILL.md');
  const baselineBody = baseline.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const completion = read('skills', 'completion-evidence', 'SKILL.md');
  const exactPortReport = read('skills', 'exact-port', 'assets', 'templates', 'exact-port-report.md');
  const refactorReport = read('skills', 'refactor-proof', 'assets', 'templates', 'refactor-proof-report.md');
  const scope = read('skills', 'scope-integrity', 'SKILL.md');
  const growth = read('skills', 'capability-growth', 'SKILL.md');

  assert.match(baseline, /Apply rules within: explicit task, requested output, authorized target, and scope/);
  assert.doesNotMatch(baseline, /Applicability: explicit task, requested output, authorized target, and scope only/);
  assert.match(baseline, /Compose directly in the target language: use conventional syntax, collocations, vocabulary, and technical terms/);
  assert.match(baseline, /use the target-language community's expression rather than source-language wording or structure/);
  assert.doesNotMatch(baseline, /Theory of mind|Use theory of mind|Correct the concrete misunderstanding/);
  assert.match(baseline, /Responses: concise and focused on the user's actual question/);
  assert.match(baseline, /additional detail when purpose or requested depth requires it/);
  assert.match(baseline, /Compression: repetition, not content/);
  assert.match(baseline, /where context carries shared meaning, express only distinctions in compact forms such as labels, noun phrases, state names, or action chains/);
  assert.match(baseline, /prefer tables for repeated fields or comparison axes/);
  assert.doesNotMatch(baseline, /State shared meaning once|Use full sentences|conventional telegraphic style|shortest conventional form/);
  assert.doesNotMatch(baseline, /Write all prose in the target language|Translate or conventionally transliterate/);
  assert.doesNotMatch(baseline, /can be translated naturally|required for copying, execution, or matching/);
  assert.match(baseline, /Source transformation: change only what the requested transformation requires/);
  assert.match(baseline, /preserve information, order, structure, tone, formality, useful headings and lists, with distinct propositions separate/);
  assert.match(baseline, /output-language localization is not a style change/);
  assert.match(baseline, /preserve each retained proposition's actor, action, modality, status, conditions, exceptions, and decision authority/);
  assert.match(baseline, /add no unsupported requirement, gate, rationale, action, or decision/);

  assert.match(baseline, /acceptance: explicit user acceptance of the specific choice required/);
  assert.match(baseline, /Authority to decide: no authorization for dependent action/);
  assert.match(baseline, /review, audit, diagnosis, explanation, and recommendation: read-only/);
  assert.match(baseline, /Ambiguity: ask one concise question only when it would materially change the answer or action/);
  assert.match(baseline, /otherwise use the interpretation best supported by context/);
  assert.match(baseline, /Examples: communicative purpose determines scope/);
  assert.match(baseline, /## Review and evidence\r?\n/);
  assert.match(baseline, /Review target: actual claim within its scope, conditions, and exceptions/);
  assert.match(baseline, /reuse inspected task evidence while relevant state is unchanged/);
  assert.match(baseline, /User-facing form: shortest that preserves meaning/);
  assert.match(baseline, /every string should identify, distinguish, require, prevent, explain, clarify, or provide a necessary next step/);
  assert.match(baseline, /Consistent meaning across: visible labels, accessible names, icons, layout, order, color, and state cues/);
  assert.doesNotMatch(baseline, /every string must identify|communicate the same meaning/);
  assert.doesNotMatch(baseline, /shortest natural whole expression/);
  assert.match(baseline, /Design: simplest that preserves all information required for correct observable behavior/);
  assert.match(baseline, /Treat as owner-component contracts: named protocol rules, untrusted-input boundaries, and lifecycle states/);
  assert.match(baseline, /test each independently implemented path changing a required observable result/);
  assert.doesNotMatch(baselineBody, /^\s*[-*+]\s+/m);
  assert.doesNotMatch(baselineBody, /\.[ \t]*(?:\r?\n|$)/);

  assert.match(completion, /Report only evidence already available from the task without initiating verification/);
  assert.match(completion, /Do not repeat work solely to strengthen the report/);
  assert.match(completion, /when required evidence is absent, report it as unverified/);
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
