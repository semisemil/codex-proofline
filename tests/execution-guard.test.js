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
  run(state, 'prompt-submit', { prompt: `PROOFLINE_EXECUTION_ROLE: ${role}\n\nAssignment` });
}

function denied(value) {
  return value.hookSpecificOutput?.permissionDecision === 'deny';
}

test('implementer cannot create tasks or bypass the Gate runner with direct completion checks', (t) => {
  const state = fixture(t);
  arm(state, 'implementer');
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'create_thread', tool_input: {} })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'uv run pytest tests/api/test_items.py -q' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash',
    tool_input: { command: 'node plugin/skills/spec-slice/scripts/run-gates.js feedback --cwd . ["node","--test","tests/a.test.js"]' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** Update File: src/a.js\n*** End Patch' },
  })), false);
});

test('slice coordinator cannot edit product files or run direct completion commands', (t) => {
  const state = fixture(t);
  arm(state, 'slice-coordinator');
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Edit', tool_input: { file_path: 'src/a.js' },
  })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Edit', tool_input: { file_path: '.proofline/specs/SPEC-0001/SPEC.md' },
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
    tool_input: { command: 'node plugin/skills/spec-slice/scripts/run-gates.js run --cwd . .proofline/specs/SPEC-0001/gates/SPEC-0001.md' },
  })), true);
});

test('root-only implementer may implement and wait for review but cannot create execution tasks', (t) => {
  const state = fixture(t);
  arm(state, 'root-implementer');
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** Update File: src/a.js\n*** End Patch' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'spawn_agent', tool_input: { task_name: 'reviewer' },
  })), false);
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'wait_agent', tool_input: {} })), false);
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'wait_threads', tool_input: {} })), true);
  assert.equal(denied(run(state, 'pre-tool', { tool_name: 'fork_thread', tool_input: {} })), true);
  assert.equal(denied(run(state, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'npm test' },
  })), true);
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

test('reviewer and holder guards preserve only their bounded actions', (t) => {
  const reviewer = fixture(t);
  arm(reviewer, 'reviewer');
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'git diff --cached -- src/a.js' },
  })), false);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'npm test' },
  })), true);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), true);

  const holder = { ...fixture(t), session_id: 'session-holder' };
  arm(holder, 'holder');
  assert.equal(denied(run(holder, 'pre-tool', {
    tool_name: 'Bash', tool_input: { command: 'git status --short' },
  })), true);
});

test('roles are isolated by turn because subagents share the parent session id', (t) => {
  const shared = fixture(t);
  const implementer = { ...shared, turn_id: 'implementer-turn' };
  const reviewer = { ...shared, turn_id: 'reviewer-turn' };
  arm(implementer, 'implementer');
  arm(reviewer, 'reviewer');

  assert.equal(denied(run(implementer, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), false);
  assert.equal(denied(run(reviewer, 'pre-tool', {
    tool_name: 'apply_patch', tool_input: { patch: '*** Begin Patch\n*** End Patch' },
  })), true);
});

test('hook registration covers prompt role arming and relevant tools', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.ok(hooks.UserPromptSubmit[0].hooks.some((item) => item.command.includes('execution-guard.js')));
  assert.ok(hooks.PreToolUse[0].matcher.includes('create_thread'));
  assert.ok(hooks.PreToolUse[0].hooks[0].command.includes('execution-guard.js'));
});
