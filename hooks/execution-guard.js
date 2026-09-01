#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROLES = new Set(['holder', 'slice-coordinator', 'implementer', 'root-implementer', 'reviewer']);

function readEvent() {
  const input = fs.readFileSync(0, 'utf8');
  const value = JSON.parse(input || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('hook input must be a JSON object');
  }
  return value;
}

function stateRoot() {
  return path.join(process.env.PLUGIN_DATA || path.join(os.tmpdir(), 'proofline-plugin-data'), 'execution-guard');
}

function statePath(event) {
  const identity = `${event.turn_id || event.turnId || event.session_id || ''}\0${event.cwd || ''}`;
  if (identity === '\0') return null;
  return path.join(stateRoot(), `${crypto.createHash('sha256').update(identity).digest('hex')}.json`);
}

function writeRole(event, role) {
  const target = statePath(event);
  if (!target) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ role }), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, target);
}

function readRole(event) {
  const target = statePath(event);
  if (!target) return null;
  try {
    const value = JSON.parse(fs.readFileSync(target, 'utf8'));
    return ROLES.has(value.role) ? value.role : null;
  } catch {
    return null;
  }
}

function emit(value = {}) {
  process.stdout.write(JSON.stringify(value));
}

function deny(reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
}

function normalizedTool(event) {
  return String(event.tool_name || event.toolName || '').toLowerCase();
}

function toolInput(event) {
  const value = event.tool_input || event.toolInput || {};
  return value && typeof value === 'object' ? value : {};
}

function isTaskCreation(tool) {
  return /(?:^|__|\.)create_thread$|(?:^|__|\.)fork_thread$|(?:^|__|\.)spawn_agent$/.test(tool);
}

function isWait(tool) {
  return /(?:^|__|\.)(?:wait_agent|wait_threads)$/.test(tool);
}

function isPlan(tool) {
  return /(?:^|__|\.)update_plan$/.test(tool);
}

function isEdit(tool) {
  return /(?:^|__|\.)(?:apply_patch|edit|write)$/.test(tool);
}

function isCommand(tool) {
  return tool === 'bash' || /(?:^|__|\.)exec_command$/.test(tool);
}

function commandText(event) {
  const input = toolInput(event);
  return String(input.command || input.cmd || '');
}

function usesFeedback(command) {
  return /run-gates\.js[^\r\n]*\bfeedback\b/i.test(command);
}

function usesGateRun(command) {
  return /run-gates\.js[^\r\n]*\brun\b/i.test(command);
}

function commandSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      current += character;
      if (character === quote && command[index - 1] !== '\\' && command[index - 1] !== '`') {
        if (quote === "'" && command[index + 1] === "'") current += command[++index];
        else quote = null;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
      current += character;
    } else if (';&|\r\n'.includes(character)) {
      if (current.trim()) segments.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function commandWords(segment) {
  return [...segment.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter(Boolean);
}

function isCompletionCommand(command) {
  const completionNames = new Set(['test', 'build', 'lint', 'check', 'typecheck', 'e2e']);
  for (const segment of commandSegments(command)) {
    const words = commandWords(segment);
    const executable = String(words[0] || '').toLowerCase();
    if (!executable || words.includes('--write')) continue;
    if (executable === 'uv' && words.includes('run')
        && words.some((word) => /^(?:pytest|ruff|mypy)$/i.test(word))) return true;
    if (/^(?:pytest|mypy|nox|tox)$/i.test(executable)) return true;
    if (executable === 'ruff' && String(words[1]).toLowerCase() === 'check') return true;
    if (/^(?:npm|pnpm|yarn|bun)$/i.test(executable)) {
      const runIndex = words.findIndex((word) => word.toLowerCase() === 'run');
      const candidates = runIndex >= 0 ? words.slice(runIndex + 1) : words.slice(1, 2);
      if (candidates.some((word) => completionNames.has(word.toLowerCase()))) return true;
    }
    if (executable === 'dotnet' && /^(?:test|build)$/i.test(words[1])) return true;
    if (executable === 'cargo' && /^(?:test|check|clippy)$/i.test(words[1])) return true;
    if (executable === 'go' && /^(?:test|vet)$/i.test(words[1])) return true;
    if (/^(?:tsc|playwright|cypress)$/i.test(executable)) return true;
    if (executable === 'node') {
      const script = String(words[1] || '').split(/[\\/]/).pop();
      if (/(?:check|verify|test|e2e|benchmark|audit).*\.m?js$/i.test(script)) return true;
    }
  }
  return false;
}

function isRootInventory(command) {
  return /(?:^|[;&|]\s*)rg\s+--files(?:\s+(?:\.|\.\\|\.\/))?(?:\s*[;&|]|\s*$)/i.test(command)
    || /get-childitem\s+(?:-force\s+)?(?:\.\s+)?-recurse\b/i.test(command);
}

function editedPaths(event) {
  const input = toolInput(event);
  const direct = input.file_path || input.path || input.filePath;
  if (typeof direct === 'string') return [direct.replaceAll('\\', '/')];
  const patch = String(input.patch || input.input || '');
  return [...patch.matchAll(/^(?:\*\*\* (?:Add|Update|Delete) File:|[+]{3}|[-]{3})\s+([^\r\n]+)/gm)]
    .map((match) => match[1].replace(/^a\//, '').replace(/^b\//, '').replaceAll('\\', '/'));
}

function onlyControlEdits(event) {
  const paths = editedPaths(event);
  return paths.length > 0 && paths.every((file) => file === '.proofline' || file.startsWith('.proofline/'));
}

function preTool(event) {
  const role = readRole(event);
  if (!role) return emit();
  const tool = normalizedTool(event);

  if (role === 'holder') {
    if (isCommand(tool) || isEdit(tool) || isPlan(tool) || isTaskCreation(tool) || isWait(tool)) {
      return deny('Worktree holder may only return its ready callback.');
    }
    return emit();
  }

  if (role === 'implementer') {
    if (isTaskCreation(tool) || isWait(tool) || isPlan(tool)) {
      return deny('Implementation tasks cannot create, wait for, or plan other tasks.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (usesGateRun(command)) return deny('The assigning coordinator owns completion Gate execution.');
      if (isRootInventory(command)) return deny('Use a path-scoped inspection instead of repository-wide inventory.');
      if (isCompletionCommand(command) && !usesFeedback(command)) {
        return deny('Implementation feedback must use run-gates.js feedback; completion checks belong to the coordinator.');
      }
    }
    return emit();
  }

  if (role === 'root-implementer') {
    if (isPlan(tool) || /(?:^|__|\.)(?:create_thread|fork_thread)$/.test(tool)) {
      return deny('Root-only implementation uses its existing Worktree and creates only a Reviewer agent.');
    }
    if (isWait(tool) && !/(?:^|__|\.)wait_agent$/.test(tool)) {
      return deny('Root-only implementation may wait only for its Reviewer agent.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (usesGateRun(command)) {
        return deny('Use coordinator-state.js close so the root Gate and review snapshot advance together.');
      }
      if (isRootInventory(command)) return deny('Use a path-scoped inspection instead of repository-wide inventory.');
      if (/\bgit\s+(?:commit|cherry-pick|merge|reset|restore|checkout)\b/i.test(command)) {
        return deny('Root-only commit and transport state changes belong to coordinator-state.js review-pass.');
      }
      if (isCompletionCommand(command) && !usesFeedback(command)) {
        return deny('Completion checks belong to coordinator-state.js close.');
      }
    }
    return emit();
  }

  if (role === 'slice-coordinator') {
    if (isPlan(tool) || /(?:^|__|\.)create_thread$/.test(tool)) {
      return deny('Slice coordinators use the frozen tree and same-directory child tasks.');
    }
    if (isEdit(tool) && !onlyControlEdits(event)) {
      return deny('Slice coordinators cannot edit product or test files.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (isRootInventory(command)) return deny('Coordinator state comes from coordinator-state.js, not repository inventory.');
      if (usesGateRun(command)) {
        return deny('Use coordinator-state.js close so scope, Gate, status, and review snapshot advance together.');
      }
      if (isCompletionCommand(command) && !usesGateRun(command)) {
        return deny('Slice completion checks must run through coordinator-state.js close.');
      }
    }
    return emit();
  }

  if (isEdit(tool) || isPlan(tool) || isTaskCreation(tool) || isWait(tool)) {
    return deny('Reviewers are read-only and cannot create or wait for other tasks.');
  }
  if (isCommand(tool)) {
    const command = commandText(event);
    if (isCompletionCommand(command) || usesGateRun(command)
      || /\bgit\s+(?:add|commit|reset|restore|checkout|cherry-pick|merge)\b/i.test(command)
      || /\b(?:set-content|out-file|remove-item|move-item|copy-item|new-item)\b/i.test(command)) {
      return deny('Reviewers inspect the staged snapshot without verification or mutation.');
    }
  }
  return emit();
}

function promptSubmit(event) {
  const prompt = String(event.prompt || '');
  const match = prompt.match(/^PROOFLINE_EXECUTION_ROLE: (holder|slice-coordinator|implementer|root-implementer|reviewer)\s*$/m);
  if (match) writeRole(event, match[1]);
  emit();
}

function main() {
  const event = readEvent();
  if (process.argv[2] === 'prompt-submit') promptSubmit(event);
  else if (process.argv[2] === 'pre-tool') preTool(event);
  else throw new Error('expected prompt-submit or pre-tool');
}

try {
  main();
} catch (error) {
  process.stderr.write(`Proofline execution guard failed: ${error.message}\n`);
  process.exitCode = 1;
}
