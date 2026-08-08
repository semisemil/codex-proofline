#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/state-starter/dashboard/issue-model.js');

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { _: [] };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith('--')) {
      options._.push(value);
      continue;
    }

    const key = value.slice(2).replace(/-/g, '_');
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }

  return { command, options };
}

function resolveIssuesRoot(value) {
  return path.resolve(value || path.join(process.cwd(), '.proofline', 'issues'));
}

function assertIssuesRoot(root) {
  if (!fs.existsSync(root)) {
    fail(`이슈 디렉터리가 없습니다: ${root}`);
  }
  if (!fs.statSync(root).isDirectory()) {
    fail(`이슈 경로가 디렉터리가 아닙니다: ${root}`);
  }
}

function listIssueFiles(root) {
  assertIssuesRoot(root);
  return fs.readdirSync(root)
    .filter(model.isIssueFileName)
    .map((fileName) => path.join(root, fileName))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function readIssue(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return model.parseIssueContent(content, path.basename(filePath));
}

function readAllIssues(root) {
  const issues = [];
  const errors = [];

  for (const filePath of listIssueFiles(root)) {
    try {
      issues.push(readIssue(filePath));
    } catch (error) {
      errors.push(`${path.basename(filePath)}: ${error.message}`);
    }
  }

  return { issues, errors };
}

function findIssue(root, id) {
  const matches = listIssueFiles(root).filter((filePath) => {
    try {
      return readIssue(filePath).id === id;
    } catch {
      return false;
    }
  });

  if (matches.length === 0) {
    fail(`이슈를 찾지 못했습니다: ${id}`);
  }
  if (matches.length > 1) {
    fail(`같은 ID의 이슈 파일이 여러 개입니다: ${id}`);
  }
  return matches[0];
}

function loadJsonFile(filePath, label) {
  if (!filePath) {
    fail(`${label} JSON 파일 경로가 필요합니다.`);
  }
  try {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  } catch (error) {
    fail(`${label} JSON을 읽지 못했습니다: ${error.message}`);
  }
}

function writeV2Issue(filePath, issue) {
  const resolved = path.resolve(filePath);
  if (path.extname(resolved) !== '.json') {
    fail('v2 구조화 갱신은 .json 파일에서만 허용됩니다.');
  }
  fs.writeFileSync(resolved, model.serializeIssue(issue), 'utf8');
}

function commandList(options) {
  const root = resolveIssuesRoot(options.root);
  const { issues, errors } = readAllIssues(root);
  if (errors.length) {
    errors.forEach((error) => console.error(`warning: ${error}`));
  }

  const query = String(options.search || '').toLowerCase();
  const visible = issues
    .filter((issue) => options.all || model.activeStatuses.has(issue.status))
    .filter((issue) => !query || issue.searchText.includes(query))
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));

  visible.forEach((issue) => console.log(`${issue.id}\t${issue.status}\t${issue.title}`));
}

function commandShow(options) {
  const [id] = options._;
  if (!id) {
    fail('show 명령에는 이슈 ID가 필요합니다.');
  }
  const root = resolveIssuesRoot(options.root);
  const issue = readIssue(findIssue(root, id));

  if (options.evidence) {
    const ids = String(options.evidence).split(',').map((value) => value.trim()).filter(Boolean);
    const selected = issue.evidence.filter((item) => ids.includes(item.id));
    if (selected.length !== ids.length) {
      const found = new Set(selected.map((item) => item.id));
      fail(`evidence를 찾지 못했습니다: ${ids.filter((idValue) => !found.has(idValue)).join(', ')}`);
    }
    selected.forEach((item) => {
      console.log(`[${issue.id}#${item.id}] ${item.kind} | ${item.location}`);
      console.log(`observation: ${item.observation}`);
      if (item.observedAt) {
        console.log(`observed_at: ${item.observedAt}`);
      }
    });
    return;
  }

  if (options.events) {
    issue.events.forEach((event) => console.log(`${event.id}\t${event.kind}\t${event.at}\t${event.summary}`));
    return;
  }

  process.stdout.write(model.buildBrief(issue));
}

function validateRelations(issues) {
  const errors = [];
  const ids = new Set(issues.map((issue) => issue.id));
  const parentEdges = new Map();

  for (const issue of issues) {
    if (issue.schemaVersion !== 2) {
      continue;
    }
    for (const relation of issue.relations) {
      if (!ids.has(relation.target)) {
        errors.push(`${issue.id}: 존재하지 않는 관계 대상 ${relation.target}`);
      }
      if (relation.type === 'child_of') {
        parentEdges.set(issue.id, relation.target);
      }
    }
    for (const milestone of issue.milestones) {
      for (const target of milestone.issueRefs) {
        if (!ids.has(target)) {
          errors.push(`${issue.id}#${milestone.id}: 존재하지 않는 마일스톤 이슈 ${target}`);
        }
      }
    }
  }

  for (const start of parentEdges.keys()) {
    const visited = new Set([start]);
    let current = start;
    while (parentEdges.has(current)) {
      current = parentEdges.get(current);
      if (visited.has(current)) {
        errors.push(`${start}: child_of 관계에 순환이 있습니다.`);
        break;
      }
      visited.add(current);
    }
  }

  return errors;
}

function commandValidate(options) {
  if (options._[0]) {
    const filePath = path.resolve(options._[0]);
    const issue = readIssue(filePath);
    if (issue.schemaVersion === 1) {
      console.log(`${issue.id}: legacy Markdown (읽기 호환)`);
      return;
    }
    issue.validation.warnings.forEach((warning) => console.error(`warning: ${warning}`));
    console.log(`${issue.id}: valid v2`);
    return;
  }

  const root = resolveIssuesRoot(options.root);
  const { issues, errors } = readAllIssues(root);
  const relationErrors = validateRelations(issues);
  if (errors.length || relationErrors.length) {
    [...errors, ...relationErrors].forEach((error) => console.error(error));
    process.exit(1);
  }
  issues.flatMap((issue) => issue.validation.warnings.map((warning) => `${issue.id}: ${warning}`))
    .forEach((warning) => console.error(`warning: ${warning}`));
  console.log(`${issues.length}개 이슈가 유효합니다.`);
}

function commandCreate(options) {
  const root = resolveIssuesRoot(options.root);
  assertIssuesRoot(root);
  const issue = loadJsonFile(options.input, '이슈');
  const validation = model.validateV2Issue(issue);
  if (!validation.valid) {
    fail(validation.errors.join('\n'));
  }
  const loaded = readAllIssues(root);
  if (loaded.errors.length) {
    fail(loaded.errors.join('\n'));
  }
  const existing = loaded.issues;
  if (existing.some((item) => item.id === issue.identity.id)) {
    fail(`이미 존재하는 이슈 ID입니다: ${issue.identity.id}`);
  }
  const candidate = model.toViewModel(issue, `${issue.identity.id}.json`);
  const relationErrors = validateRelations([...existing, candidate]);
  if (relationErrors.length) {
    fail(relationErrors.join('\n'));
  }
  const filePath = path.join(root, `${issue.identity.id}.json`);
  if (fs.existsSync(filePath)) {
    fail(`이미 존재하는 파일입니다: ${filePath}`);
  }
  writeV2Issue(filePath, issue);
  validation.warnings.forEach((warning) => console.error(`warning: ${warning}`));
  console.log(filePath);
}

function commandUpdate(options) {
  const [id] = options._;
  if (!id) {
    fail('update 명령에는 이슈 ID가 필요합니다.');
  }
  const root = resolveIssuesRoot(options.root);
  const filePath = findIssue(root, id);
  if (path.extname(filePath) !== '.json') {
    fail('레거시 Markdown은 먼저 검토 기반 마이그레이션이 필요합니다.');
  }
  const operation = loadJsonFile(options.operation, 'operation');
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let result;
  try {
    result = model.applyOperation(raw, operation);
  } catch (error) {
    fail(error.message);
  }
  const loaded = readAllIssues(root);
  if (loaded.errors.length) {
    fail(loaded.errors.join('\n'));
  }
  const candidate = model.toViewModel(result.issue, path.basename(filePath));
  const issues = loaded.issues.map((issue) => issue.id === id ? candidate : issue);
  const relationErrors = validateRelations(issues);
  if (relationErrors.length) {
    fail(relationErrors.join('\n'));
  }
  writeV2Issue(filePath, result.issue);
  result.validation.warnings.forEach((warning) => console.error(`warning: ${warning}`));
  console.log(filePath);
}

function printHelp() {
  console.log(`Proofline Issue Ledger v2

Usage:
  issue-ledger.js list [--root DIR] [--all] [--search TEXT]
  issue-ledger.js show ID [--root DIR] [--evidence E1,E2] [--events]
  issue-ledger.js validate [FILE] [--root DIR]
  issue-ledger.js create --input ISSUE.json [--root DIR]
  issue-ledger.js update ID --operation OPERATION.json [--root DIR]

Update operation types:
  batch, set_state, add_evidence, link_evidence, add_event, set_milestone, add_relation`);
}

function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);

  if (!command || command === 'help' || options.help) {
    printHelp();
  } else if (command === 'list') {
    commandList(options);
  } else if (command === 'show') {
    commandShow(options);
  } else if (command === 'validate') {
    commandValidate(options);
  } else if (command === 'create') {
    commandCreate(options);
  } else if (command === 'update') {
    commandUpdate(options);
  } else {
    fail(`알 수 없는 명령입니다: ${command}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  listIssueFiles,
  readIssue,
  readAllIssues,
  validateRelations,
  main,
};
