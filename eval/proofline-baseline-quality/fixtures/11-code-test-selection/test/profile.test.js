import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayName } from '../src/profile.js';

test('별명이 있으면 별명을 표시한다', () => {
  assert.equal(displayName({ name: '민수', nickname: 'MS' }), 'MS');
});

test('별명이 없으면 이름을 표시한다', () => {
  assert.equal(displayName({ name: '민수' }), '민수');
});

test('빈 별명도 이름으로 대체한다', () => {
  assert.equal(displayName({ name: '민수', nickname: '' }), '민수');
});
