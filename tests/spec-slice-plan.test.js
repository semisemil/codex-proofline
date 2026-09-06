'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const repoRoot = path.resolve(__dirname, '..');

test('Spec Slice links its only current plan template and keeps invocation policy', () => {
  const skill = fs.readFileSync(path.join(repoRoot, 'skills/spec-slice/SKILL.md'), 'utf8');
  const metadata = fs.readFileSync(path.join(repoRoot, 'skills/spec-slice/agents/openai.yaml'), 'utf8');
  const links = [...skill.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)]
    .map((match) => path.resolve(repoRoot, 'skills', 'spec-slice', match[1]));

  assert.ok(links.includes(path.join(repoRoot, 'skills', 'spec-slice', 'assets', 'templates', 'parallel.md')));
  for (const link of links) assert.ok(fs.statSync(link).isFile(), link);
  assert.match(metadata, /^\s*allow_implicit_invocation:\s*false$/m);
  assert.match(metadata, /^\s*default_prompt:\s*"[^"\r\n]*\$spec-slice[^"\r\n]*"$/m);
});
