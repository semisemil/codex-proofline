const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

function frontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, 'skill must have frontmatter');
  return match[1];
}

test('initializer is explicit-only while maintenance remains model-invoked', () => {
  const init = read('skills', 'architecture-memory-init', 'SKILL.md');
  const initMetadata = read('skills', 'architecture-memory-init', 'agents', 'openai.yaml');
  const maintenance = read('skills', 'architecture-memory', 'SKILL.md');
  const maintenanceMetadata = read('skills', 'architecture-memory', 'agents', 'openai.yaml');

  assert.match(frontmatter(init), /^name: architecture-memory-init$/m);
  assert.match(initMetadata, /allow_implicit_invocation:\s*false/);
  assert.match(frontmatter(maintenance), /^name: architecture-memory$/m);
  assert.match(frontmatter(maintenance), /^description:\s*\S.+$/m);
  assert.doesNotMatch(maintenanceMetadata, /allow_implicit_invocation:\s*false/);
});

test('Git reconciliation is explicit-only and owns only committed checkpoint updates', () => {
  const update = read('skills', 'architecture-memory-update', 'SKILL.md');
  const metadata = read('skills', 'architecture-memory-update', 'agents', 'openai.yaml');
  const maintenance = read('skills', 'architecture-memory', 'SKILL.md');

  assert.match(frontmatter(update), /^name: architecture-memory-update$/m);
  assert.match(metadata, /allow_implicit_invocation:\s*false/);
  assert.match(update, /Git worktree must be clean/);
  assert.match(update, /checkpoint revision[\s\S]*resolve to a commit/);
  assert.match(update, /Architecture update stopped: <reason>; checkpoint <unchanged or unavailable>/);
  assert.match(update, /checkpoint equals `HEAD`[\s\S]*without a document read or write/);
  assert.match(update, /`branch_at_check` is provenance only/);
  assert.match(update, /git diff --name-status --find-renames <checkpoint> <HEAD> -- \./);
  assert.match(update, /classify every changed project path before advancing the checkpoint/i);
  assert.match(update, /code delta alone cannot create an ADR/);
  assert.match(update, /document-contract\.md\) only before a structural document change or unfamiliar formatting/);
  assert.match(update, /decision-templates\.md\) before writing it/);
  assert.doesNotMatch(update, /document-contract\.md\) completely before the first write/);
  assert.match(update, /Advance the checkpoint even when no document content changes/);
  assert.doesNotMatch(update, /does not include staged, unstaged, or untracked changes/);
  assert.match(maintenance, /never advances `git_checkpoint`/);
});

test('initialization and maintenance route conditional template branches', () => {
  const init = read('skills', 'architecture-memory-init', 'SKILL.md');
  const maintenance = read('skills', 'architecture-memory', 'SKILL.md');
  const initProcedure = read('skills', 'architecture-memory-init', 'references', 'initialization.md');
  const baseTemplates = read('skills', 'architecture-memory', 'references', 'base-templates.md');
  const componentTemplates = read('skills', 'architecture-memory', 'references', 'component-templates.md');
  const decisionTemplates = read('skills', 'architecture-memory', 'references', 'decision-templates.md');
  const contract = read('skills', 'architecture-memory', 'references', 'document-contract.md');

  assert.match(init, /references\/initialization\.md/);
  assert.match(init, /\.\.\/architecture-memory\/references\/document-contract\.md/);
  for (const name of ['base-templates', 'component-templates', 'decision-templates']) {
    assert.match(init, new RegExp(`architecture-memory\\/references\\/${name}\\.md`));
    assert.match(maintenance, new RegExp(`references\\/${name}\\.md`));
  }
  assert.match(init, /component templates[\s\S]*only when an L3 document is selected/);
  assert.match(init, /decision template[\s\S]*only when an ADR is warranted/);
  assert.match(maintenance, /Ordinary patches[\s\S]*without loading templates/);
  assert.ok(maintenance.length < initProcedure.length
    + baseTemplates.length + componentTemplates.length + decisionTemplates.length + contract.length);

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
  const contract = read('skills', 'architecture-memory', 'references', 'document-contract.md');

  for (const state of ['confirmed', 'inferred', 'proposed', 'unknown', 'planned']) {
    assert.match(maintenance, new RegExp('worth preserving[^\\n]*`' + state + '`'));
  }
  assert.match(maintenance, /one bounded operation[\s\S]*every manifest under `docs\/\*\*`/);
  assert.match(maintenance, /Only when exactly one[\s\S]*`managed: true`[\s\S]*return the target heading/);
  assert.match(maintenance, /`managed: false`[\s\S]*without reading a managed document or writing/);
  assert.match(contract, /Exactly one supported manifest selects its parent architecture root/);
  assert.match(contract, /more than one is a conflict/);
  assert.match(maintenance, /Use one write call[\s\S]*without a validator or reread/);
});

test('initialization supports reactivation and sets the manifest document language', () => {
  const procedure = read('skills', 'architecture-memory-init', 'references', 'initialization.md');
  const contract = read('skills', 'architecture-memory', 'references', 'document-contract.md');

  assert.match(procedure, /`managed: false`[\s\S]*change only `managed` to `true`/);
  assert.ok(procedure.indexOf('## Preflight') < procedure.indexOf('## Evidence pass'));
  assert.match(procedure, /before repository analysis or template reads/);
  assert.match(procedure, /BCP 47 tag in manifest `language`/);
  assert.match(contract, /`language` is the BCP 47 tag of the initialization conversation language/);
  assert.match(contract, /`"ko"` above is only an example/);
  assert.match(procedure, /set `git_checkpoint\.revision` to its full object ID/);
  assert.match(procedure, /working-tree evidence[\s\S]*is not part of that checkpoint/);
});

test('human templates expose the legend, selected L3, adjacent evidence, and immutable ADR history', () => {
  const base = read('skills', 'architecture-memory', 'references', 'base-templates.md');
  const components = read('skills', 'architecture-memory', 'references', 'component-templates.md');
  const decisions = read('skills', 'architecture-memory', 'references', 'decision-templates.md');

  assert.match(base, /One-sentence legend: unmarked content is confirmed\/current/);
  assert.match(base, /\]\(components\/README\.md\)[^\n]*include only when L3 documents exist/);
  assert.match(base, /keyed annotation immediately below that table/);
  assert.doesNotMatch(base, /^## <Exceptional states and evidence>$/m);
  assert.match(components, /first L3 document[\s\S]*architecture `README\.md`[\s\S]*manifest/);
  assert.match(components, /\[<Component document>\]\(<container-slug>\.md\)/);
  assert.match(decisions, /\[ADR-<number>\]\(ADR-<number>-<slug>\.md\)/);
  assert.match(decisions, /relative link from the affected current C4 or Context item back to the ADR rationale/);
  for (const field of ['Context', 'Decision', 'Consequences', 'Alternatives', 'Evidence']) {
    assert.match(decisions, new RegExp(`accepted ADR's[^\\n]*${field}`));
  }
  assert.match(decisions, /Status, Supersedes, Superseded by, Current document, and clear typographical errors/);
  assert.match(decisions, /new ADR whose `Supersedes` points to the old ADR[\s\S]*old ADR's `Superseded by` points to the new one/);
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

test('manifest example exposes the complete neutral document contract', () => {
  const contract = read('skills', 'architecture-memory', 'references', 'document-contract.md');
  const jsonBlock = contract.match(/```json\r?\n([\s\S]*?)\r?\n```/);
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
    assert.ok(contract.includes('`' + kind + '`'), `missing document kind ${kind}`);
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
