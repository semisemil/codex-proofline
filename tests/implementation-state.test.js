'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const test = require('node:test');
const implementation = require('../skills/start-implementation/scripts/implementation-state.js');
const changes = require('../skills/start-implementation/scripts/change-state.js');
const { fixture, git, checkBehavior, reviewPass, finding, MAIN_SETTINGS } = require('./helpers/implementation-fixture.js');

function preparedReviewInput(f, settings) {
  implementation.prepareSnapshot(f.statePath);
  return implementation.reviewInput(f.statePath, settings);
}

function rejectsWithoutMutation(f, action, expected) {
  const state = fs.readFileSync(f.statePath);
  const spec = f.read(f.spec);
  const index = fs.readFileSync(path.join(f.cwd, '.git', 'index'));
  const head = git(f.cwd, 'rev-parse', 'HEAD');
  assert.throws(action, expected);
  assert.deepEqual(fs.readFileSync(f.statePath), state);
  assert.equal(f.read(f.spec), spec);
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git', 'index')), index);
  assert.equal(git(f.cwd, 'rev-parse', 'HEAD'), head);
}

test('run delta starts at the dirty working state and preserves staged, unstaged, and untracked changes', t => {
  const f = fixture(t, { beforeCapture: ({ cwd, write }) => {
    write('src/value.js', 'module.exports = 10; // user staged\n');
    git(cwd, 'add', '--', 'src/value.js');
    write('src/value.js', 'module.exports = 11; // user unstaged\n');
    write('notes.txt', 'user notes\n');
    write('user-draft.txt', 'user untracked draft\n');
  } });
  const index = fs.readFileSync(path.join(f.cwd, '.git', 'index'));
  const head = git(f.cwd, 'rev-parse', 'HEAD');
  assert.deepEqual(index, f.initialIndex);
  assert.equal(head, f.initialHead);
  assert.deepEqual(implementation.status(f.statePath).changed_paths, []);
  f.write('src/value.js', 'module.exports = 2; // requested implementation\n');
  assert.equal(checkBehavior(f).passed, true);
  const packet = preparedReviewInput(f, MAIN_SETTINGS);
  assert.deepEqual(packet.changed_paths, ['src/value.js']);
  assert.match(packet.diff, /-module.exports = 11; \/\/ user unstaged/);
  assert.match(packet.diff, /\+module.exports = 2; \/\/ requested implementation/);
  assert.doesNotMatch(packet.diff, /user staged|user notes|user untracked draft/);
  reviewPass(f);
  assert.equal(implementation.complete(f.statePath).status, 'completed');
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git', 'index')), index);
  assert.equal(git(f.cwd, 'rev-parse', 'HEAD'), head);
  assert.equal(git(f.cwd, 'show', ':src/value.js'), 'module.exports = 10; // user staged\n');
  assert.equal(f.read('notes.txt'), 'user notes\n');
  assert.equal(f.read('user-draft.txt'), 'user untracked draft\n');
  assert.match(f.read(f.spec), /"status": "completed"/);
  assert.equal(fs.existsSync(path.join(f.cwd, '.proofline/specs/SPEC-0001/slices')), false);
  assert.equal(fs.existsSync(path.join(f.cwd, '.proofline/specs/SPEC-0001/gates')), false);
});

test('completion and review preparation require every Spec condition to be verified', t => {
  const f = fixture(t, { input: { requirements: [
    { id: 'behavior', text: 'Requested behavior works.' }, { id: 'compatibility', text: 'Existing behavior remains compatible.' },
  ] } });
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  rejectsWithoutMutation(f, () => preparedReviewInput(f, MAIN_SETTINGS), /unverified/);
  reviewPass(f);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /unverified/);
  const snapshot = implementation.status(f.statePath);
  implementation.evidence(f.statePath, { requirements: ['compatibility'], dependencies: ['src/other.js'],
    fingerprint: snapshot.fingerprint, kind: 'inspection', passed: true,
    basis: 'Read src/other.js:1; its export matches the original fixture contract.' });
  assert.equal(implementation.complete(f.statePath).status, 'completed');
});

test('a changed dependency invalidates successful verification and the earlier review', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  reviewPass(f);
  f.write('src/value.js', 'module.exports = 3;\n');
  assert.equal(implementation.status(f.statePath).requirements[0].verified, false);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /unverified/);
  assert.equal(checkBehavior(f).passed, false);
  f.write('src/value.js', 'module.exports = 2; // corrected implementation\n');
  assert.equal(checkBehavior(f).passed, true);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /current independent review/);
  reviewPass(f, 'reviewer-2');
  assert.equal(implementation.complete(f.statePath).status, 'completed');
});

test('unrelated changes reuse scoped verification but require review of the latest complete delta', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  const check = checkBehavior(f);
  reviewPass(f);
  f.write('notes.txt', 'implementation notes\n');
  const status = implementation.status(f.statePath);
  assert.equal(status.requirements[0].verified, true);
  assert.equal(status.requirements[0].evidence_id, check.id);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /current independent review/);
  const packet = preparedReviewInput(f, MAIN_SETTINGS);
  assert.deepEqual(packet.changed_paths, ['notes.txt', 'src/value.js']);
  assert.equal(packet.verification.length, 1);
  assert.equal(packet.verification[0].id, check.id);
  reviewPass(f, 'reviewer-2');
  implementation.complete(f.statePath);
});

test('later command failures supersede earlier success for the same condition', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  assert.equal(checkBehavior(f).passed, true);
  const failure = checkBehavior(f, { command: [process.execPath, '-e', 'console.error("observed regression"); process.exit(7);'] });
  assert.equal(failure.exit_code, 7);
  assert.match(failure.stderr, /observed regression/);
  assert.equal(failure.passed, false);
  assert.equal(implementation.status(f.statePath).requirements[0].evidence_id, failure.id);
  assert.equal(implementation.status(f.statePath).requirements[0].verified, false);
  const missing = checkBehavior(f, { command: ['proofline-test-nonexistent-command-498df'] });
  assert.equal(missing.passed, false);
  assert.ok(missing.error);
  assert.equal(checkBehavior(f).passed, true);
});

test('verification that changes its own dependencies cannot prove the resulting state', t => {
  const f = fixture(t);
  const result = checkBehavior(f, { command: [process.execPath, '-e',
    'require("node:fs").writeFileSync("src/value.js", "module.exports = 2;\\n");'] });
  assert.equal(result.exit_code, 0);
  assert.equal(result.stable, false);
  assert.equal(result.passed, false);
  assert.equal(implementation.status(f.statePath).requirements[0].verified, false);
  assert.equal(checkBehavior(f).passed, true);
});

test('externally recorded command evidence records concrete results and rejects mismatched state', t => {
  const f = fixture(t);
  const fingerprint = implementation.status(f.statePath).fingerprint;
  const input = { requirements: ['behavior'], dependencies: ['src/value.js'], fingerprint,
    kind: 'command', passed: true, command: 'node verify.js', cwd: f.cwd, exit_code: 4,
    result: 'Expected 2, received 1.', basis: 'Captured verify.js output from this state.' };
  const record = implementation.evidence(f.statePath, input);
  assert.equal(record.passed, false);
  assert.equal(record.provenance, 'implementer-recorded');
  f.write('src/value.js', 'module.exports = 2;\n');
  rejectsWithoutMutation(f, () => implementation.evidence(f.statePath, { ...input, exit_code: 0 }), /current tested state/);
  rejectsWithoutMutation(f, () => implementation.evidence(f.statePath, {
    ...input, fingerprint: implementation.status(f.statePath).fingerprint, command: '',
  }), /Command evidence/);
});

test('each review uses a fresh identity and identical main/reviewer settings at dispatch', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  rejectsWithoutMutation(f, () => reviewPass(f, 'reviewer-mismatch', {
    reviewer_settings: { model: 'gpt-5.6-sol', reasoning: 'high' },
  }), /main implementer settings/);
  const packet = preparedReviewInput(f, MAIN_SETTINGS);
  assert.deepEqual(packet.reviewer_settings, MAIN_SETTINGS);
  reviewPass(f);
  rejectsWithoutMutation(f, () => reviewPass(f), /new reviewer/);
  const changedMain = { model: 'gpt-5.6-sol', reasoning: 'medium' };
  const next = preparedReviewInput(f, changedMain);
  assert.deepEqual(next.reviewer_settings, changedMain);
  reviewPass(f, 'reviewer-2', { main_settings: changedMain, reviewer_settings: changedMain });
  assert.deepEqual(f.state().main_settings, changedMain);
});

test('review records reject a stale diff fingerprint without modifying state', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  const packet = preparedReviewInput(f, MAIN_SETTINGS);
  f.write('notes.txt', 'newly changed after reviewer dispatch\n');
  rejectsWithoutMutation(f, () => reviewPass(f, 'reviewer-stale', { fingerprint: packet.fingerprint }), /Review is stale/);
});

test('review input and status are read-only after main implementer prepares snapshot blobs', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  rejectsWithoutMutation(f, () => implementation.reviewInput(f.statePath, MAIN_SETTINGS), /Run snapshot/);
  implementation.prepareSnapshot(f.statePath);
  const directory = path.dirname(f.statePath);
  const files = fs.readdirSync(directory, { recursive: true }).filter(name => fs.statSync(path.join(directory, name)).isFile());
  const before = Object.fromEntries(files.map(name => [name, changes.hash(fs.readFileSync(path.join(directory, name)))]));
  const index = fs.readFileSync(path.join(f.cwd, '.git', 'index'));
  implementation.reviewInput(f.statePath, MAIN_SETTINGS);
  implementation.status(f.statePath);
  const afterFiles = fs.readdirSync(directory, { recursive: true }).filter(name => fs.statSync(path.join(directory, name)).isFile());
  assert.deepEqual(afterFiles, files);
  const after = Object.fromEntries(afterFiles.map(name => [name, changes.hash(fs.readFileSync(path.join(directory, name)))]));
  assert.deepEqual(after, before);
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git', 'index')), index);
});

test('fresh review input includes the standalone Spec contract and current evidence without previous review material', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  const secret = 'PREVIOUS_REVIEW_ONLY_570829';
  reviewPass(f, 'reviewer-old', { verdict: 'fail', findings: [finding({ evidence: secret })] });
  const packet = preparedReviewInput(f, MAIN_SETTINGS);
  assert.equal(Object.hasOwn(packet, 'original_request'), false);
  assert.equal(Object.hasOwn(packet, 'accepted_decisions'), false);
  assert.equal(packet.spec.text, f.read(f.spec));
  assert.equal(packet.sources[0].path, 'authority.txt');
  assert.equal(packet.verification[0].exit_code, 0);
  const serialized = JSON.stringify(packet);
  assert.doesNotMatch(serialized, /PREVIOUS_REVIEW_ONLY_570829|reviewer-old|review_history|"reviews"|"findings"|"verdict"|"exclusions"/);
});

test('out-of-scope-only fail may complete with recorded Spec/change evidence, while a valid finding blocks', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  const outside = finding({ category: 'out_of_scope', requirement: 'Improve all project documentation.',
    trigger: 'Read existing documentation.', evidence: 'notes.txt:1 has limited detail.',
    change_relation: 'The file predates this run and is absent from its delta.' });
  const excluded = { id: outside.id, reason: 'The Spec contract is limited to the exported value.',
    evidence: 'The Spec contract names the value; changed_paths contains only src/value.js.' };
  const blocked = reviewPass(f, 'reviewer-1', { verdict: 'fail', findings: [outside, finding({ id: 'valid' })], exclusions: [excluded] });
  assert.equal(blocked.accepted, false);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /current independent review/);
  const accepted = reviewPass(f, 'reviewer-2', { verdict: 'fail', findings: [outside], exclusions: [excluded] });
  assert.equal(accepted.verdict, 'fail');
  assert.equal(accepted.accepted, true);
  assert.deepEqual(implementation.complete(f.statePath).excluded_findings, [excluded]);
});

test('malformed findings, exclusions, and verification inputs do not mutate execution state', t => {
  const f = fixture(t);
  const invalidReviews = [
    { verdict: 'fail', findings: [{ ...finding(), trigger: '' }] },
    { verdict: 'fail', findings: [finding(), finding()] },
    { verdict: 'pass', findings: [finding()] },
    { verdict: 'fail', findings: [finding()], exclusions: [{ id: 'missing', reason: 'outside', evidence: 'request' }] },
    { verdict: 'fail', findings: [finding()], exclusions: [{ id: 'finding-1', reason: '', evidence: 'request' }] },
  ];
  for (const input of invalidReviews) rejectsWithoutMutation(f, () => reviewPass(f, 'invalid-reviewer', input), /finding|Exclusions|pass/);
  for (const input of [
    { requirements: ['unknown'] }, { dependencies: ['../outside'] }, { dependencies: [] },
    { cwd: '../outside' }, { command: [] },
  ]) rejectsWithoutMutation(f, () => checkBehavior(f, input), /requirement|relative path|dependencies|cwd|command/);
});

test('Spec changes require explicit authority refresh and invalidate prior checks and reviews', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  reviewPass(f);
  f.write(f.spec, f.read(f.spec).replace('"revision": 1', '"revision": 2'));
  rejectsWithoutMutation(f, () => checkBehavior(f), /Spec changed/);
  rejectsWithoutMutation(f, () => implementation.refreshAuthority(f.statePath, {
    accepted_change: '', requirements: f.input.requirements,
  }), /explicitly accepted/);
  implementation.refreshAuthority(f.statePath, { accepted_change: 'User accepted revision 2.', requirements: f.input.requirements });
  const state = f.state();
  assert.equal(state.authority.spec.revision, 2);
  assert.deepEqual(state.checks, []);
  assert.equal(implementation.status(f.statePath).requirements[0].verified, false);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /unverified/);
  checkBehavior(f);
  rejectsWithoutMutation(f, () => reviewPass(f, 'reviewer-1'), /new reviewer/);
  reviewPass(f, 'reviewer-2');
  implementation.complete(f.statePath);
});

test('authoritative sources cannot silently change before review', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  f.write('authority.txt', 'The requested value is now 999.\n');
  rejectsWithoutMutation(f, () => preparedReviewInput(f, MAIN_SETTINGS), /Authoritative source changed/);
});

test('an ignored authoritative source changing after review still prevents completion', t => {
  const f = fixture(t, { beforeCapture: ({ write }) => write('ignored/authority.txt', 'Value must equal 2.\n'),
    input: { sources: ['ignored/authority.txt'] } });
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  reviewPass(f);
  const fingerprint = implementation.status(f.statePath).fingerprint;
  f.write('ignored/authority.txt', 'Value must equal 999.\n');
  assert.equal(implementation.status(f.statePath).fingerprint, fingerprint);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /Authoritative source changed/);
});

test('completed execution rejects further mutable lifecycle actions', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  reviewPass(f);
  implementation.complete(f.statePath);
  assert.equal(implementation.status(f.statePath).status, 'completed');
  assert.equal(implementation.status(f.statePath).requirements[0].verified, true);
  for (const action of [
    () => checkBehavior(f), () => reviewPass(f, 'reviewer-2'), () => implementation.complete(f.statePath),
    () => implementation.refreshAuthority(f.statePath, { accepted_change: 'New change.', requirements: f.input.requirements }),
  ]) rejectsWithoutMutation(f, action, /already completed/);
});

test('completion updates the effective JSON status token and preserves the entire Spec body', t => {
  const f = fixture(t, { beforeCapture: ({ cwd, write }) => {
    const spec = '.proofline/specs/SPEC-0001/SPEC.md';
    const original = fs.readFileSync(path.join(cwd, spec), 'utf8');
    write(spec, original.replace('"status": "ready"', '"sta\\u0074us": "\\u0072eady"')
      + '\nExample that must remain unchanged: {"status": "ready"}\n');
  } });
  const previous = f.read(f.spec);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  reviewPass(f);
  implementation.complete(f.statePath);
  assert.equal(f.read(f.spec), previous.replace('"\\u0072eady"', '"completed"'));
});

test('concurrent completion leaves both the Spec and execution state completed', async t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  reviewPass(f);
  const script = path.resolve(__dirname, '../skills/start-implementation/scripts/implementation-state.js');
  const complete = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, 'complete', '--state', f.statePath], { windowsHide: true, stdio: 'pipe' });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
  const results = await Promise.all([complete(), complete()]);
  assert.equal(results.filter(result => result.code === 0).length, 1, JSON.stringify(results));
  assert.equal(results.filter(result => result.code === 1).length, 1, JSON.stringify(results));
  assert.equal(f.state().status, 'completed');
  assert.match(f.read(f.spec), /"status": "completed"/);
  assert.equal(fs.existsSync(`${f.statePath}.lock`), false);
});

test('guaranteed fresh current-setting inheritance needs no fabricated model or effort values', t => {
  const inherited = { inherit_current: true };
  const f = fixture(t, { input: { settings: inherited } });
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  const packet = preparedReviewInput(f, inherited);
  assert.deepEqual(packet.reviewer_settings, inherited);
  const script = path.resolve(__dirname, '../skills/start-implementation/scripts/implementation-state.js');
  const output = spawnSync(process.execPath, [script, 'review-input', '--state', f.statePath, '--inherit-current', 'true'],
    { encoding: 'utf8', windowsHide: true });
  assert.equal(output.status, 0, output.stderr);
  assert.deepEqual(JSON.parse(output.stdout).reviewer_settings, inherited);
  const before = fs.readFileSync(f.statePath);
  assert.throws(() => implementation.reviewInput(f.statePath, { ...inherited, model: 'guessed' }), /not both/);
  assert.deepEqual(fs.readFileSync(f.statePath), before);
  reviewPass(f, 'fresh-inherited-reviewer', { main_settings: inherited, reviewer_settings: inherited });
  assert.equal(implementation.complete(f.statePath).status, 'completed');
});

test('snapshot preparation keeps subsequent reviewer reads read-only and free of adjudication history', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  implementation.prepareSnapshot(f.statePath);
  const storage = path.dirname(f.statePath);
  const before = fs.readdirSync(storage, { recursive: true }).sort();
  const journal = fs.readFileSync(f.statePath);
  implementation.reviewInput(f.statePath, MAIN_SETTINGS);
  const summary = implementation.status(f.statePath);
  assert.equal(Object.hasOwn(summary, 'last_review'), false);
  assert.deepEqual(fs.readdirSync(storage, { recursive: true }).sort(), before);
  assert.deepEqual(fs.readFileSync(f.statePath), journal);
});

test('a concurrent evidence update cannot be overwritten by a finishing command', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  const helper = path.resolve(__dirname, '../skills/start-implementation/scripts/implementation-state.js');
  const child = `const api = require(${JSON.stringify(helper)}); const state = ${JSON.stringify(f.statePath)};
    api.evidence(state, { requirements: ['behavior'], kind: 'inspection',
      fingerprint: api.status(state).fingerprint, passed: true, basis: 'Concurrent inspection of the required value.' });`;
  assert.throws(() => checkBehavior(f, { command: [process.execPath, '-e', child] }), /changed concurrently/);
  assert.equal(f.state().checks.length, 1);
  assert.equal(f.state().checks[0].basis, 'Concurrent inspection of the required value.');
  assert.equal(fs.existsSync(`${f.statePath}.lock`), false);
});

test('snapshots and reviewer diff include binary changes, deletion, and additions without staging', t => {
  const f = fixture(t, { beforeCapture: ({ write }) => {
    write('image.bin', Buffer.from([0, 1, 2, 255]));
    write('remove-me.txt', 'baseline untracked text\n');
  } });
  const index = fs.readFileSync(path.join(f.cwd, '.git', 'index'));
  f.write('image.bin', Buffer.from([0, 9, 8, 255]));
  fs.unlinkSync(path.join(f.cwd, 'remove-me.txt'));
  fs.unlinkSync(path.join(f.cwd, 'notes.txt'));
  f.write('added.txt', 'new implementation file\n');
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f);
  const packet = preparedReviewInput(f, MAIN_SETTINGS);
  assert.deepEqual(packet.changed_paths, ['added.txt', 'image.bin', 'notes.txt', 'remove-me.txt', 'src/value.js']);
  assert.match(packet.diff, /GIT binary patch/);
  assert.match(packet.diff, /-baseline untracked text/);
  assert.match(packet.diff, /-original notes/);
  assert.match(packet.diff, /\+new implementation file/);
  assert.deepEqual(fs.readFileSync(path.join(f.cwd, '.git', 'index')), index);
});

test('a root __proto__ file participates in additions, modifications, deletions and completion checks', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f, { dependencies: ['.'] });
  const initial = implementation.status(f.statePath).fingerprint;
  f.write('__proto__', 'new contract data\n');
  const added = implementation.status(f.statePath);
  assert.notEqual(added.fingerprint, initial);
  assert.ok(added.changed_paths.includes('__proto__'));
  assert.equal(added.requirements[0].verified, false);
  checkBehavior(f, { dependencies: ['.'] });
  assert.match(preparedReviewInput(f, MAIN_SETTINGS).diff, /\+new contract data/);
  reviewPass(f);
  f.write('__proto__', 'changed contract data\n');
  const modified = implementation.status(f.statePath);
  assert.notEqual(modified.fingerprint, added.fingerprint);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /remain unverified/);
  fs.unlinkSync(path.join(f.cwd, '__proto__'));
  assert.equal(implementation.status(f.statePath).fingerprint, initial);
  rejectsWithoutMutation(f, () => implementation.complete(f.statePath), /current independent review/);
});

test('dependency directories account for additions and deletions while ignored output does not invalidate checks', t => {
  const f = fixture(t);
  f.write('src/value.js', 'module.exports = 2;\n');
  checkBehavior(f, { dependencies: ['src'] });
  f.write('ignored/report.txt', 'generated output\n');
  assert.equal(implementation.status(f.statePath).requirements[0].verified, true);
  f.write('src/new.js', 'module.exports = 0;\n');
  assert.equal(implementation.status(f.statePath).requirements[0].verified, false);
  checkBehavior(f, { dependencies: ['src'] });
  fs.unlinkSync(path.join(f.cwd, 'src/other.js'));
  assert.equal(implementation.status(f.statePath).requirements[0].verified, false);
});

test('CLI rejects malformed input cleanly and returns nonzero for observed check failure', t => {
  const f = fixture(t);
  const script = path.resolve(__dirname, '../skills/start-implementation/scripts/implementation-state.js');
  const run = (args, input) => spawnSync(process.execPath, [script, ...args], {
    cwd: f.cwd, input, encoding: 'utf8', windowsHide: true,
  });
  const before = fs.readFileSync(f.statePath);
  const malformed = run(['check', '--state', f.statePath], '{');
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /Implementation state:/);
  assert.deepEqual(fs.readFileSync(f.statePath), before);
  const failed = run(['check', '--state', f.statePath], JSON.stringify({ requirements: ['behavior'],
    command: [process.execPath, '-e', 'process.exit(9);'] }));
  assert.equal(failed.status, 1);
  assert.equal(JSON.parse(failed.stdout).exit_code, 9);
  assert.equal(JSON.parse(failed.stdout).passed, false);
  assert.throws(() => implementation.parseArgs(['capture', '--cwd', f.cwd]), /Supply/);
  assert.throws(() => implementation.parseArgs(['status', '--state', f.statePath, '--state', f.statePath]), /Invalid/);
  assert.throws(() => changes.relativePath('src/../notes.txt'), /repository-relative/);
});

test('capture rejects malformed authority and non-ready Spec without altering the repository', t => {
  const f = fixture(t);
  const capture = input => implementation.capture({ cwd: f.cwd, spec: f.spec }, { ...f.input, ...input });
  for (const input of [
    { settings: { model: 'gpt-6-astra' } },
    { requirements: [] }, { requirements: [{ id: 'same', text: 'one' }, { id: 'same', text: 'two' }] },
    { sources: ['../external-authority.txt'] },
  ]) rejectsWithoutMutation(f, () => capture(input), /settings|conditions|requirement|relative path/);
  f.write(f.spec, f.read(f.spec).replace('"status": "ready"', '"status": "draft"'));
  rejectsWithoutMutation(f, () => capture({}), /Spec must be ready/);
});
