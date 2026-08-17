#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { logDiagnostic } = require('./proofline-state');

const ISSUE_DOCUMENT = Object.freeze({
  directory: ['.proofline', 'issues'],
  prefix: 'PL',
  label: 'issue',
});
const SPEC_DOCUMENT = Object.freeze({
  directory: ['.proofline', 'specs'],
  prefix: 'SPEC',
  label: 'specification',
});
const PLAN_DOCUMENT = Object.freeze({
  directory: ['.proofline', 'plan'],
  prefix: 'PLAN',
  label: 'plan',
});

const DOCUMENT_SKILLS = Object.freeze({
  '$proofline:issue-ledger': ISSUE_DOCUMENT,
  '$proofline:implementation-spec': SPEC_DOCUMENT,
  '$proofline:development-plan': PLAN_DOCUMENT,
  '$proofline:figure-it-out': Object.freeze({
    documents: Object.freeze([PLAN_DOCUMENT, SPEC_DOCUMENT]),
  }),
});

function findDocumentSkill(prompt) {
  if (typeof prompt !== 'string') {
    return null;
  }
  const firstLine = prompt.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!firstLine) {
    return null;
  }
  const invocation = firstLine.trim().split(/[ \t]+/, 1)[0];
  return DOCUMENT_SKILLS[invocation] || null;
}

function nextDocumentId(projectRoot, documentSkill) {
  const directory = path.join(projectRoot, ...documentSkill.directory);
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return `${documentSkill.prefix}-0001`;
    }
    error.filePath = directory;
    throw error;
  }

  const pattern = new RegExp(`^${documentSkill.prefix}-(\\d{4,})(?:$|[.-])`);
  let largest = 0n;
  for (const entry of entries) {
    const match = pattern.exec(entry.name);
    if (match) {
      const number = BigInt(match[1]);
      if (number > largest) {
        largest = number;
      }
    }
  }
  return `${documentSkill.prefix}-${String(largest + 1n).padStart(4, '0')}`;
}

function output(documentSkills, ids) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: documentSkills
        .map((documentSkill, index) => `Next ${documentSkill.label} number: ${ids[index]}`)
        .join('\n'),
    },
  }));
}

function main() {
  try {
    const rawInput = fs.readFileSync(0, 'utf8');
    const input = rawInput.trim() ? JSON.parse(rawInput) : {};
    const documentSkill = findDocumentSkill(input.prompt);
    if (!documentSkill) {
      return;
    }
    const documentSkills = documentSkill.documents || [documentSkill];
    const projectRoot = typeof input.cwd === 'string' && input.cwd.length > 0
      ? path.resolve(input.cwd)
      : process.cwd();
    output(
      documentSkills,
      documentSkills.map((candidate) => nextDocumentId(projectRoot, candidate)),
    );
  } catch (error) {
    logDiagnostic({
      hook: 'next-document-number',
      event: 'UserPromptSubmit',
      error,
      filePath: error.filePath,
    });
  }
}

if (require.main === module) {
  main();
}

module.exports = { DOCUMENT_SKILLS, findDocumentSkill, nextDocumentId };
