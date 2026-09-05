#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROLES = new Set([
  'preparation', 'parallel-implementer', 'reviewer',
]);

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

function statePath(kind, id, cwd) {
  if (!id) return null;
  const identity = `${kind}\0${id}\0${cwd || ''}`;
  return path.join(stateRoot(), `${crypto.createHash('sha256').update(identity).digest('hex')}.json`);
}

function readState(target) {
  if (!target) return null;
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw new Error(`cannot read execution role state: ${error.message}`);
  }
}

function writeState(target, value) {
  if (!target) throw new Error('execution identity is unavailable');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, target);
}

function turnId(event) {
  return event.turn_id || event.turnId || null;
}

function sessionId(event) {
  return event.session_id || event.sessionId || null;
}

function mappedAgent(event) {
  const direct = event.agent_id || event.agentId;
  if (typeof direct === 'string' && direct) return direct;
  const value = readState(statePath('turn', turnId(event), event.cwd));
  return value && typeof value.agent_id === 'string' ? value.agent_id : null;
}

function roleTarget(event) {
  const agent = mappedAgent(event);
  if (agent) return statePath('agent', agent, event.cwd);
  return statePath('session', sessionId(event), event.cwd);
}

function bindRole(event, role) {
  const target = roleTarget(event);
  if (!target) throw new Error('execution role requires a stable session or subagent identity');
  const existing = readState(target);
  if (existing) {
    if (!ROLES.has(existing.role)) throw new Error('stored execution role is invalid');
    if (existing.role !== role) {
      return { ok: false, existing: existing.role };
    }
    return { ok: true, existing: role };
  }
  writeState(target, { role });
  return { ok: true, existing: null };
}

function readRole(event) {
  const value = readState(roleTarget(event));
  if (!value) return null;
  if (!ROLES.has(value.role)) throw new Error('stored execution role is invalid');
  return value.role;
}

function registerSubagent(event) {
  const agent = event.agent_id || event.agentId;
  const turn = turnId(event);
  if (!agent || !turn) throw new Error('SubagentStart requires agent_id and turn_id');
  const target = statePath('turn', turn, event.cwd);
  const existing = readState(target);
  if (existing && existing.agent_id !== agent) throw new Error('turn is already bound to another subagent');
  if (!existing) writeState(target, { agent_id: agent });
  emit();
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
  if (typeof value === 'string') return { patch: value };
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isTaskCreation(tool) {
  return /(?:^|__|\.)create_thread$|(?:^|__|\.)fork_thread$|(?:^|__|\.)spawn_agent$/.test(tool);
}

function isFollowup(tool) {
  return /(?:^|__|\.)followup_task$/.test(tool);
}

function isMessaging(tool) {
  return /(?:^|__|\.)send_message_to_thread$/.test(tool);
}

function isWait(tool) {
  return /(?:^|__|\.)(?:wait_agent|wait_threads)$/.test(tool);
}

function isInterrupt(tool) {
  return /(?:^|__|\.)interrupt_agent$/.test(tool);
}

function isPlan(tool) {
  return /(?:^|__|\.)update_plan$/.test(tool);
}

function isEdit(tool) {
  return /(?:^|__|\.)(?:apply_patch|edit|write)$/.test(tool);
}

function editPaths(event) {
  const input = toolInput(event);
  const values = [input.path, input.file_path, input.filePath];
  if (Array.isArray(input.files)) {
    for (const file of input.files) {
      if (file && typeof file === 'object') values.push(file.path, file.file_path, file.filePath);
    }
  }
  const patch = String(input.patch || '');
  for (const match of patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gmu)) {
    values.push(match[1]);
  }
  for (const match of patch.matchAll(/^\*\*\* Move to:\s*(.+)$/gmu)) values.push(match[1]);
  return values
    .filter((value) => typeof value === 'string' && value.length > 0)
    .map((value) => path.relative(event.cwd || '.', path.resolve(event.cwd || '.', value))
      .replaceAll('\\', '/'));
}

function isPreparationArtifactEdit(event) {
  const paths = editPaths(event);
  return paths.length > 0 && paths.every((filePath) => (
    /^\.proofline\/specs\/[^/]+\/PARALLEL\.md$/u.test(filePath)
  ));
}

function isExecutionControlEdit(event) {
  return editPaths(event).some((filePath) => /^\.proofline\/specs\//u.test(filePath));
}

function isCommand(tool) {
  return /(?:^|__|\.)(?:bash|exec_command)$/.test(tool);
}

function commandText(event) {
  const input = toolInput(event);
  return String(input.command || input.cmd || '');
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

function executableName(value) {
  return String(value || '').split(/[\\/]/).pop().toLowerCase().replace(/\.(?:exe|cmd)$/, '');
}

const STATE_READS = new Set(['status', 'diff', 'review-input']);

function stateAction(words) {
  return executableName(words[0]) === 'node' && executableName(words[1]) === 'implementation-state.js'
    ? words[2] || '' : null;
}

function usesStateMutation(command, allowed = STATE_READS) {
  return commandSegments(command).some((segment) => {
    const action = stateAction(commandWords(segment));
    return action !== null && !allowed.has(action);
  });
}

function readOnlyGit(words) {
  let index = 1;
  while (index < words.length && words[index].startsWith('-')) {
    if (['-C', '-c', '--git-dir', '--work-tree'].includes(words[index])) index += 2;
    else if (/^(?:--no-pager|--no-optional-locks|--git-dir=|--work-tree=)/.test(words[index])) index += 1;
    else return false;
  }
  const action = words[index];
  if (!['diff', 'show', 'status', 'log', 'ls-files', 'ls-tree', 'rev-parse', 'cat-file', 'diff-tree', 'diff-files', 'diff-index'].includes(action)) return false;
  const arguments_ = words.slice(index + 1);
  return !arguments_.some((word) => /^(?:--output(?:=|$)|--ext-diff$|--textconv$)/.test(word));
}

// This hook enforces recognized workflow operations. It is not a shell sandbox;
// filesystem permissions and the reviewer's read-only assignment remain authoritative.
function isReadOnlyCommand(command) {
  if (!command.trim()) return false;
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) {
        if (quote === "'" && command[index + 1] === "'") index += 1;
        else quote = null;
      }
      if (quote === '"' && (character === '$' || character.charCodeAt(0) === 96)) return false;
    } else if (character === "'" || character === '"') quote = character;
    else if ('><{}$'.includes(character) || character.charCodeAt(0) === 96) return false;
  }
  if (quote) return false;
  const reads = new Set([
    'rg', 'cat', 'head', 'tail', 'ls', 'pwd', 'wc',
    'get-content', 'get-childitem', 'get-item', 'get-location', 'test-path', 'resolve-path',
    'select-object', 'select-string', 'measure-object', 'format-list', 'format-table',
  ]);
  return commandSegments(command).every((segment) => {
    const words = commandWords(segment);
    const executable = executableName(words[0]);
    if (executable === 'git') return readOnlyGit(words);
    if (executable === 'node') {
      return executableName(words[1]) === 'implementation-state.js' && STATE_READS.has(words[2]);
    }
    if (!reads.has(executable)) return false;
    if (executable === 'rg' && words.some((word) => /^--pre(?:=|$)/.test(word))) return false;
    return true;
  });
}

function preTool(event) {
  const role = readRole(event);
  if (!role) return emit();
  const tool = normalizedTool(event);
  const coordinates = isTaskCreation(tool) || isWait(tool) || isFollowup(tool) || isInterrupt(tool) || isMessaging(tool);

  if (role === 'preparation') {
    if (coordinates || isPlan(tool)) {
      return deny('Preparation produces the requested planning documents and returns them to the main implementer.');
    }
    if (isEdit(tool) && !isPreparationArtifactEdit(event)) {
      return deny('Preparation writes Plan and Spec through their document writer; only optional PARALLEL.md is edited directly.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (usesStateMutation(command) || isCompletionCommand(command)) {
        return deny('Preparation returns the prepared Spec; the main implementer owns implementation and verification.');
      }
    }
    return emit();
  }

  if (role === 'parallel-implementer') {
    if (coordinates) {
      return deny('Parallel implementers repair their assigned work directly and report to the main implementer with send_message; delegation belongs to the main implementer.');
    }
    if (isEdit(tool) && isExecutionControlEdit(event)) {
      return deny('The main implementer owns the agreed Spec and parallel assignment plan.');
    }
    if (isCommand(tool) && usesStateMutation(commandText(event), new Set([...STATE_READS, 'check', 'evidence']))) {
      return deny('Parallel implementers may record verification; the main implementer owns capture, review, and completion.');
    }
    return emit();
  }

  if (isEdit(tool) || isPlan(tool) || coordinates) {
    return deny('Reviewers read the current evidence and return findings; they cannot change files or coordinate implementation.');
  }
  if (isCommand(tool) && !isReadOnlyCommand(commandText(event))) {
    return deny('Reviewers use read-only file or Git inspection and implementation-state.js status, diff, or review-input; verification and state changes belong to implementers.');
  }
  return emit();
}

function promptSubmit(event) {
  const prompt = String(event.prompt || '');
  const match = prompt.match(/^PROOFLINE_EXECUTION_ROLE: ([a-z-]+)(?:\r?\n|$)/);
  if (prompt.startsWith('PROOFLINE_EXECUTION_ROLE:') && !match) {
    return emit({ decision: 'block', reason: 'Malformed Proofline execution role marker.' });
  }
  if (match) {
    if (!ROLES.has(match[1])) {
      return emit({ decision: 'block', reason: `Unsupported Proofline execution role: ${match[1]}.` });
    }
    const bound = bindRole(event, match[1]);
    if (!bound.ok) {
      return emit({
        decision: 'block',
        reason: `Proofline role is immutable for this task: ${bound.existing} cannot become ${match[1]}.`,
      });
    }
  }
  emit();
}

function main() {
  const event = readEvent();
  if (process.argv[2] === 'subagent-start') registerSubagent(event);
  else if (process.argv[2] === 'prompt-submit') promptSubmit(event);
  else if (process.argv[2] === 'pre-tool') preTool(event);
  else throw new Error('expected subagent-start, prompt-submit, or pre-tool');
}

try {
  main();
} catch (error) {
  process.stderr.write(`Proofline execution guard failed: ${error.message}\n`);
  process.exitCode = 1;
}
