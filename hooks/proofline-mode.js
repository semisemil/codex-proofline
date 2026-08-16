#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  getCurrentMode,
  logDiagnostic,
  normalizeMode,
  setCurrentMode,
  setDefaultMode,
} = require('./proofline-state');

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
  const hasTask = lines.some((line, index) => index !== lineIndex && line.trim().length > 0);
  if (tokens.length === 1) {
    return { isCommand: true, kind: 'status', hasTask };
  }
  if (tokens[1].toLowerCase() === 'default') {
    if (tokens.length === 2) {
      return { isCommand: true, kind: 'default-status', hasTask };
    }
    if (tokens.length === 3 && normalizeMode(tokens[2])) {
      return { isCommand: true, kind: 'default-change', mode: normalizeMode(tokens[2]), hasTask };
    }
    return { isCommand: true, kind: 'invalid', hasTask };
  }
  if (tokens.length === 2 && normalizeMode(tokens[1])) {
    return { isCommand: true, kind: 'change', mode: normalizeMode(tokens[1]), hasTask };
  }
  return { isCommand: true, kind: 'invalid', hasTask };
}

function readModePrompt(mode) {
  return fs.readFileSync(path.join(__dirname, '..', 'skills', 'proofline', `${mode}.md`), 'utf8')
    .replace(/^\uFEFF/, '')
    .trim();
}

function output(systemMessage, additionalContext) {
  process.stdout.write(JSON.stringify({
    systemMessage,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  }));
}

function taskInstruction(hasTask, commandOnlyInstruction) {
  return hasTask
    ? 'Continue the remaining user request after the first non-empty command line.'
    : commandOnlyInstruction;
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
    output(message, [
      message,
      'The Proofline response mode is unchanged.',
      taskInstruction(command.hasTask, 'Respond with only the one-line command error.'),
    ].join('\n'));
    process.exit(0);
  }

  if (command.kind === 'status') {
    const message = `Proofline: 현재 모드 ${before.mode}, 기본 모드 ${before.defaultMode}`;
    output(message, `${message}\n${taskInstruction(command.hasTask, 'Respond with only this status result.')}`);
    process.exit(0);
  }

  if (command.kind === 'default-status') {
    const message = `Proofline: 기본 모드 ${before.defaultMode}`;
    output(message, `${message}\n${taskInstruction(command.hasTask, 'Respond with only this status result.')}`);
    process.exit(0);
  }

  if (command.kind === 'default-change') {
    const defaultResult = setDefaultMode(command.mode, stateOptions);
    if (!defaultResult.ok) {
      const message = `Proofline: 기본 모드 저장 실패. 현재 모드 ${before.mode}, 기본 모드 ${before.defaultMode}`;
      output(message, `${message}\nBoth modes remain unchanged. ${taskInstruction(command.hasTask, 'Respond with only this failure result.')}`);
      process.exit(0);
    }
    const currentResult = setCurrentMode(input.session_id, command.mode, stateOptions);
    if (!currentResult.ok && currentResult.reason !== 'session-state-unavailable') {
      const message = `Proofline: 기본 모드 ${command.mode} 저장, 현재 모드 변경 실패 (${before.mode} 유지)`;
      output(message, `${message}\nDo not replace the current Proofline response-mode instructions. ${taskInstruction(command.hasTask, 'Respond with only this partial-failure result.')}`);
      process.exit(0);
    }
    const message = `Proofline: 기본 모드와 현재 모드를 ${command.mode}로 변경`;
    output(message, [
      message,
      'Replace any previous Proofline response-mode instructions with the current instructions below.',
      readModePrompt(command.mode),
      taskInstruction(command.hasTask, 'Respond with only the mode-change result.'),
    ].join('\n\n'));
    process.exit(0);
  }

  const currentResult = setCurrentMode(input.session_id, command.mode, stateOptions);
  if (!currentResult.ok) {
    const message = `Proofline: 현재 모드 변경 실패 (${before.mode} 유지)`;
    output(message, `${message}\nDo not replace the current Proofline response-mode instructions. ${taskInstruction(command.hasTask, 'Respond with only this failure result.')}`);
    process.exit(0);
  }
  const message = `Proofline: 현재 모드를 ${command.mode}로 변경`;
  output(message, [
    message,
    'Replace any previous Proofline response-mode instructions with the current instructions below.',
    readModePrompt(command.mode),
    taskInstruction(command.hasTask, 'Respond with only the mode-change result.'),
  ].join('\n\n'));
} catch (error) {
  logDiagnostic({
    hook: 'proofline-mode',
    event: 'UserPromptSubmit',
    error,
  });
  console.error(`Proofline mode hook failed: ${error.message}`);
  process.exit(1);
}

module.exports = { parseCommand };
