'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

function invoke(state, action, event) {
  return spawnSync(process.execPath, [hook, action], {
    input: JSON.stringify({ ...state, ...event }),
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, PLUGIN_DATA: state.pluginData },
  });
}

function run(state, action, event = {}) {
  const result = invoke(state, action, event);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout || '{}');
}

function arm(state, role) {
  return run(state, 'prompt-submit', { prompt: 'PROOFLINE_EXECUTION_ROLE: ' + role + '\n\nAssignment' });
}

function denied(value) {
  return value.hookSpecificOutput?.permissionDecision === 'deny';
}

function toolAllowed(state, tool_name, tool_input = {}) {
  return !denied(run(state, 'pre-tool', { tool_name, tool_input }));
}

function commandAllowed(state, cmd) {
  return toolAllowed(state, 'functions.exec_command', { cmd });
}

test('the unmarked current session can implement, verify, and coordinate parallel work', (t) => {
  const state = fixture(t);
  assert.equal(toolAllowed(state, 'functions.apply_patch', { patch: '*** Update File: src/a.js' }), true);
  assert.equal(commandAllowed(state, 'npm test'), true);
  for (const tool of ['collaboration.spawn_agent', 'collaboration.followup_task', 'collaboration.send_message', 'collaboration.wait_agent']) {
    assert.equal(toolAllowed(state, tool), true, tool);
  }
  assert.equal(commandAllowed(state, 'node writers/document-writer.js write --kind spec --change-kind operational'), true);
});

test('preparation writes planning documents through the writer and an optional flat assignment plan', (t) => {
  const state = fixture(t);
  arm(state, 'preparation');
  assert.equal(commandAllowed(state, 'node plugin/writers/document-writer.js write --kind spec --project-root . --relative-path .proofline/specs/SPEC-0001/SPEC.md'), true);
  for (const file of ['.proofline/specs/SPEC-0001/PARALLEL.md', path.join(repoRoot, '.proofline/specs/SPEC-0001/PARALLEL.md')]) {
    assert.equal(toolAllowed(state, 'apply_patch', '*** Begin Patch\n*** Add File: ' + file + '\n+plan\n*** End Patch'), true, file);
  }
  for (const file of ['src/product.js', '.proofline/specs/SPEC-0001/SPEC.md', '.proofline/specs/SPEC-0001/gates/G1.md', '.proofline/specs/SPEC-0001/slices/S1.md']) {
    assert.equal(toolAllowed(state, 'Edit', { file_path: file }), false, file);
  }
  assert.equal(toolAllowed(state, 'apply_patch', { patch: '*** Update File: .proofline/specs/SPEC-0001/PARALLEL.md\n*** Move to: src/product.js' }), false);
  for (const command of ['npm test']) {
    assert.equal(commandAllowed(state, command), false, command);
  }
  for (const tool of ['spawn_agent', 'followup_task', 'wait_agent', 'create_thread', 'send_message_to_thread']) {
    assert.equal(toolAllowed(state, tool), false, tool);
  }
});

test('parallel implementers diagnose, repair, and verify directly without recursive delegation', (t) => {
  const state = fixture(t);
  arm(state, 'parallel-implementer');
  assert.equal(toolAllowed(state, 'apply_patch', { patch: '*** Update File: src/a.js' }), true);
  assert.equal(toolAllowed(state, 'collaboration.send_message', { target: '/root', message: 'Need the agreed interface to proceed.' }), true);
  for (const command of [
    'npm test', 'uv run pytest tests/api/test_items.py -q', 'bun run --cwd frontend build',
    'node --test tests/changed.test.js', 'git diff -- src/a.js', 'rg --files',
  ]) assert.equal(commandAllowed(state, command), true, command);
  for (const tool of [
    'spawn_agent', 'collaboration.spawn_agent', 'functions.collaboration.spawn_agent',
    'followup_task', 'collaboration.followup_task', 'collaboration.interrupt_agent',
    'create_thread', 'mcp__codex_app__create_thread', 'fork_thread',
    'send_message_to_thread', 'mcp__codex_app__send_message_to_thread', 'wait_agent', 'wait_threads',
  ]) assert.equal(toolAllowed(state, tool), false, tool);
  assert.equal(toolAllowed(state, 'Write', { path: '.proofline/specs/SPEC-0001/SPEC.md' }), false);
});

test('reviewers inspect actual state, source, and evidence through read-only commands', (t) => {
  const state = fixture(t);
  arm(state, 'reviewer');
  for (const command of [
    'git diff -- src/a.js', 'git show HEAD:src/a.js', 'git --no-optional-locks status --short',
    'git -c safe.directory=C:/Proofline -C C:/Proofline diff -- src/a.js',
    'git ls-files', 'git rev-parse --show-toplevel',
    'rg -n "test|build" src', 'rg --files src',
    "Get-Content 'src/a.js' | Select-Object -First 40",
    'Get-Content .proofline/specs/SPEC-0001/SPEC.md',
    'Get-Content src/a.js; Get-Content src/b.js',
  ]) assert.equal(commandAllowed(state, command), true, command);
  assert.equal(toolAllowed(state, 'read_file', { path: 'src/a.js' }), true);
});

test('reviewers cannot execute checks or mutate files or Git', (t) => {
  const state = fixture(t);
  arm(state, 'reviewer');
  for (const tool of ['apply_patch', 'functions.apply_patch', 'Write', 'update_plan', 'collaboration.spawn_agent', 'collaboration.followup_task', 'collaboration.wait_agent', 'create_thread']) {
    assert.equal(toolAllowed(state, tool), false, tool);
  }
  for (const tool of ['Bash', 'functions.Bash', 'exec_command', 'functions.exec_command']) {
    assert.equal(toolAllowed(state, tool, { command: 'npm test', cmd: 'npm test' }), false, tool);
  }
  for (const command of [
    'npm test', 'node --test tests/a.test.js', 'python inspect.py', 'node inspect.js',
    'git add src/a.js', 'git -C . commit -m done', 'git status; git reset --hard',
    'git diff --output=diff.txt', 'git diff --ext-diff',
    'Set-Content src/a.js fixed', 'Get-Content src/a.js > output.txt',
    'rg --pre formatter src', 'node -e "require(\'fs\').writeFileSync(\'x\', \'x\')"',
    'Get-Content $(Remove-Item src/a.js)', 'Get-Content "src/$(Set-Content x y)"',
    'Get-Content src/a.js | ForEach-Object { Set-Content x $_ }',
    'node writers/document-writer.js write --kind spec --change-kind operational',
  ]) assert.equal(commandAllowed(state, command), false, command);
});

test('roles persist across turns and rejected changes preserve the original role', (t) => {
  const state = fixture(t);
  arm(state, 'parallel-implementer');
  const later = { ...state, turn_id: 'turn-b' };
  const switched = arm(later, 'reviewer');
  assert.equal(switched.decision, 'block');
  assert.match(switched.reason, /parallel-implementer cannot become reviewer/);
  assert.equal(commandAllowed(later, 'npm test'), true);
  assert.equal(toolAllowed(later, 'spawn_agent'), false);
});

test('subagent roles use agent identity and mapped turns without arming the main session', (t) => {
  const shared = fixture(t);
  const worker = { ...shared, turn_id: 'worker-turn', agent_id: 'worker-agent' };
  const reviewer = { ...shared, turn_id: 'reviewer-turn', agent_id: 'reviewer-agent' };
  run(worker, 'subagent-start');
  run(reviewer, 'subagent-start');
  arm(worker, 'parallel-implementer');
  arm(reviewer, 'reviewer');
  assert.equal(commandAllowed(worker, 'npm test'), true);
  assert.equal(commandAllowed(reviewer, 'npm test'), false);
  assert.equal(commandAllowed({ ...reviewer, agent_id: undefined }, 'npm test'), false);
  assert.equal(commandAllowed({ ...shared, turn_id: 'reviewer-next', agent_id: 'reviewer-agent' }, 'npm test'), false);
  assert.equal(toolAllowed(shared, 'collaboration.spawn_agent'), true);
  const fresh = { ...shared, turn_id: 'fresh-review-turn', agent_id: 'fresh-reviewer' };
  run(fresh, 'subagent-start');
  assert.equal(arm(fresh, 'reviewer').decision, undefined);
  assert.equal(commandAllowed(fresh, 'npm test'), false);
});

test('unarmed subagents and other sessions or directories do not inherit a role', (t) => {
  const parent = fixture(t);
  arm(parent, 'reviewer');
  const child = { ...parent, turn_id: 'child-turn', agent_id: 'child-agent' };
  run(child, 'subagent-start');
  assert.equal(commandAllowed(child, 'npm test'), true);
  assert.equal(commandAllowed({ ...parent, session_id: 'another-session', turn_id: 'another-turn' }, 'npm test'), true);
  assert.equal(commandAllowed({ ...parent, cwd: parent.pluginData }, 'npm test'), true);
});

test('unsupported and malformed role markers do not establish execution state', (t) => {
  const state = fixture(t);
  for (const role of ['slice-worker', 'slice-coordinator', 'root-implementer', 'implementer', 'unknown']) {
    assert.equal(arm(state, role).decision, 'block', role);
  }
  for (const marker of ['PROOFLINE_EXECUTION_ROLE: REVIEWER', 'PROOFLINE_EXECUTION_ROLE: reviewer trailing']) {
    assert.equal(run(state, 'prompt-submit', { prompt: marker }).decision, 'block');
  }
  assert.equal(commandAllowed(state, 'npm test'), true);
  assert.equal(fs.existsSync(path.join(state.pluginData, 'execution-guard')), false);
});

test('invalid identity transitions and corrupt stored state fail without changing bindings', (t) => {
  const state = fixture(t);
  const first = { ...state, agent_id: 'agent-a' };
  run(first, 'subagent-start');
  assert.notEqual(invoke({ ...state, agent_id: 'agent-b' }, 'subagent-start', {}).status, 0);
  arm(first, 'reviewer');
  assert.equal(commandAllowed({ ...state, agent_id: undefined }, 'npm test'), false);
  const identity = 'agent\0agent-a\0' + state.cwd;
  const target = path.join(state.pluginData, 'execution-guard', crypto.createHash('sha256').update(identity).digest('hex') + '.json');
  fs.writeFileSync(target, '{"role":"corrupt"}');
  const invalid = invoke(first, 'pre-tool', { tool_name: 'exec_command', tool_input: { cmd: 'npm test' } });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /stored execution role is invalid/);
  assert.equal(fs.readFileSync(target, 'utf8'), '{"role":"corrupt"}');
});

test('hook registration matches runtime tool names and retains architecture-memory hooks', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hooks/hooks.json'), 'utf8')).hooks;
  assert.ok(hooks.UserPromptSubmit.some(entry => entry.hooks.some(item => item.command.includes('execution-guard.js'))));
  assert.ok(hooks.SubagentStart.some(entry => entry.hooks.some(item => item.command.includes('execution-guard.js'))));
  const guard = hooks.PreToolUse.find(entry => entry.hooks.some(item => item.command.includes('execution-guard.js')));
  const matcher = new RegExp(guard.matcher);
  for (const tool of [
    'Bash', 'functions.exec_command', 'functions.apply_patch', 'Edit', 'Write',
    'spawn_agent', 'collaboration.spawn_agent', 'functions.collaboration.spawn_agent',
    'collaboration.followup_task', 'collaboration.send_message', 'collaboration.wait_agent',
    'collaboration.interrupt_agent', 'mcp__codex_app__create_thread',
    'mcp__codex_app__send_message_to_thread', 'mcp__codex_app__wait_threads',
  ]) assert.equal(matcher.test(tool), true, tool);
  assert.equal(matcher.test('read_file'), false);
  for (const event of ['SessionStart', 'SubagentStart', 'UserPromptSubmit']) {
    assert.ok(hooks[event].some(entry => entry.hooks.some(item => item.command.includes('architecture-memory.js'))), event);
  }
});
