#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { getCurrentMode, logDiagnostic } = require('./proofline-state');
const { composeProoflinePrompt } = require('./proofline-prompt');

function readInput() {
  const input = fs.readFileSync(0, 'utf8');
  return input.trim() ? JSON.parse(input) : {};
}

try {
  const input = readInput();
  if (input.source === 'resume') {
    process.exit(0);
  }
  const state = getCurrentMode(input.session_id, {
    hook: 'load-proofline',
    event: 'SessionStart',
  });
  process.stdout.write(composeProoflinePrompt(state.mode));
} catch (error) {
  const filePath = error.prooflineFilePath;
  logDiagnostic({
    hook: 'load-proofline',
    event: 'SessionStart',
    error,
    pluginRoot: path.resolve(__dirname, '..'),
    skillPath: filePath,
    filePath,
  });
  console.error(`Proofline hook failed: ${error.message}`);
  process.exit(1);
}
