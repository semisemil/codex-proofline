#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RETRYABLE_CODES = new Set(['EACCES', 'EBUSY', 'ENOENT', 'EPERM']);
const RETRY_DELAYS_MS = [50, 150];

// 플러그인 설치나 백신 검사가 겹친 짧은 파일 접근 실패만 재시도한다.
function readFileWithRetry(filePath) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (!RETRYABLE_CODES.has(error.code) || attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_DELAYS_MS[attempt]);
    }
  }
}

// UI가 표준 오류 세부 내용을 숨겨도 다음 실패 원인을 확인할 수 있게 남긴다.
function logFailure(error, skillPath) {
  const logPath = path.join(os.homedir(), '.codex', 'log', 'proofline-hook.log');
  const entry = {
    time: new Date().toISOString(),
    pid: process.pid,
    event: 'SessionStart',
    code: error.code,
    errno: error.errno,
    syscall: error.syscall,
    pluginRoot: path.resolve(__dirname, '..'),
    skillPath,
    message: error.message,
  };

  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (logError) {
    console.error(`Proofline hook log failed: ${logError.message}`);
  }
}

let skillPath;

try {
  skillPath = path.join(
    __dirname,
    '..',
    'skills',
    'proofline-baseline-quality',
    'SKILL.md',
  );
  const skill = readFileWithRetry(skillPath).replace(/^\uFEFF/, '');
  const body = skill
    .replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
    .replace(/^\r?\n/, '');

  // 조건부 참조를 설치 위치와 무관하게 읽을 수 있도록 절대 경로로 바꾼다.
  const resolvedBody = body.replace(/`references\/([^`]+)`/g, (_match, reference) => (
    `\`${path.join(path.dirname(skillPath), 'references', reference)}\``
  ));

  process.stdout.write(resolvedBody);
} catch (error) {
  logFailure(error, skillPath);
  console.error(`Proofline hook failed: ${error.message}`);
  process.exit(1);
}
