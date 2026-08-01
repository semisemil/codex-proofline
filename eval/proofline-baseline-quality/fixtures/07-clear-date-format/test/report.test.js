import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCreatedAt as webDate } from '../src/web-report.js';
import { formatCreatedAt as emailDate } from '../src/email-report.js';

test('웹 보고서는 미국식 날짜를 사용한다', () => {
  assert.equal(webDate(new Date(2026, 7, 2)), '8/2/2026');
});

test('이메일 보고서는 한국어 날짜를 사용한다', () => {
  assert.equal(emailDate(new Date(2026, 7, 2)), '2026년 8월 2일');
  assert.equal(emailDate(new Date(2027, 10, 19)), '2027년 11월 19일');
  assert.equal(emailDate(new Date(2030, 0, 10)), '2030년 1월 10일');
});
