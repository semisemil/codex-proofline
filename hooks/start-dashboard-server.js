#!/usr/bin/env node

const fs = require('node:fs');
const { startServer } = require('../dashboard/control');

async function main() {
  const rawInput = fs.readFileSync(0, 'utf8');
  if (rawInput.trim()) {
    JSON.parse(rawInput);
  }
  const result = await startServer();
  if (!result.ok && result.reason !== 'start-in-progress') {
    process.stderr.write(`Proofline dashboard server not started: ${result.reason}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Proofline dashboard hook failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
