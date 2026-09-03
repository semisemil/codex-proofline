'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  gitEnvironment,
  safeDirectoryArgs,
} = require('../lib/git-policy.js');

test('safe.directory is exact and process-local', () => {
  const root = path.resolve('fixture repo');
  assert.deepEqual(safeDirectoryArgs([root], ['status', '--short']), [
    '-c', `safe.directory=${root}`, 'status', '--short',
  ]);
  const env = gitEnvironment([root], { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'x', GIT_CONFIG_VALUE_0: 'y' });
  assert.equal(env.GIT_CONFIG_COUNT, '2');
  assert.equal(env.GIT_CONFIG_KEY_0, 'x');
  assert.equal(env.GIT_CONFIG_VALUE_0, 'y');
  assert.equal(env.GIT_CONFIG_KEY_1, 'safe.directory');
  assert.equal(env.GIT_CONFIG_VALUE_1, root);
});

test('safe.directory roots are normalized and deduplicated', () => {
  const root = path.resolve('fixture');
  const args = safeDirectoryArgs([root, path.join(root, '.')], ['rev-parse', 'HEAD']);
  assert.equal(args.filter((value) => value.startsWith('safe.directory=')).length, 1);
});
