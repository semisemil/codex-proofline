import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugify } from '../src/slug.js';

test('공백을 하이픈으로 바꾼다', () => {
  assert.equal(slugify(' Hello World '), 'hello-world');
});

test('연속 공백도 하이픈 하나로 바꾼다', () => {
  assert.equal(slugify('Hello   New World'), 'hello-new-world');
});

test('이미 소문자인 한 단어는 그대로 둔다', () => {
  assert.equal(slugify('ready'), 'ready');
});
