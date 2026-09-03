'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const hook = path.join(repoRoot, 'hooks', 'execution-guard.js');

function fixture(t) {
  const pluginData = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-execution-guard-'));
  t.after(() => fs.rmSync(pluginData, { recursive: true, force: true, maxRetries: 10 }));
  return { pluginData, session_id: 'session-a', turn_id: 'turn-a', cwd: repoRoot };
}

function run(state, action, event) {
  const result = spawnSync(process.execPath, [hook, action], {
    input: JSON.stringify({ ...state, ...event }),
    encoding: 'utf8',
    env: { ...process.env, PLUGIN_DATA: state.pluginData },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout || '{}');
}

function arm(state, role) {
  return run(state, 'prompt-submit', { prompt: `PROOFLINE_EXECUTION_ROLE: ${role}\n\nAssignment` });
}

function denied(value) {
  return value.hookSpecificOutput?.permissionDecision === 'deny';
}

test('preparation remains an artifact-only role and cannot become an implementer', (t) => {
  const state = fixture(t);
  arm(state, 'preparation');
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'spawn_agent',
    tool_input: { message: 'PROOFLINE_EXECUTION_ROLE: implementer\n\nImplement.' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'apply_patch',
    tool_input: { patch: '*** Begin Patch\n*** Update File: .proofline/specs/SPEC-0001/SPEC.md\n*** End Patch' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/writers/document-writer.js spec create --project . --id SPEC-0001 --content-file input.md' },
  })), false);
  const switched = arm({ ...state, turn_id: 'turn-b' }, 'implementer');
  assert.equal(switched.decision, 'block');
  assert.match(switched.reason, /preparation cannot become implementer/);
});

test('implementer cannot create tasks or bypass the Gate runner with direct completion checks', (t) => {
  const state = fixture(t);
  arm(state, 'implementer');
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'create_thread', tool_input: {} })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'uv run pytest tests/api/test_items.py -q' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/spec-slice/scripts/run-gates.js feedback --cwd . --gate .proofline/specs/SPEC-0001/gates/SLICE-01.md --id G1' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** Update File: src/a.js\n*** End Patch' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'send_message_to_thread', tool_input: { message: 'complete' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js close --cwd . --spec spec --node SLICE-01 --mode leaf' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js finalize --cwd . --spec spec --node SPEC-0001 --mode multi-root --base abcdef1' },
  })), true);
});

test('slice coordinator cannot edit product files or run direct completion commands', (t) => {
  const state = fixture(t);
  arm(state, 'slice-coordinator');
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Edit', tool_input: { file_path: 'src/a.js' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Edit', tool_input: { file_path: '.proofline/specs/SPEC-0001/SPEC.md' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'fork_thread',
    tool_input: { prompt: 'PROOFLINE_EXECUTION_ROLE: slice-coordinator\n\nCoordinate.' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'fork_thread',
    tool_input: { prompt: 'PROOFLINE_EXECUTION_ROLE: implementer\n\nImplement.' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'spawn_agent',
    tool_input: { message: 'PROOFLINE_EXECUTION_ROLE: implementer\n\nImplement.' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'bun run build' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js close --cwd . --spec .proofline/specs/SPEC-0001 --node SPEC-0001 --mode root-only' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js finalize --cwd . --spec .proofline/specs/SPEC-0001 --node SPEC-0001 --mode single-root --base abcdef1 --fingerprint sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/spec-slice/scripts/run-gates.js run --cwd . .proofline/specs/SPEC-0001/gates/SPEC-0001.md' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js finalize --cwd . --spec .proofline/specs/SPEC-0001 --node SPEC-0001 --mode multi-root --base abcdef1' },
  })), false);
});

test('root-only implementer may implement and wait for review but cannot create execution tasks', (t) => {
  const state = fixture(t);
  arm(state, 'root-implementer');
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** Update File: src/a.js\n*** End Patch' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'spawn_agent', tool_input: { task_name: 'reviewer' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'spawn_agent',
    tool_input: { message: 'PROOFLINE_EXECUTION_ROLE: reviewer\n\nReview.' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'wait_agent', tool_input: {} })), false);
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'wait_threads', tool_input: {} })), true);
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'fork_thread', tool_input: {} })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'npm test' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/spec-slice/scripts/run-gates.js feedback --cwd . --gate .proofline/specs/SPEC-0001/gates/SPEC-0001.md --id G1' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: "node 'C:\\skill-token-benchmark\\coordinator-state.js' inspect --cwd . --spec spec --node SPEC-0001" },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'node benchmark_support/check-client.mjs --write' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'rg -n "Generated drift|Playwright failed|test-results" .proofline' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'bun run --cwd frontend build' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'git commit -m done' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js close --cwd . --spec .proofline/specs/SPEC-0001 --node SPEC-0001 --mode root-only' },
  })), false);
});

test('reviewer guard preserves only its bounded read-only actions', (t) => {
  const reviewer = fixture(t);
  arm(reviewer, 'reviewer');
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'git diff --cached -- src/a.js' },
  })), true);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/prepare-review.js diff --cwd . --path src/a.js' },
  })), false);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/prepare-review.js diff-range --cwd . --base abcdef1 --path src/a.js' },
  })), false);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'npm test' },
  })), true);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), true);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js close --cwd . --spec spec --node SPEC-0001 --mode root-only' },
  })), true);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/start-implementation/scripts/coordinator-state.js finalize-review-pass --cwd . --spec spec --node SPEC-0001 --base abcdef1 --commit abcdef2 --fingerprint sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
  })), true);

});

test('a main task role persists across turns and cannot be switched', (t) => {
  const shared = fixture(t);
  arm(shared, 'implementer');
  const later = { ...shared, turn_id: 'turn-b' };
  assert.equal(denied(run(later, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), false);
  const switched = arm(later, 'reviewer');
  assert.equal(switched.decision, 'block');
  assert.match(switched.reason, /implementer cannot become reviewer/);
  assert.equal(denied(run(later, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), false);
});

test('subagent roles use agent identity despite a shared parent session', (t) => {
  const shared = fixture(t);
  const implementer = { ...shared, turn_id: 'implementer-turn', agent_id: 'agent-implementer' };
  const reviewer = { ...shared, turn_id: 'reviewer-turn', agent_id: 'agent-reviewer' };
  run(implementer, 'subagent-start', {});
  run(reviewer, 'subagent-start', {});
  arm(implementer, 'implementer');
  arm(reviewer, 'reviewer');

  assert.equal(denied(run(implementer, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), false);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), true);

  const nextReviewerTurn = { ...shared, turn_id: 'reviewer-turn-2', agent_id: 'agent-reviewer' };
  assert.equal(denied(run(nextReviewerTurn, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), true);
});

test('an unarmed subagent does not inherit the parent task role', (t) => {
  const parent = fixture(t);
  arm(parent, 'reviewer');
  const child = { ...parent, turn_id: 'child-turn', agent_id: 'child-agent' };
  run(child, 'subagent-start', {});
  assert.equal(denied(run(child, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), false);
});

test('hook registration covers prompt role arming and relevant tools', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.ok(hooks.UserPromptSubmit[0].hooks.some((item) => item.command.includes('execution-guard.js')));
  assert.ok(hooks.SubagentStart[0].hooks.some((item) => item.command.includes('execution-guard.js')));
  assert.ok(hooks.PreToolUse[0].matcher.includes('create_thread'));
  assert.ok(hooks.PreToolUse[0].matcher.includes('followup_task'));
  assert.ok(hooks.PreToolUse[0].matcher.includes('send_message_to_thread'));
  assert.ok(hooks.PreToolUse[0].hooks[0].command.includes('execution-guard.js'));
});
