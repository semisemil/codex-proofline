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
  assert.match(result.stdout, /## Language and compression/);
  assert.match(result.stdout, /Treat named protocol rules, untrusted-input boundaries, and lifecycle states as contracts/);
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
  const skill = read('skills', 'implementation-spec', 'SKILL.md');
  const template = read('skills', 'implementation-spec', 'assets', 'templates', 'spec.md');

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

test('implementation uses callback-driven implementers and one bounded blind review cycle', () => {
  const coordinator = read('skills', 'start-implementation', 'SKILL.md');
  const modelRouting = read('skills', 'start-implementation', 'assets', 'model-routing.md');

  assert.match(coordinator, /Coordinator \(current Codex task\).*Spec\/Slice status/);
  assert.match(coordinator, /Implementer \(created by the coordinator with `create_thread`\/`fork_thread`\)/);
  assert.match(coordinator, /Reviewer \(`spawn_agent` subagent\).*blind and read-only/);
  assert.match(coordinator, /follow `assets\/model-routing\.md` for implementer and reviewer model and reasoning levels/);
  assert.doesNotMatch(coordinator, /`(?:create|fork|spawn)\\_(?:thread|agent)`/);
  assert.match(coordinator, /whether the work is complete \(and the reason if incomplete\).*`send_message_to_thread`/);
  assert.match(coordinator, /reason if incomplete/);
  assert.doesNotMatch(coordinator, /completion report (?:contains|includes)/i);
  assert.match(coordinator, /coordinator must not call `wait_threads`/);
  assert.match(coordinator, /`spawn_agent`\(`fork_turns: "none"`\)/);
  assert.match(coordinator, /project root containing the current implementation state/);
  assert.match(coordinator, /Do not pass.*Implementer report, previous review, fix explanation, work history, or expected judgment/);
  assert.match(coordinator, /`pass`: Requirements are satisfied and required verification succeeds/);
  assert.match(coordinator, /`fail`: Implementation defect or scope violation/);
  assert.match(coordinator, /`need_confirm`: A user decision is required/);
  assert.match(coordinator, /same implementer and resume from step 2/);
  assert.match(coordinator, /fresh reviewer makes the next judgment/);
  assert.match(coordinator, /at most three `fail` judgments per target/);
  assert.match(coordinator, /a failure repeats, or a previous failure recurs/);
  assert.match(coordinator, /replace the reviewer with a fresh one at most once/);
  assert.match(coordinator, /task creation, forking, reporting, or review is unavailable.*without changing status/);
  assert.match(modelRouting, /Pass no task\/report\/review history or expected conclusion/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'start-implementation', 'references')), false);
  assert.doesNotMatch(coordinator, /pre-review|review-report-repair|changes_required|no_verdict|chain_key/);
});

test('Direct and Sliced modes keep different VCS behavior', () => {
  const coordinator = read('skills', 'start-implementation', 'SKILL.md');
  const slicing = read('skills', 'spec-slice', 'SKILL.md');
  const template = read('skills', 'spec-slice', 'assets', 'templates', 'slice.md');

  assert.match(coordinator, /Direct Mode[\s\S]*`create_thread` to create a local task that shares the project/);
  assert.match(coordinator, /Direct Mode[\s\S]*no worktree, staging, or automatic commit/);
  assert.match(coordinator, /If `\$spec-slice` reports `Direct`, proceed in Direct mode/);
  assert.match(coordinator, /reports `Sliced`.*current revision's Slice plan/);
  assert.doesNotMatch(coordinator, /do not (?:decide on|write) Slices/i);
  assert.doesNotMatch(coordinator, /assets\/templates\/slice\.md|links to Slice documents/);
  assert.match(coordinator, /Sliced Mode[\s\S]*Process Slices whose dependencies are satisfied sequentially/);
  assert.match(coordinator, /Git Repositories[\s\S]*`create_thread` to create a task based on a temporary worktree/);
  assert.match(coordinator, /Its entire prompt is: `<SPEC-ID> base session`/);
  assert.match(coordinator, /When creation returns a `threadId`[\s\S]*send the implementation instructions only to that fork/);
  assert.match(coordinator, /If creation returns only a `clientThreadId`, end the turn and resolve the ready task before forking it/);
  assert.match(coordinator, /fork the base task with `fork_thread` \(`environment: \{ type: "same-directory" \}`\)/);
  assert.match(coordinator, /only one implementer at a time/);
  assert.match(coordinator, /On `pass`, ask the implementer to commit and report the SHA with `send_message_to_thread`/);
  assert.match(coordinator, /Change the Slice to `completed` only after receiving the SHA/);
  assert.match(coordinator, /do not commit before `pass`/);
  assert.match(coordinator, /do not merge, rebase, squash, push, remove the worktree, or delete the branch/);
  assert.match(coordinator, /Non-Git Projects[\s\S]*create a shared local task/);
  assert.match(coordinator, /Non-Git Projects[\s\S]*no worktree, staging, or automatic commit is needed/);
  assert.match(coordinator, /Final Review of the Entire Spec[\s\S]*create a fresh reviewer with `spawn_agent`\(`fork_turns: "none"`\)/);
  assert.match(coordinator, /last Slice implementer[\s\S]*common steps 2-5/);
  assert.match(coordinator, /run common steps 2-5, then return to final review step 1/);
  assert.match(coordinator, /If there were final fixes, in Git the same implementer commits after `pass` and reports the SHA with `send_message_to_thread`/);
  assert.match(coordinator, /if there were final fixes, that SHA must have been received/);

  assert.match(slicing, /independent sub-goals \(Sub Goals\)/);
  assert.match(slicing, /no meaningful Slices, do not create any documents and report `Direct`/);
  assert.match(slicing, /write the complete plan before product implementation/);
  assert.match(slicing, /Spec's `Slices` section/);
  assert.match(slicing, /Do not change the Spec body outside the `Slices` section/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'start-implementation', 'assets', 'templates', 'slice.md')), false);

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
});

test('skill completion boundaries are single-sourced and checkable', () => {
  const baseline = read('skills', 'proofline-baseline-quality', 'SKILL.md');
  const completion = read('skills', 'completion-evidence', 'SKILL.md');
  const exactPortReport = read('skills', 'exact-port', 'assets', 'templates', 'exact-port-report.md');
  const refactorReport = read('skills', 'refactor-proof', 'assets', 'templates', 'refactor-proof-report.md');
  const scope = read('skills', 'scope-integrity', 'SKILL.md');
  const growth = read('skills', 'capability-growth', 'SKILL.md');

  assert.match(baseline, /Write all prose in the target language/);
  assert.match(baseline, /Translate or conventionally transliterate technical terms, roles, actions, states, and workflow concepts/);
  assert.doesNotMatch(baseline, /can be translated naturally|required for copying, execution, or matching/);
  assert.match(baseline, /change only what the requested transformation requires/);
  assert.match(baseline, /preserve its information, order, structure, tone and formality, useful headings and lists/);
  assert.match(baseline, /Output-language localization is not a style change/);
  assert.match(baseline, /keep distinct propositions separate/);
  assert.match(baseline, /Each retained source proposition keeps its actor, action, modality, status, conditions, exceptions, and decision authority/);
  assert.match(baseline, /Add no unsupported requirement, gate, rationale, action, or decision/);

  assert.match(baseline, /Acceptance requires the user's explicit acceptance of the specific choice/);
  assert.match(baseline, /Authority to decide does not authorize dependent action/);
  assert.match(baseline, /Review, audit, diagnosis, explanation, and recommendation are read-only/);
  assert.match(baseline, /Ask one concise question only when unresolved live interpretations require different substantive answers/);
  assert.match(baseline, /An example's communicative purpose determines its scope/);
  assert.match(baseline, /## Review and evidence\r?\n/);
  assert.match(baseline, /Address the actual claim within its scope, conditions, and exceptions/);
  assert.match(baseline, /Reuse inspected task evidence while relevant state is unchanged/);
  assert.match(baseline, /Use the shortest natural whole expression that preserves meaning/);
  assert.match(baseline, /Prefer the simplest design that preserves all information required for correct observable behavior/);
  assert.match(baseline, /Treat named protocol rules, untrusted-input boundaries, and lifecycle states as contracts/);
  assert.match(baseline, /Test each independently implemented path that changes a required observable result/);

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
  assert.match(readme, /docs\/migrations\/prd-to-spec\.md/);
});
