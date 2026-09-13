'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { parseDesignMetadata } = require('../dashboard/records/record-parser.js');
const root = path.resolve(__dirname, '..');

test('the documented Design envelope can be consumed by the actual parser', () => {
  const source = fs.readFileSync(path.join(root, 'skills/development-design/references/document-operations.md'), 'utf8');
  const json = source.match(/```json\n([\s\S]*?)\n```/)[1];
  const metadata = parseDesignMetadata(json);
  assert.equal(metadata.id, 'DESIGN-0001');
  assert.equal(metadata.revision, 1);
  assert.equal(metadata.status, 'draft');
});

test('current design, review and execution references resolve to existing local files', () => {
  for (const name of ['development-design', 'tenet-me', 'figure-it-out', 'start-implementation', 'implement']) {
    const file = path.join(root, 'skills', name, 'SKILL.md');
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\]\(([^)]+\.(?:md|js))(?:#[^)]*)?\)/g)) {
      assert.ok(fs.statSync(path.resolve(path.dirname(file), match[1])).isFile(), `${name}: ${match[1]}`);
    }
  }
});
