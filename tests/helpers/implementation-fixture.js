'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnGit } = require('../../lib/git-policy.js');
const implementation = require('../../skills/start-implementation/scripts/implementation-state.js');

const MAIN_SETTINGS = Object.freeze({ model: 'gpt-6-astra', reasoning: 'low' });
const SPEC = '.proofline/specs/SPEC-0001/SPEC.md';

function git(cwd, ...args) {
  const result = spawnGit(cwd, args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}

function removeFixture(directory) {
  const root = fs.realpathSync(os.tmpdir());
  const resolved = path.resolve(directory);
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'cleanup stays within the temporary directory');
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 });
}

function fixture(t, options = {}) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-implementation-test-')));
  t.after(() => removeFixture(cwd));
  const write = (name, content) => {
    const target = path.join(cwd, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  git(cwd, 'init');
  git(cwd, 'config', 'user.name', 'Proofline Test');
  git(cwd, 'config', 'user.email', 'proofline@example.invalid');
  git(cwd, 'config', 'core.autocrlf', 'false');
  const metadata = { schema_version: 2, id: 'SPEC-0001', title: 'Independent implementation fixture',
    kind: 'feature', status: 'ready', revision: 1, supersedes: [], superseded_by: null, related_issues: [] };
  write(SPEC, `---\n${JSON.stringify(metadata, null, 2)}\n---\n\nChange src/value.js to export 2. Preserve src/other.js and existing user edits. Completion: importing src/value.js returns 2; verify this with Node.\n`);
  write('src/value.js', 'module.exports = 1;\n');
  write('src/other.js', 'module.exports = "unchanged";\n');
  write('notes.txt', 'original notes\n');
  write('authority.txt', 'The requested value is 2.\n');
  write('.gitignore', 'ignored/\n');
  git(cwd, 'add', '--all');
  git(cwd, 'commit', '-m', 'fixture base');
  options.beforeCapture?.({ cwd, write });
  const input = { sources: ['authority.txt'],
    requirements: [{ id: 'behavior', text: 'The requested export equals 2.' }], settings: MAIN_SETTINGS,
    ...options.input };
  const initialIndex = fs.readFileSync(path.join(cwd, '.git', 'index'));
  const initialHead = git(cwd, 'rev-parse', 'HEAD');
  const captured = implementation.capture({ cwd, spec: SPEC }, input);
  t.after(() => removeFixture(path.dirname(captured.state_path)));
  return { cwd, write, statePath: captured.state_path, captured, input, spec: SPEC, initialIndex, initialHead,
    read: name => fs.readFileSync(path.join(cwd, name), 'utf8'),
    state: () => JSON.parse(fs.readFileSync(captured.state_path, 'utf8')) };
}

function checkBehavior(f, overrides = {}) {
  return implementation.check(f.statePath, { requirements: ['behavior'], dependencies: ['src/value.js'],
    command: [process.execPath, '-e', 'if (require("./src/value.js") !== 2) process.exit(1);'], ...overrides });
}

function reviewPass(f, reviewerId = 'reviewer-1', overrides = {}) {
  return implementation.review(f.statePath, { fingerprint: implementation.status(f.statePath).fingerprint,
    reviewer_id: reviewerId, main_settings: MAIN_SETTINGS, reviewer_settings: MAIN_SETTINGS,
    verdict: 'pass', findings: [], ...overrides });
}

function finding(overrides = {}) {
  return { id: 'finding-1', category: 'regression', requirement: 'The other export remains unchanged.',
    trigger: 'Import src/other.js.', evidence: 'src/other.js:1 exports an unexpected value.',
    change_relation: 'The current change modifies that export.', ...overrides };
}

module.exports = { fixture, git, checkBehavior, reviewPass, finding, MAIN_SETTINGS, SPEC };
