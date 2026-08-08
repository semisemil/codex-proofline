#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 잘못된 버전은 오래된 대시보드로 취급하되, 번들 버전 오류는 호출자에게 알린다.
function readVersion(filePath) {
  const value = fs.readFileSync(filePath, 'utf8').trim();

  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    const error = new Error(`Invalid dashboard version: ${filePath}`);
    error.code = 'EINVAL';
    throw error;
  }

  return Number(value);
}

// 복사 도중 실패하면 다음 시작에서 다시 시도하도록 VERSION을 마지막에 쓴다.
function copyDashboard(source, target) {
  fs.mkdirSync(target, { recursive: true });

  for (const fileName of fs.readdirSync(source)) {
    if (fileName === 'VERSION') {
      continue;
    }

    fs.copyFileSync(path.join(source, fileName), path.join(target, fileName));
  }

  fs.copyFileSync(path.join(source, 'VERSION'), path.join(target, 'VERSION'));
}

// UI에서 표준 오류가 접혀도 실패 원인과 대상 경로를 확인할 수 있게 남긴다.
function logFailure(error, cwd, bundledDashboard, projectDashboard) {
  const logPath = path.join(os.homedir(), '.codex', 'log', 'proofline-hook.log');
  const entry = {
    time: new Date().toISOString(),
    pid: process.pid,
    event: 'SessionStart',
    hook: 'refresh-dashboard',
    code: error.code,
    cwd,
    bundledDashboard,
    projectDashboard,
    message: error.message,
  };

  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (logError) {
    console.error(`Proofline hook log failed: ${logError.message}`);
  }
}

let cwd;
let bundledDashboard;
let projectDashboard;

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  cwd = input.cwd;

  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) {
    const error = new Error('SessionStart hook input requires an absolute cwd.');
    error.code = 'EINVAL';
    throw error;
  }

  const prooflineRoot = path.join(cwd, '.proofline');

  // 원장이 없는 프로젝트에는 파일을 만들지 않는다.
  if (!fs.existsSync(prooflineRoot)) {
    process.exit(0);
  }

  bundledDashboard = path.join(
    __dirname,
    '..',
    'skills',
    'issue-ledger',
    'assets',
    'state-starter',
    'dashboard',
  );
  projectDashboard = path.join(prooflineRoot, 'dashboard');
  const bundledVersion = readVersion(path.join(bundledDashboard, 'VERSION'));
  let projectVersion = -1;

  try {
    projectVersion = readVersion(path.join(projectDashboard, 'VERSION'));
  } catch (error) {
    if (!['ENOENT', 'EINVAL'].includes(error.code)) {
      throw error;
    }
  }

  if (projectVersion < bundledVersion) {
    copyDashboard(bundledDashboard, projectDashboard);
  }
} catch (error) {
  logFailure(error, cwd, bundledDashboard, projectDashboard);
  console.error(`Proofline dashboard hook failed: ${error.message}`);
  process.exit(1);
}
