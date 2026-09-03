#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROLES = new Set([
  'preparation', 'slice-coordinator', 'implementer', 'root-implementer', 'reviewer',
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
  return value && typeof value === 'object' ? value : {};
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
    .map((value) => value.replaceAll('\\', '/').replace(/^\.\//, ''));
}

function isPreparationExecutionArtifactEdit(event) {
  const paths = editPaths(event);
  return paths.length > 0 && paths.every((filePath) => (
    /^\.proofline\/specs\/[^/]+\/(?:gates|slices)\/[^/]+\.md$/u.test(filePath)
  ));
}

function isCommand(tool) {
  return tool === 'bash' || /(?:^|__|\.)exec_command$/.test(tool);
}

function commandText(event) {
  const input = toolInput(event);
  return String(input.command || input.cmd || '');
}

function requestedExecutionRole(event) {
  const input = toolInput(event);
  const prompt = String(input.message || input.prompt || '');
  return prompt.match(/^PROOFLINE_EXECUTION_ROLE:\s*([a-z-]+)(?:\r?\n|$)/u)?.[1] ?? null;
}

function usesFeedback(command) {
  return /run-gates\.js[^\r\n]*\bfeedback\b/i.test(command);
}

function usesGateRun(command) {
  return /run-gates\.js[^\r\n]*\brun\b/i.test(command);
}

function usesCoordinatorMutation(command) {
  return /coordinator-state\.js[^\r\n]*\b(?:close|review-pass|finalize|finalize-review-pass|apply-reviewed)\b/i.test(command);
}

function usesCloseBatch(command) {
  return /coordinator-state\.js[^\r\n]*\bclose-batch\b/i.test(command);
}

function usesOtherControlMutation(command) {
  return /(?:prepare-worktree|sync-control-state|integrate-reviewed)\.js\b/i.test(command);
}

function usesPrepareReviewMutation(command) {
  return /prepare-review\.js[^\r\n]*\b(?:stage|unstage)\b/i.test(command);
}

function usesPrepareReviewRead(command) {
  return /prepare-review\.js[^\r\n]*\bdiff\b/i.test(command);
}

function usesRawGit(command) {
  return commandSegments(command).some((segment) => {
    const words = commandWords(segment);
    return words.some((word, index) => {
      const value = path.basename(word).toLowerCase().replace(/\.exe$/, '');
      return value === 'git' && (index === 0 || words[index - 1] === '&');
    });
  });
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

function preTool(event) {
  const role = readRole(event);
  if (!role) return emit();
  const tool = normalizedTool(event);

  if (role === 'preparation') {
    if (isTaskCreation(tool) || isWait(tool) || isPlan(tool) || isFollowup(tool)
      || isMessaging(tool)) {
      return deny('Preparation owns artifacts only and cannot coordinate other tasks.');
    }
    if (isEdit(tool) && !isPreparationExecutionArtifactEdit(event)) {
      return deny('Preparation writes Plan and Spec documents through their writer and may edit only Gate or Slice documents directly.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (usesGateRun(command) || usesCoordinatorMutation(command)
        || usesOtherControlMutation(command) || usesPrepareReviewMutation(command)
        || isCompletionCommand(command)) {
        return deny('Preparation cannot perform implementation, completion, review, or transport actions.');
      }
    }
    return emit();
  }

  if (role === 'implementer') {
    if (isTaskCreation(tool) || isWait(tool) || isPlan(tool) || isFollowup(tool)
      || isMessaging(tool)) {
      return deny('Leaf implementers cannot create, resume, wait for, message, or plan other tasks.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (usesRawGit(command)) return deny('Use Proofline Git helpers so trust stays exact and process-local.');
      if (usesGateRun(command)) return deny('The assigning coordinator owns completion Gate execution.');
      if (usesCoordinatorMutation(command) || usesOtherControlMutation(command)) {
        return deny('The assigning coordinator owns Proofline control-state transitions.');
      }
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
    if (/(?:^|__|\.)spawn_agent$/.test(tool) && requestedExecutionRole(event) !== 'reviewer') {
      return deny('Root implementation may create only a fresh Reviewer agent.');
    }
    if (isFollowup(tool)) return deny('Root implementation performs its own Repair in the same task.');
    if (isWait(tool) && !/(?:^|__|\.)wait_agent$/.test(tool)) {
      return deny('Root-only implementation may wait only for its Reviewer agent.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (usesRawGit(command)) return deny('Use Proofline Git helpers so trust stays exact and process-local.');
      if (usesCloseBatch(command)) {
        return deny('A Branch coordinator owns Leaf cohort completion.');
      }
      if (usesGateRun(command)) {
        return deny('Use coordinator-state.js close so the root Gate and review snapshot advance together.');
      }
      if (usesFeedback(command)) {
        return deny('Run coordinator-state.js close and repair from its transient diagnostics.');
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
      return deny('Slice coordinators use same-role Branch tasks and fresh child agents.');
    }
    if (isWait(tool) && !/(?:^|__|\.)wait_agent$/.test(tool)) {
      return deny('Slice coordinators may wait only for their own child agents.');
    }
    if (/(?:^|__|\.)fork_thread$/.test(tool)
      && requestedExecutionRole(event) !== 'slice-coordinator') {
      return deny('A Branch fork must keep the slice-coordinator role.');
    }
    if (/(?:^|__|\.)spawn_agent$/.test(tool)
      && !['implementer', 'reviewer'].includes(requestedExecutionRole(event))) {
      return deny('Slice coordinators may create only a fresh Leaf implementer or Reviewer agent.');
    }
    if (isEdit(tool)) {
      return deny('Slice coordinators change control state only through Proofline helpers.');
    }
    if (isCommand(tool)) {
      const command = commandText(event);
      if (usesRawGit(command)) return deny('Use Proofline Git helpers so trust stays exact and process-local.');
      if (isRootInventory(command)) return deny('Coordinator state comes from coordinator-state.js, not repository inventory.');
      if (usesPrepareReviewMutation(command)) {
        return deny('Leaf or root implementation owners stage product changes.');
      }
      if (usesGateRun(command)) {
        return deny('Use coordinator-state.js close so scope, Gate, status, and review snapshot advance together.');
      }
      if (isCompletionCommand(command) && !usesGateRun(command)) {
        return deny('Slice completion checks must run through coordinator-state.js close.');
      }
    }
    return emit();
  }

  if (isEdit(tool) || isPlan(tool) || isTaskCreation(tool) || isWait(tool)
    || isFollowup(tool) || isMessaging(tool)) {
    return deny('Reviewers are read-only and cannot create or wait for other tasks.');
  }
  if (isCommand(tool)) {
    const command = commandText(event);
    if (usesRawGit(command) || isCompletionCommand(command) || usesGateRun(command)
      || usesCoordinatorMutation(command) || usesOtherControlMutation(command)
      || usesPrepareReviewMutation(command)
      || (/prepare-review\.js\b/i.test(command) && !usesPrepareReviewRead(command))
      || /\bgit\s+(?:add|commit|reset|restore|checkout|cherry-pick|merge)\b/i.test(command)
      || /\b(?:set-content|out-file|remove-item|move-item|copy-item|new-item)\b/i.test(command)) {
      return deny('Reviewers inspect the staged snapshot without verification or mutation.');
    }
  }
  return emit();
}

function promptSubmit(event) {
  const prompt = String(event.prompt || '');
  const match = prompt.match(/^PROOFLINE_EXECUTION_ROLE: (preparation|slice-coordinator|implementer|root-implementer|reviewer)(?:\r?\n|$)/);
  if (match) {
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
