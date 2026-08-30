const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
const words = (source) => source.trim().split(/\s+/).length;

function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'skill must have frontmatter');
  return match[1];
}

test('architecture-memory skills are explicit-only', () => {
  for (const skill of [
    'architecture-memory-init',
    'architecture-memory',
    'architecture-memory-update',
  ]) {
    const source = read('skills', skill, 'SKILL.md');
    const metadata = read('skills', skill, 'agents', 'openai.yaml');
    assert.match(frontmatter(source), new RegExp(`^name: ${skill}$`, 'm'));
    assert.match(frontmatter(source), /^description:\s*\S.+$/m);
    assert.match(metadata, /allow_implicit_invocation:\s*false/);
    assert.match(metadata, new RegExp(`default_prompt: "Use \\$${skill}\\b`));
  }
});

test('Git reconciliation owns only committed checkpoint updates', () => {
  const update = read('skills', 'architecture-memory-update', 'SKILL.md');
  const maintenance = read('skills', 'architecture-memory', 'SKILL.md');

  assert.match(frontmatter(update), /^name: architecture-memory-update$/m);
  assert.match(update, /clean worktree/);
  assert.match(update, /non-null revision[\s\S]*full 40\/64-hex ID resolving to a commit/);
  assert.match(update, /Architecture update stopped: <reason>; checkpoint <unchanged or unavailable>/);
  assert.match(update, /`revision == HEAD`[\s\S]*`current`/);
  assert.match(update, /Both precede registered-document reads/);
  assert.match(update, /`current`\/`stopped`\/`ignored`[\s\S]*write nothing[\s\S]*keep the checkpoint/);
  assert.match(update, /`branch_at_check` is provenance/);
  assert.match(update, /git diff --name-status --find-renames <checkpoint> <HEAD> -- \./);
  assert.match(update, /classify all other paths before Write/i);
  assert.match(update, /code delta cannot create an ADR/);
  assert.match(update, /decision-templates\.md\)/);
  assert.doesNotMatch(update, /document-contract\.md/);
  assert.match(update, /Reaching Write advances even without document edits/);
  assert.doesNotMatch(update, /does not include staged, unstaged, or untracked changes/);
  assert.match(maintenance, /never advance `git_checkpoint`/i);
});

test('Git reconciliation seeds null checkpoints and ignores its own document-only tail', () => {
  const update = read('skills', 'architecture-memory-update', 'SKILL.md');

  assert.match(update, /`revision == null`[\s\S]*committed tree[\s\S]*every registered current-state document/);
  assert.match(update, /Write with fixes and checkpoint `HEAD`/);
  assert.match(update, /Keep document `verified_at` and `source_revision`[\s\S]*seeding never refreshes them/);
  assert.match(update, /architecture-root-only range[\s\S]*rename\/copy paths inside[\s\S]*`ignored`[\s\S]*registered-document read/);
  assert.match(update, /mixed ranges[\s\S]*exclude root evidence[\s\S]*classify all other paths/);
});

test('explicit Git reconciliation stays compact', () => {
  const update = read('skills', 'architecture-memory-update', 'SKILL.md');
  const words = update.trim().split(/\s+/).length;

  assert.ok(words <= 400, `update skill is ${words} words`);
});

test('initialization and maintenance route conditional template branches', () => {
  const init = read('skills', 'architecture-memory-init', 'SKILL.md');
  const maintenance = read('skills', 'architecture-memory', 'SKILL.md');
  const initProcedure = read('skills', 'architecture-memory-init', 'references', 'initialization.md');
  const baseTemplates = read('skills', 'architecture-memory', 'references', 'base-templates.md');
  const componentTemplates = read('skills', 'architecture-memory', 'references', 'component-templates.md');
  const decisionTemplates = read('skills', 'architecture-memory', 'references', 'decision-templates.md');

  assert.match(init, /references\/initialization\.md/);
  assert.doesNotMatch(init, /document-contract\.md/);
  for (const name of ['base-templates', 'component-templates', 'decision-templates']) {
    assert.match(initProcedure, new RegExp(`architecture-memory\\/references\\/${name}\\.md`));
    assert.match(maintenance, new RegExp(`references\\/${name}\\.md`));
  }
  assert.match(initProcedure, /component templates[\s\S]*only when selecting L3/);
  assert.match(initProcedure, /decision template[\s\S]*only when an ADR is warranted/);
  assert.match(maintenance, /local form for ordinary patches[\s\S]*Load only the matching template/);
  assert.ok(maintenance.length < initProcedure.length
    + baseTemplates.length + componentTemplates.length + decisionTemplates.length);

  for (const [source, relativePath] of [
    [baseTemplates, 'README.md'],
    [baseTemplates, '01-system-context.md'],
    [baseTemplates, '02-containers.md'],
    [componentTemplates, 'components/README.md'],
    [componentTemplates, 'components/<container-slug>.md'],
    [baseTemplates, '04-context.md'],
    [baseTemplates, 'decisions/README.md'],
    [decisionTemplates, 'decisions/ADR-<number>-<slug>.md'],
  ]) {
    assert.ok(source.includes(relativePath), `missing template for ${relativePath}`);
  }
  assert.equal(
    fs.existsSync(path.join(repoRoot, 'skills', 'architecture-memory-init', 'references', 'templates.md')),
    false,
  );
});

test('maintenance gate and discovery preserve every durable state without broad reads', () => {
  const maintenance = read('skills', 'architecture-memory', 'SKILL.md');

  for (const state of ['confirmed', 'inferred', 'proposed', 'unknown', 'planned']) {
    assert.match(maintenance, new RegExp('worth keeping[^\\n]*`' + state + '`'));
  }
  assert.match(maintenance, /every `docs\/\*\*\/\.architecture-memory\/manifest\.json`[\s\S]*one bounded operation/);
  assert.match(maintenance, /exactly one schema-v2 `managed: true` manifest/);
  assert.match(maintenance, /normalized relative `\.md` paths resolving inside the architecture root and outside `.architecture-memory`/);
  assert.match(maintenance, /otherwise stop without a managed-document read or write/i);
  assert.doesNotMatch(maintenance, /document-contract\.md/);
  assert.match(maintenance, /Write once[\s\S]*without validation or reread/);
});

test('explicit maintenance keeps its description and entrypoint compact', () => {
  const maintenance = read('skills', 'architecture-memory', 'SKILL.md');
  const description = frontmatter(maintenance).match(/^description:\s*(.+)$/m)?.[1] || '';

  assert.ok(description.length <= 240, `description is ${description.length} characters`);
  assert.ok(maintenance.length <= 2500, `maintenance skill is ${maintenance.length} characters`);
  assert.ok(words(maintenance) <= 310, `maintenance skill is ${words(maintenance)} words`);
});

test('initialization and conditional templates stay compact', () => {
  const init = read('skills', 'architecture-memory-init', 'SKILL.md');
  const procedure = read('skills', 'architecture-memory-init', 'references', 'initialization.md');
  const templates = [
    read('skills', 'architecture-memory', 'references', 'base-templates.md'),
    read('skills', 'architecture-memory', 'references', 'component-templates.md'),
    read('skills', 'architecture-memory', 'references', 'decision-templates.md'),
  ].join('\n');

  assert.ok(words(init) <= 50, `init skill is ${words(init)} words`);
  assert.ok(words(init) + words(procedure) <= 710, 'init entry path exceeded its word budget');
  assert.ok(words(templates) <= 835, `templates are ${words(templates)} words`);
});

test('initialization supports reactivation and sets the manifest document language', () => {
  const procedure = read('skills', 'architecture-memory-init', 'references', 'initialization.md');

  assert.match(procedure, /`managed: false`[\s\S]*change only `managed` to `true`/);
  assert.ok(procedure.indexOf('## Preflight') < procedure.indexOf('## Evidence pass'));
  assert.match(procedure, /before repository analysis or template reads/i);
  assert.match(procedure, /BCP 47 tag in manifest `language`/);
  assert.match(procedure, /set `git_checkpoint\.revision` to its full object ID/);
  assert.match(procedure, /working-tree evidence[\s\S]*outside the checkpoint/);
  assert.match(procedure, /After the first commit[\s\S]*fills the checkpoint/);
  assert.match(procedure, /normalized relative `\.md` paths inside the architecture root/);
  assert.match(procedure, /symlinks or junctions[\s\S]*resolve inside the root/);
  assert.match(procedure, /`order` is a non-negative integer/);
});

test('human templates expose the legend, selected L3, adjacent evidence, and immutable ADR history', () => {
  const base = read('skills', 'architecture-memory', 'references', 'base-templates.md');
  const components = read('skills', 'architecture-memory', 'references', 'component-templates.md');
  const decisions = read('skills', 'architecture-memory', 'references', 'decision-templates.md');

  assert.match(base, /One-sentence legend: unmarked is confirmed\/current/);
  assert.match(base, /\]\(components\/README\.md\)[^\n]*include only when L3 documents exist/);
  assert.match(base, /keyed annotation directly below its table/);
  assert.doesNotMatch(base, /^## <Exceptional states and evidence>$/m);
  assert.match(components, /First L3:[\s\S]*architecture `README\.md`[\s\S]*register/);
  assert.match(components, /\[<Component document>\]\(<container-slug>\.md\)/);
  assert.match(decisions, /\[ADR-<number>\]\(ADR-<number>-<slug>\.md\)/);
  assert.match(decisions, /relative link from the affected current C4 or Context item to its rationale/);
  for (const field of ['Context', 'Decision', 'Consequences', 'Alternatives', 'Evidence']) {
    assert.match(decisions, new RegExp(`accepted ADR's[^\\n]*${field}`));
  }
  assert.match(decisions, /Status, Supersedes, Superseded by, Current document, and clear typographical errors/);
  assert.match(decisions, /new ADR pointing `Supersedes` to the old ADR[\s\S]*old ADR points `Superseded by` to the new one/);
});

test('all document kinds remain represented across split templates', () => {
  const templates = [
    read('skills', 'architecture-memory', 'references', 'base-templates.md'),
    read('skills', 'architecture-memory', 'references', 'component-templates.md'),
    read('skills', 'architecture-memory', 'references', 'decision-templates.md'),
  ].join('\n');

  for (const relativePath of [
    'README.md',
    '01-system-context.md',
    '02-containers.md',
    'components/README.md',
    'components/<container-slug>.md',
    '04-context.md',
    'decisions/README.md',
    'decisions/ADR-<number>-<slug>.md',
  ]) {
    assert.ok(templates.includes(relativePath), `missing template for ${relativePath}`);
  }
});

test('initialization procedure exposes the complete neutral manifest schema', () => {
  const procedure = read('skills', 'architecture-memory-init', 'references', 'initialization.md');
  const jsonBlock = procedure.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(jsonBlock, 'manifest example must be JSON');
  const manifest = JSON.parse(jsonBlock[1]);

  assert.deepEqual(Object.keys(manifest), [
    'schema_version', 'managed', 'language', 'git_checkpoint', 'documents',
  ]);
  assert.equal(manifest.schema_version, 2);
  assert.equal(manifest.managed, true);
  assert.deepEqual(Object.keys(manifest.git_checkpoint), [
    'revision', 'branch_at_check', 'checked_at',
  ]);
  assert.match(manifest.git_checkpoint.revision, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
  assert.deepEqual(Object.keys(manifest.documents[0]), [
    'id', 'kind', 'path', 'order', 'verified_at', 'source_revision',
  ]);

  const kinds = [
    'index', 'system-context', 'containers', 'component-index',
    'component', 'context', 'decision-index', 'decision',
  ];
  for (const kind of kinds) {
    assert.ok(procedure.includes('`' + kind + '`'), `missing document kind ${kind}`);
  }
});

test('skills do not depend on a standalone document contract', () => {
  assert.equal(
    fs.existsSync(path.join(repoRoot, 'skills', 'architecture-memory', 'references', 'document-contract.md')),
    false,
  );
  for (const skill of [
    'architecture-memory-init',
    'architecture-memory',
    'architecture-memory-update',
  ]) {
    assert.doesNotMatch(read('skills', skill, 'SKILL.md'), /document-contract\.md/);
  }
});

test('skills add no standalone validator or maintenance script', () => {
  for (const skill of [
    'architecture-memory-init',
    'architecture-memory',
    'architecture-memory-update',
  ]) {
    const root = path.join(repoRoot, 'skills', skill);
    const files = fs.readdirSync(root, { recursive: true });
    assert.equal(files.some((file) => /(^|[\\/])scripts([\\/]|$)/.test(file)), false);
    assert.equal(files.some((file) => /validat/i.test(file)), false);
  }
});
