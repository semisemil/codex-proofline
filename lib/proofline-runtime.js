'use strict';

const {
  getCurrentMode, normalizeMode, setCurrentMode, setDefaultMode,
} = require('./proofline-state');
const { composeProoflinePrompt } = require('./proofline-prompt');

const USAGE = '$proofline [normal|focus|core|default [normal|focus|core]]';

function load(input) {
  if (input.hook_event_name === 'SessionStart' && input.source === 'resume') return '';
  const state = getCurrentMode(input.session_id, {
    hook: 'load-proofline', event: input.hook_event_name,
  });
  return composeProoflinePrompt(state.mode);
}

function parseCommand(prompt) {
  if (typeof prompt !== 'string') return { isCommand: false };
  const line = prompt.split(/\r?\n/).find((value) => value.trim().length > 0);
  if (!line || !/^\$proofline(?:$|[ \t])/.test(line.trim())) return { isCommand: false };
  const tokens = line.trim().split(/[ \t]+/);
  if (tokens.length === 1) return { isCommand: true, kind: 'status' };
  if (tokens[1].toLowerCase() === 'default') {
    if (tokens.length === 2) return { isCommand: true, kind: 'default-status' };
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

function changeMode(input) {
  const command = parseCommand(input.prompt);
  if (!command.isCommand) return {};
  const options = { hook: 'proofline-mode', event: 'UserPromptSubmit', initialize: false };
  const before = getCurrentMode(input.session_id, options);
  if (command.kind === 'invalid') {
    return { systemMessage: `Proofline: 잘못된 명령. 사용법: ${USAGE}` };
  }
  if (command.kind === 'status') {
    return { systemMessage: `Proofline: 현재 모드 ${before.mode}, 기본 모드 ${before.defaultMode}` };
  }
  if (command.kind === 'default-status') {
    return { systemMessage: `Proofline: 기본 모드 ${before.defaultMode}` };
  }
  if (command.kind === 'default-change') {
    const defaultResult = setDefaultMode(command.mode, options);
    if (!defaultResult.ok) {
      return { systemMessage: `Proofline: 기본 모드 저장 실패. 현재 모드 ${before.mode}, 기본 모드 ${before.defaultMode}` };
    }
    const currentResult = setCurrentMode(input.session_id, command.mode, options);
    if (!currentResult.ok && currentResult.reason !== 'session-state-unavailable') {
      return { systemMessage: `Proofline: 기본 모드 ${command.mode} 저장, 현재 모드 변경 실패 (${before.mode} 유지)` };
    }
    return {
      systemMessage: `Proofline: 기본 모드와 현재 모드를 ${command.mode}로 변경`,
      additionalContext: composeProoflinePrompt(command.mode),
    };
  }
  const currentResult = setCurrentMode(input.session_id, command.mode, options);
  if (!currentResult.ok) {
    return { systemMessage: `Proofline: 현재 모드 변경 실패 (${before.mode} 유지)` };
  }
  return {
    systemMessage: `Proofline: 현재 모드를 ${command.mode}로 변경`,
    additionalContext: composeProoflinePrompt(command.mode),
  };
}

module.exports = { load, changeMode, parseCommand };
