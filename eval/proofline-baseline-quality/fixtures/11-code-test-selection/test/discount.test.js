import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discountRate } from '../src/discount.js';

test('일반 주문 금액의 할인율을 계산한다', () => {
  assert.equal(discountRate(40000), 0);
  assert.equal(discountRate(75000), 0.05);
  assert.equal(discountRate(120000), 0.1);
});
