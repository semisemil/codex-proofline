#!/usr/bin/env node

const fs = require('node:fs');
const {
  getCurrentMode,
  logDiagnostic,
  normalizeMode,
  setCurrentMode,
  setDefaultMode,
} = require('./proofline-state');
const { composeProoflinePrompt } = require('./proofline-prompt');

const USAGE = '$proofline [normal|focus|caveman|default [normal|focus|caveman]]';

function parseCommand(prompt) {
  if (typeof prompt !== 'string') {
    return { isCommand: false };
  }
  const lines = prompt.split(/\r?\n/);
  const lineIndex = lines.findIndex((line) => line.trim().length > 0);
  if (lineIndex < 0) {
    return { isCommand: false };
  }
  const commandLine = lines[lineIndex].trim();
  if (!/^\$proofline(?:$|[ \t])/.test(commandLine)) {
    return { isCommand: false };
  }

  const tokens = commandLine.split(/[ \t]+/);
  if (tokens.length === 1) {
    return { isCommand: true, kind: 'status' };
  }
  if (tokens[1].toLowerCase() === 'default') {
    if (tokens.length === 2) {
      return { isCommand: true, kind: 'default-status' };
    }
    if (tokens.length === 3 && normalizeMode(tokens[2])) {
      return { isCommand: true, kind: 'default-change', mode: normalizeMode(tokens[2]) };
    }
    return { isCommand: true, kind: 'invalid' };
  }
  if (tokens.length === 2 && normalizeMode(tokens[1])) {
    return { isCommand: true, kind: 'change', mode: normalizeMode(tokens[1]) };
  }
  return { isCommand: true, kind: 'invalid' };
}

function output(systemMessage, additionalContext) {
  const response = { systemMessage };
  if (additionalContext !== undefined) {
    response.hookSpecificOutput = {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    };
  }
  process.stdout.write(JSON.stringify(response));
}

try {
  const rawInput = fs.readFileSync(0, 'utf8');
  const input = JSON.parse(rawInput);
  const command = parseCommand(input.prompt);
  if (!command.isCommand) {
    process.exit(0);
  }

  const stateOptions = {
    hook: 'proofline-mode',
    event: 'UserPromptSubmit',
    initialize: false,
  };
  const before = getCurrentMode(input.session_id, stateOptions);

  if (command.kind === 'invalid') {
    const message = `Proofline: 잘못된 명령. 사용법: ${USAGE}`;
    output(message);
    process.exit(0);
  }

  if (command.kind === 'status') {
    const message = `Proofline: 현재 모드 ${before.mode}, 기본 모드 ${before.defaultMode}`;
    output(message);
    process.exit(0);
  }

  if (command.kind === 'default-status') {
    const message = `Proofline: 기본 모드 ${before.defaultMode}`;
    output(message);
    process.exit(0);
  }

  if (command.kind === 'default-change') {
    const defaultResult = setDefaultMode(command.mode, stateOptions);
    if (!defaultResult.ok) {
      const message = `Proofline: 기본 모드 저장 실패. 현재 모드 ${before.mode}, 기본 모드 ${before.defaultMode}`;
      output(message);
      process.exit(0);
    }
    const currentResult = setCurrentMode(input.session_id, command.mode, stateOptions);
    if (!currentResult.ok && currentResult.reason !== 'session-state-unavailable') {
      const message = `Proofline: 기본 모드 ${command.mode} 저장, 현재 모드 변경 실패 (${before.mode} 유지)`;
      output(message);
      process.exit(0);
    }
    const message = `Proofline: 기본 모드와 현재 모드를 ${command.mode}로 변경`;
    output(message, composeProoflinePrompt(command.mode));
    process.exit(0);
  }

  const currentResult = setCurrentMode(input.session_id, command.mode, stateOptions);
  if (!currentResult.ok) {
    const message = `Proofline: 현재 모드 변경 실패 (${before.mode} 유지)`;
    output(message);
    process.exit(0);
  }
  const message = `Proofline: 현재 모드를 ${command.mode}로 변경`;
  output(message, composeProoflinePrompt(command.mode));
} catch (error) {
  logDiagnostic({
    hook: 'proofline-mode',
    event: 'UserPromptSubmit',
    error,
    filePath: error.prooflineFilePath,
  });
  console.error(`Proofline mode hook failed: ${error.message}`);
  process.exit(1);
}

module.exports = { parseCommand };
