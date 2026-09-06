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

function linkedFiles(documentPath) {
  const source = fs.readFileSync(documentPath, 'utf8');
  return [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => path.resolve(path.dirname(documentPath), match[1].split('#')[0]));
}

test('Spec document operations and template are reachable through local Markdown links', () => {
  const skillPath = path.join(__dirname, '..', 'skills', 'implementation-spec', 'SKILL.md');
  const operationsPath = path.join(path.dirname(skillPath), 'references', 'document-operations.md');

  assert.ok(linkedFiles(skillPath).includes(operationsPath), 'SKILL.md must link to document operations');
  assert.ok(linkedFiles(operationsPath).includes(templatePath), 'Document operations must link to the Spec template');
  assert.ok(fs.statSync(templatePath).isFile());
});
