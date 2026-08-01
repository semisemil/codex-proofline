import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCreatedAt as webDate } from '../src/web-report.js';
import { formatCreatedAt as emailDate } from '../src/email-report.js';

const sample = new Date('2026-08-02T00:00:00.000Z');

test('웹 보고서는 미국식 날짜를 사용한다', () => {
  assert.equal(webDate(sample), '8/2/2026');
});

test('이메일 보고서는 ISO 날짜를 사용한다', () => {
  assert.equal(emailDate(sample), '2026-08-02');
});
