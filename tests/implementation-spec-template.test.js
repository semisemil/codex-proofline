const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const templatePath = path.join(
  __dirname,
  '..',
  'skills',
  'implementation-spec',
  'assets',
  'templates',
  'spec.md',
);

test('Spec template renders the machine-readable v2 envelope', () => {
  const rendered = fs.readFileSync(templatePath, 'utf8')
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
  assert.equal(metadata.schema_version, 2);
  assert.equal(metadata.title, 'Fix: settings #1');
});

test('Spec creation batches bounded project evidence and reuses unchanged sources', () => {
  const skill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'implementation-spec', 'SKILL.md'),
    'utf8',
  );

  assert.match(skill, /form one bounded manifest of the project evidence/);
  assert.match(skill, /load it in one batched tool call/);
  assert.match(skill, /another read is only for a newly discovered or changed source/);
  assert.match(skill, /Prefer symbol searches and relevant excerpts for large generated sources and test files/);
  assert.match(skill, /Reuse unchanged skill, template, project, and artifact evidence/);
});

test('Spec selects realistic outcome-level evidence without boundary test proliferation', () => {
  const skill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'implementation-spec', 'SKILL.md'),
    'utf8',
  );

  assert.match(skill, /one minimum-sufficient completion set/);
  assert.match(skill, /smallest realistic check on the real production path/);
  assert.match(skill, /One check may decide multiple acceptance conditions/);
  assert.match(skill, /distinct source-required result or a reproduced regression/);
  assert.match(skill, /Reuse existing checks when sufficient/);
  assert.match(skill, /automation would be indirect or unrealistic/);
  assert.match(skill, /review evidence or no mechanical check instead of inventing a test/);
  assert.match(skill, /explicit artifact obligation such as adding a test, migration, or generated contract/);
  assert.match(skill, /Unchanged behavior and implementation details get no new test/);
  assert.match(skill, /Fix that minimum completion set before fan-out/);
  assert.match(skill, /it is the only completion suite/);
  assert.match(
    skill,
    /Implementation tasks create and stage required artifacts without pre-running completion checks/,
  );
  assert.doesNotMatch(skill, /one representative success path/);
  assert.doesNotMatch(skill, /authorization, input, state, or concurrency boundary/);
  assert.doesNotMatch(skill, /verification units|targeted, broad, and deep checks/);
  assert.match(skill, /only a relevant mutation makes it stale/);
});

test('Spec keeps only document-specific body style rules', () => {
  const skill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'implementation-spec', 'SKILL.md'),
    'utf8',
  );

  assert.match(skill, /conventional telegraphic style/);
  assert.match(skill, /Use tables and bullets when they improve structure/);
  assert.match(skill, /Avoid terminal periods/);
  assert.doesNotMatch(skill, /Compress content as far as possible/);
  assert.doesNotMatch(skill, /short, dense development-document style/);
});
