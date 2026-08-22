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

test('implementation keeps fresh agents, blind judgments, observations, and model routing bounded', () => {
  const coordinator = read('skills', 'start-implementation', 'SKILL.md');
  const executionLoop = read('skills', 'start-implementation', 'references', 'execution-loop.md');
  const modelRouting = read('skills', 'start-implementation', 'assets', 'model-routing.md');

  assert.match(coordinator, /At run start, read \[model routing\]\(assets\/model-routing\.md\) once/);
  assert.match(coordinator, /reuse them[\s\S]*Do not reread or re-select unless the user changes a routing setting/);
  assert.match(modelRouting, /An explicit user setting wins/);
  assert.match(modelRouting, /every reviewer use the strong model/);
  assert.match(modelRouting, /Spec integration task and every Slice coordinator task[\s\S]*pass task-creation `model` or `thinking` only when the user explicitly selected that field/);
  assert.match(modelRouting, /Otherwise omit both and use the configured task default/);
  assert.match(modelRouting, /Every Leaf implementer, fixed-Node Repair, and reviewer is a fresh `spawn_agent` call with `fork_context: false`/);
  assert.match(modelRouting, /Internal `spawn_agent` overrides must follow the recorded role route/);
  assert.doesNotMatch(`${coordinator}\n${executionLoop}\n${modelRouting}`, /fork_turns/);

  assert.match(executionLoop, /report carries no whole-Spec, design, scope, Gate, or review verdict/);
  assert.match(executionLoop, /The reviewer is read-only and blind/);
  assert.deepEqual(
    [...executionLoop.matchAll(/^- `(pass|fail|need_confirm)`:/gm)].map((match) => match[1]),
    ['pass', 'fail', 'need_confirm'],
  );
  assert.match(executionLoop, /A pre-existing issue blocks only when it prevents a required boundary outcome/);
  assert.match(executionLoop, /An `observation` is a concrete, evidence-backed issue outside the review boundary/);
  assert.match(executionLoop, /does not alter the judgment, become repair input, or block completion/);
  assert.match(executionLoop, /record durable observations through `\.\.\/\.\.\/issue-ledger\/SKILL\.md`/);
  assert.match(executionLoop, /Exclude implementer self-judgment, implementation or repair history, prior reviewer verdicts, and any expected verdict/);
  assert.match(executionLoop, /same evidence-backed failure recurs after repair/);
  assert.match(executionLoop, /fixed Node reaches its third failure/);
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
  assert.match(implementation, /issue content stays out of agent briefs/);
  assert.match(ledger, /apply `references\/work-link\.md`/);
  assert.match(link, /없으면 Issue Ledger에 접근하지 않는다/);
  assert.match(link, /같은 입력은 `no-op`/);
  assert.match(link, /이슈를 생성·재개·해결하지 않는다/);
  assert.match(link, /Slice는 Spec에 두고/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'work-on-issue')), false);
});

test('recursive execution tree', () => {
  const coordinator = read('skills', 'start-implementation', 'SKILL.md');
  const slicing = read('skills', 'spec-slice', 'SKILL.md');
  const treeContract = read('skills', 'spec-slice', 'references', 'execution-tree.md');
  const executionLoop = read('skills', 'start-implementation', 'references', 'execution-loop.md');
  const gitIntegration = read('skills', 'start-implementation', 'references', 'git-integration.md');
  const template = read('skills', 'spec-slice', 'assets', 'templates', 'slice.md');
  const gateTemplate = read('skills', 'spec-slice', 'assets', 'templates', 'gates.md');
  const slicingAgent = read('skills', 'spec-slice', 'agents', 'openai.yaml');
  const implementationAgent = read('skills', 'start-implementation', 'agents', 'openai.yaml');
  const readme = read('README.md');

  assert.equal((coordinator.match(/^## `execute\(node\)`$/gm) || []).length, 1);
  assert.match(coordinator, /The single execution operation is `execute\(node\)`/);
  assert.match(coordinator, /Call `execute\(root\)` using only the accepted inspector result/);
  assert.match(coordinator, /Branch:[\s\S]*recursively execute only currently runnable children/);
  assert.doesNotMatch(`${coordinator}\n${slicing}\n${readme}`, /\b(?:Direct|Sliced|Flat|Tree)\b/);

  assert.match(coordinator, /Read and apply \[spec-slice\]\(\.\.\/spec-slice\/SKILL\.md\) internally/);
  assert.match(coordinator, /accepted v3 result/);
  assert.match(slicing, /\[the execution-tree contract\]\(references\/execution-tree\.md\)/);
  assert.match(coordinator, /\[the execution loop\]\(references\/execution-loop\.md\)/);
  assert.match(coordinator, /Read \[Git integration\]\(references\/git-integration\.md\) only when Git or worktree handling applies/);

  assert.match(treeContract, /`<spec-directory>\/SPEC\.md` is the ready Spec and the root/);
  assert.match(treeContract, /direct child of the root is a Slice and the review boundary for its whole subtree/);
  assert.match(treeContract, /deeper Node is a SubSlice/);
  assert.match(treeContract, /root or Node with no children is a Leaf/);
  assert.match(treeContract, /names are derived only from position[\s\S]*Persist no execution type or mode/);
  assert.match(treeContract, /Spec with no child Nodes[\s\S]*create no Node document/);
  assert.match(treeContract, /Normal implementation agents are Leaf-only/);
  assert.match(treeContract, /Branch Node: the union of all descendant Leaf `write_scope` arrays[\s\S]*Branch still stores `write_scope: \[\]`/);
  assert.match(treeContract, /Root with child Nodes: the union of all Leaf `write_scope` arrays in the tree/);
  assert.match(treeContract, /Root-only tree: the already authorized Spec\/project root implementation scope/);
  assert.match(treeContract, /all mechanically safe runnable work[\s\S]*`dispatch_candidates`[\s\S]*`runnable_slices`/);
  assert.match(treeContract, /candidate sets, not a dispatch schedule, quota, or concurrency cap/);
  assert.match(treeContract, /model chooses any safe subset[\s\S]*dependencies[\s\S]*effective write-scope overlap[\s\S]*shared-workspace safety[\s\S]*task size[\s\S]*available capacity/);
  assert.match(treeContract, /There is no fixed numeric limit/);
  assert.match(treeContract, /Execution-task ownership belongs to `start-implementation`, not this planning contract/);
  assert.match(treeContract, /any v1 or v2 execution Node or Slice plan[\s\S]*stop with `explicit re-slice required`/);
  assert.equal((treeContract.match(/`explicit re-slice required`/g) || []).length, 1);
  assert.match(treeContract, /without an explicit user request to re-slice/);

  assert.match(executionLoop, /original-checkout task creates a user-visible Spec integration task\/worktree/);
  assert.match(executionLoop, /hands orchestration to it[\s\S]*original-checkout task performs no implementation or review/);
  assert.match(executionLoop, /root-direct Slice is always an actual platform task\/thread, never a `spawn_agent` implementation worker/);
  assert.match(executionLoop, /recursive `execute\(node\)` calls for deeper SubSlices stay in that task/);
  assert.match(executionLoop, /root-only Spec[\s\S]*Spec integration task executes the root Leaf and creates no Slice task/);
  assert.match(executionLoop, /Each Slice task receives only:[\s\S]*root-direct Slice contract and descendant Node contracts[\s\S]*linked Spec sections and Context documents reachable from that subtree[\s\S]*subtree's Gate paths and accepted inspector records/);
  assert.match(executionLoop, /Exclude other Slice contracts, unrelated Spec sections, prior implementation or repair history, reviewer verdicts/);
  assert.match(executionLoop, /Slice task reports `state: returned \| blocked`[\s\S]*supplies no Blind Review or whole-Spec verdict/);
  assert.match(executionLoop, /use `spawn_agent` only for a fresh Leaf implementation or fixed-Node Repair, always with `fork_context: false`/);
  assert.match(executionLoop, /Leaf and Repair subagents never stage or commit/);
  assert.match(executionLoop, /A Repair changes only paths in its fixed failing Node's effective execution scope:[\s\S]*Leaf's own `write_scope`[\s\S]*Branch or root's descendant-Leaf union[\s\S]*root-only[\s\S]*already authorized Spec\/project root implementation scope/);
  assert.match(executionLoop, /deepest existing Node that owns the violated contract and correction[\s\S]*Leaf, Branch, or root/);
  assert.match(executionLoop, /Failure count and the repeated-failure stop are tracked independently per fixed failing Node/);
  assert.match(coordinator, /invalidate and re-close the accepted-tree affected closure[\s\S]*root Repair invalidates the complete tree/);
  assert.match(executionLoop, /compute the affected closure from the accepted fixed tree[\s\S]*root-assigned Repair affects the root and every Node in the complete tree[\s\S]*repaired Node and its full subtree[\s\S]*least fixed point of affected siblings under `blocked_by`[\s\S]*dependent sibling's full subtree[\s\S]*Continue through the root/);
  assert.match(executionLoop, /Only reverse-transitive `blocked_by` result dependence expands the closure[\s\S]*`run_after`[\s\S]*asserts no result dependence and adds nothing to the closure/);
  assert.match(executionLoop, /set every affected `completed` Node to `pending`[\s\S]*discard every prior required boundary-review verdict[\s\S]*Leave Node, Gate, and Spec definitions unchanged/);
  assert.match(executionLoop, /owning Slice task reruns every affected Gate bottom-up[\s\S]*including every already checked Gate[\s\S]*Spec coordinator runs a fresh Slice Blind Review[\s\S]*root Gate[\s\S]*fresh final Spec Integration Review/);
  assert.match(executionLoop, /non-`ABANDON` Gate failure[\s\S]*fresh fixed-Node Repair rule[\s\S]*recompute the closure/);
  assert.doesNotMatch(executionLoop, /affected execution subtree[\s\S]*ancestor Gate needed to re-close/);
  assert.match(executionLoop, /If no existing Node owns a finding[\s\S]*`need_confirm`[\s\S]*explicit re-slicing[\s\S]*Do not force the finding onto a Leaf/);
  assert.match(executionLoop, /records one execution wave:[\s\S]*selected Leaf IDs[\s\S]*each fixed `write_scope`[\s\S]*exact pre-wave checkout snapshot/);
  assert.match(executionLoop, /sequential Leaf is a wave of one/);
  assert.match(executionLoop, /Wait for every selected agent in the wave to return or block before verification/);
  assert.match(executionLoop, /compute the exact wave delta[\s\S]*union of the selected Leaves' fixed scopes/);
  assert.match(executionLoop, /Do not compare one returning agent with the checkout's accumulated whole-Slice diff/);
  assert.match(executionLoop, /run every selected Leaf Gate[\s\S]*close only Leaves whose own Gates pass/);
  assert.match(executionLoop, /after all child Nodes complete, run the Branch Gate/);
  assert.match(executionLoop, /Spec coordinator creates every Slice or Spec Integration reviewer as a fresh `spawn_agent` call with `fork_context: false`/);
  assert.match(executionLoop, /reviewer is read-only and blind/);
  assert.match(executionLoop, /root-direct Slice gets exactly one Slice review per attempt/);
  assert.match(executionLoop, /The root gets only the final Spec Integration review/);
  assert.match(executionLoop, /root-only Spec[\s\S]*one Spec Integration review with no Slice review/);
  assert.match(executionLoop, /Slice-review or integrated-Slice-Gate failure returns to the owning Slice task[\s\S]*fresh Repair/);
  assert.match(executionLoop, /Slice coordinator may update subtree Gate evidence and mark descendant Nodes `completed`/);
  assert.match(executionLoop, /Spec coordinator marks that direct Slice `completed` only after a fresh Slice Blind Review passes, the Slice result is present in the Spec integration workspace, and subtree Gates pass there/);
  assert.match(executionLoop, /Spec coordinator alone owns root Gate evidence and root\/Spec status/);
  assert.match(treeContract, /`ABANDON` records an unfinished path/);
  assert.match(executionLoop, /`ABANDON`[\s\S]*leaves the affected Node and every ancestor incomplete/);
  assert.match(coordinator, /model chooses how many safe Slice tasks or Leaves to run concurrently[\s\S]*There is no numeric concurrency limit/);
  assert.doesNotMatch(`${coordinator}\n${executionLoop}\n${gitIntegration}\n${treeContract}\n${readme}`, /(?:at most|no more than|maximum of|capped at) two safe (?:Slices|Leaves)/i);

  assert.match(gitIntegration, /original checkout -> user-visible Spec integration task\/worktree -> user-visible root-direct Slice task\/worktree/);
  assert.match(gitIntegration, /dirty paths overlap the root effective execution scope[\s\S]*stop for `need_confirm`/);
  assert.match(gitIntegration, /Independent parallel Slices start from the same recorded integration commit/);
  assert.match(gitIntegration, /dependent Slice starts only after every prerequisite is integrated, from the then-current integration commit/);
  assert.match(gitIntegration, /Only after review `pass`[\s\S]*Slice coordinator task to create a local temporary transport commit/);
  assert.match(gitIntegration, /stage only it[\s\S]*`git diff --cached --name-only`[\s\S]*`git diff --cached --check`/);
  assert.match(gitIntegration, /temporary commit is transport evidence, not completion/);
  assert.match(gitIntegration, /cherry-picks reviewed transport commits into the Spec integration worktree[\s\S]*rerun every Gate in that integrated subtree[\s\S]*mirror accepted descendant lifecycle state/);
  assert.match(gitIntegration, /Keep the original checkout untouched until every Slice is completed[\s\S]*root Gate and full Spec checks pass[\s\S]*Spec Integration Review returns `pass`/);
  assert.match(gitIntegration, /expected HEAD and exact dirty state[\s\S]*does not overlap pre-existing dirty paths/);
  assert.match(gitIntegration, /apply only the exact integrated diff to the original checkout as uncommitted changes[\s\S]*rerun destination Gates/);
  assert.match(gitIntegration, /final commit requires explicit user authorization/);
  assert.match(gitIntegration, /Never push/);
  assert.match(gitIntegration, /failed Slice or final check to a fresh fixed-Node Repair in a temporary worktree[\s\S]*do not edit or reset the original checkout/);

  for (const relativePath of [
    ['skills', 'spec-slice', 'references', 'execution-tree.md'],
    ['skills', 'start-implementation', 'references', 'execution-loop.md'],
    ['skills', 'start-implementation', 'references', 'git-integration.md'],
    ['skills', 'spec-slice', 'scripts', 'inspect-execution-tree.js'],
    ['skills', 'spec-slice', 'scripts', 'run-gates.js'],
    ['skills', 'spec-slice', 'agents', 'openai.yaml'],
    ['skills', 'start-implementation', 'agents', 'openai.yaml'],
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, ...relativePath)), true, relativePath.join('/'));
  }
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills', 'spec-slice', 'scripts', 'inspect-slice-plan.js')), false);

  for (const agentContract of [slicingAgent, implementationAgent]) {
    assert.match(agentContract, /^interface:\r?$/m);
    assert.equal((agentContract.match(/^  default_prompt:/gm) || []).length, 1);
    assert.match(agentContract, /^policy:\r?\n  allow_implicit_invocation: false\r?$/m);
  }
  assert.match(slicingAgent, /\$spec-slice[\s\S]*v3 execution tree and Gates/);
  assert.match(implementationAgent, /\$start-implementation[\s\S]*recursively execute[\s\S]*validated tree[\s\S]*user-visible Slice tasks/);

  assert.match(gateTemplate, /^  CHECK: \{\{command\}\}$/m);
  assert.doesNotMatch(gateTemplate, /^  EXPECT:/m);
  assert.match(treeContract, /An optional expectation may narrow the command's observable success condition/);
  assert.match(gateTemplate, /^  EVIDENCE: pending$/m);
  assert.doesNotMatch(gateTemplate, /^ABANDON:/m);

  const rendered = template
    .replace('{{slice_id_json}}', JSON.stringify('SLICE-01'))
    .replace('{{spec_id_json}}', JSON.stringify('SPEC-0001'))
    .replace('{{spec_revision}}', '2')
    .replace('{{parent_id_json}}', JSON.stringify('SPEC-0001'))
    .replace('{{title_json}}', JSON.stringify('Deliver settings flow'))
    .replace('{{blocked_by_json}}', '[]')
    .replace('{{run_after_json}}', '[]')
    .replace('{{write_scope_json}}', '["src/settings.js"]')
    .replace('{{outcome}}', 'Settings can be saved.')
    .replace('{{spec_sections}}', '[Settings flow](../SPEC.md#settings-flow)')
    .replace('{{contract}}', 'Save the selected settings.')
    .replace('{{context}}', 'No extra context.');
  const frontmatter = rendered.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const metadata = JSON.parse(frontmatter[1]);
  assert.deepEqual(Object.keys(metadata), [
    'schema_version',
    'id',
    'spec_id',
    'spec_revision',
    'parent_id',
    'title',
    'status',
    'blocked_by',
    'run_after',
    'write_scope',
  ]);
  assert.equal(metadata.schema_version, 3);
  assert.equal(metadata.status, 'pending');
  assert.deepEqual(rendered.slice(frontmatter[0].length).match(/^## .+$/gm), [
    '## Outcome',
    '## Spec sections',
    '## Contract',
    '## Context',
  ]);
  assert.doesNotMatch(template, /"(?:acceptance_refs|type|mode)"\s*:/);

  assert.match(readme, /Spec을 루트로 삼아 하나의 `execute\(node\)` 경로로 재귀 실행/);
  assert.match(readme, /Spec 통합 작업\/Worktree[\s\S]*Slice 조정 작업\/Worktree[\s\S]*SubSlice[\s\S]*Leaf 구현/);
  assert.match(readme, /실행 가능 후보를 모두 제공[\s\S]*고정 상한은 없습니다/);
  assert.match(readme, /모드나 종류가 아니라 트리의 위치/);
  assert.match(readme, /자식이 없는 Spec에는 Slice 작업이나 파일을 만들지 않습니다/);
  assert.match(readme, /`explicit re-slice required`/);
  assert.doesNotMatch(readme, /tenet-me` → `spec-slice` → `start-implementation/);
  assert.doesNotMatch(readme, /\n\$proofline:spec-slice\r?\n/);
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
  assert.match(baseline, /Target-language composition: compose directly in the target language; use its conventional syntax, collocations, vocabulary, and technical terms/);
  assert.match(baseline, /render concepts from another language in the form used by the target-language community, not the source language's wording or structure/);
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
