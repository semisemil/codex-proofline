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

test('Spec plans minimum sufficient evidence instead of equivalent test combinations', () => {
  const skill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'implementation-spec', 'SKILL.md'),
    'utf8',
  );

  assert.match(skill, /one minimum-sufficient completion set/);
  assert.match(skill, /one representative success path/);
  assert.match(skill, /distinct changed result/);
  assert.match(skill, /authorization, input, state, or concurrency boundary/);
  assert.match(skill, /unchanged behavior and equivalent combinations get no new test/);
  assert.match(skill, /Fix the minimum completion set before fan-out/);
  assert.match(skill, /only checks required to decide the acceptance conditions/);
  assert.match(skill, /Add or change tests only when they directly decide/);
  assert.match(skill, /Implementation feedback adds no completion check/);
  assert.doesNotMatch(skill, /verification units|targeted, broad, and deep checks/);
  assert.match(skill, /only a relevant mutation makes it stale/);
});
