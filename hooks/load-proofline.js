#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { getCurrentMode, logDiagnostic } = require('./proofline-state');

const RETRYABLE_CODES = new Set(['EACCES', 'EBUSY', 'ENOENT', 'EPERM']);
const RETRY_DELAYS_MS = [50, 150];

function readFileWithRetry(filePath) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (!RETRYABLE_CODES.has(error.code) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_DELAYS_MS[attempt]);
    }
  }
}

function removeFrontmatter(content) {
  return content
    .replace(/^\uFEFF/, '')
    .replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
    .replace(/^\r?\n/, '');
}

function resolveReferences(content, skillPath) {
  return content.replace(/`references\/([^`]+)`/g, (_match, reference) => (
    `\`${path.join(path.dirname(skillPath), 'references', reference)}\``
  ));
}

function readInput() {
  const input = fs.readFileSync(0, 'utf8');
  return input.trim() ? JSON.parse(input) : {};
}

let activePath;

try {
  const input = readInput();
  if (input.source === 'resume') {
    process.exit(0);
  }
  const state = getCurrentMode(input.session_id, {
    hook: 'load-proofline',
    event: 'SessionStart',
  });
  const skillPath = path.join(__dirname, '..', 'skills', 'proofline', 'SKILL.md');
  const modePath = path.join(__dirname, '..', 'skills', 'proofline', `${state.mode}.md`);
  activePath = skillPath;
  const baseline = resolveReferences(removeFrontmatter(readFileWithRetry(skillPath)), skillPath);
  activePath = modePath;
  const mode = readFileWithRetry(modePath).replace(/^\uFEFF/, '').replace(/^\r?\n/, '');
  process.stdout.write(`${baseline.trimEnd()}\n\n${mode.trimStart()}`);
} catch (error) {
  logDiagnostic({
    hook: 'load-proofline',
    event: 'SessionStart',
    error,
    pluginRoot: path.resolve(__dirname, '..'),
    skillPath: activePath,
    filePath: activePath,
  });
  console.error(`Proofline hook failed: ${error.message}`);
  process.exit(1);
}
