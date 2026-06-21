#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

try {
  const skillPath = path.join(
    __dirname,
    '..',
    'skills',
    'proofline-baseline-quality',
    'SKILL.md',
  );
  const skill = fs.readFileSync(skillPath, 'utf8').replace(/^\uFEFF/, '');
  const body = skill
    .replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
    .replace(/^\r?\n/, '');

  process.stdout.write(body);
} catch (error) {
  console.error(`Proofline hook failed: ${error.message}`);
  process.exit(1);
}
