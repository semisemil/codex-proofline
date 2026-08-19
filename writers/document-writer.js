#!/usr/bin/env node

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const {
  MAX_RECORD_BYTES,
  isInside,
  parseFrontmatter,
  parsePlanMetadata,
  parseSpecMetadata,
} = require('../dashboard/records/record-parser.js');
const { registerProject, rootKey } = require('../dashboard/registry.js');

const PLAN_PATH = /^\.proofline\/plan\/(PLAN-\d{4,})-([^/\\]+)\/PLAN\.md$/;
const SPEC_PATH = /^\.proofline\/specs\/(SPEC-\d{4,})-([^/\\]+)\/SPEC\.md$/;
const CHANGE_KINDS = new Set(['major', 'operational']);

class DocumentWriterError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'DocumentWriterError';
    this.code = code;
  }
}

function writerError(code, message, cause) {
  return new DocumentWriterError(code, message, cause);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command !== 'write') {
    throw writerError(
      'invalid-command',
      'Usage: document-writer.js write --kind plan|spec --project-root DIR --relative-path PATH [--change-kind major|operational]'
    );
  }

  const options = {};
  const allowed = new Set(['kind', 'project_root', 'relative_path', 'change_kind']);
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith('--')) {
      throw writerError('invalid-argument', `알 수 없는 인수입니다: ${argument}`);
    }
    const key = argument.slice(2).replace(/-/g, '_');
    if (!allowed.has(key)) {
      throw writerError('invalid-argument', `알 수 없는 옵션입니다: ${argument}`);
    }
    if (Object.hasOwn(options, key)) {
      throw writerError('invalid-argument', `옵션이 중복되었습니다: ${argument}`);
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw writerError('invalid-argument', `${argument} 값이 필요합니다.`);
    }
    options[key] = value;
    index += 1;
  }

  if (!new Set(['plan', 'spec']).has(options.kind)) {
    throw writerError('document-kind-invalid', '--kind는 plan 또는 spec이어야 합니다.');
  }
  if (typeof options.project_root !== 'string' || !path.isAbsolute(options.project_root)) {
    throw writerError('project-root-invalid', '--project-root에는 절대 경로가 필요합니다.');
  }
  if (typeof options.relative_path !== 'string' || options.relative_path.length === 0) {
    throw writerError('document-path-invalid', '--relative-path 값이 필요합니다.');
  }
  if (options.change_kind !== undefined && !CHANGE_KINDS.has(options.change_kind)) {
    throw writerError('change-kind-invalid', '--change-kind는 major 또는 operational이어야 합니다.');
  }
  return options;
}

function canonicalProjectRoot(projectRoot) {
  const absolute = path.resolve(projectRoot);
  try {
    const resolve = fs.realpathSync.native || fs.realpathSync;
    const canonical = path.normalize(resolve(absolute));
    if (!fs.statSync(canonical).isDirectory()) {
      throw new Error('디렉터리가 아닙니다.');
    }
    return canonical;
  } catch (error) {
    throw writerError('project-root-invalid', `존재하는 프로젝트 디렉터리가 아닙니다: ${absolute}`, error);
  }
}

function decodeContent(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw writerError('document-content-invalid', 'stdin에 UTF-8 Markdown 원문이 필요합니다.');
  }
  if (buffer.length > MAX_RECORD_BYTES) {
    throw writerError('document-too-large', '문서가 2 MiB 한도를 초과합니다.');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    throw writerError('document-invalid-utf8', '문서가 올바른 UTF-8이 아닙니다.', error);
  }
}

function resolveTarget(root, kind, relativePath) {
  if (relativePath.includes('\0') || relativePath.includes('\\')) {
    throw writerError('document-path-invalid', '문서 경로는 프로젝트 상대 POSIX 경로여야 합니다.');
  }
  const match = (kind === 'plan' ? PLAN_PATH : SPEC_PATH).exec(relativePath);
  if (!match || match[2] === '.' || match[2] === '..') {
    throw writerError('document-path-invalid', `${kind} 문서 경로가 올바르지 않습니다: ${relativePath}`);
  }
  const target = path.join(root, ...relativePath.split('/'));
  if (!isInside(root, target)) {
    throw writerError('document-path-outside-project', '프로젝트 밖의 문서는 쓸 수 없습니다.');
  }
  return { expectedId: match[1], target };
}

function metadataFor(kind, content, expectedId) {
  let metadata;
  try {
    const frontmatter = parseFrontmatter(content);
    metadata = kind === 'plan'
      ? parsePlanMetadata(frontmatter.metadataText)
      : parseSpecMetadata(frontmatter.metadataText);
  } catch (error) {
    throw writerError(error.code || 'document-metadata-invalid', error.message, error);
  }
  if (metadata.id !== expectedId) {
    throw writerError('document-id-mismatch', '문서 경로의 ID와 frontmatter ID가 일치하지 않습니다.');
  }
  return metadata;
}

function statPath(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function assertSafeExistingPath(root, filePath, expectedType) {
  const stat = statPath(filePath);
  if (!stat) {
    return null;
  }
  if (stat.isSymbolicLink()) {
    throw writerError('document-path-link', '심볼릭 링크 또는 junction 경로에는 쓸 수 없습니다.');
  }
  if ((expectedType === 'directory' && !stat.isDirectory())
      || (expectedType === 'file' && !stat.isFile())) {
    throw writerError('document-path-type-invalid', `문서 ${expectedType} 경로 형식이 올바르지 않습니다.`);
  }
  const resolve = fs.realpathSync.native || fs.realpathSync;
  const canonical = path.normalize(resolve(filePath));
  if (!isInside(root, canonical) || rootKey(canonical) !== rootKey(path.normalize(filePath))) {
    throw writerError('document-path-link', '프로젝트 밖을 가리키는 경로에는 쓸 수 없습니다.');
  }
  return stat;
}

function ensureSafeDirectory(root, directory) {
  const relative = path.relative(root, directory);
  if (!isInside(root, directory) || path.isAbsolute(relative)) {
    throw writerError('document-path-outside-project', '프로젝트 밖의 문서 디렉터리는 만들 수 없습니다.');
  }
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const existing = assertSafeExistingPath(root, current, 'directory');
    if (!existing) {
      try {
        fs.mkdirSync(current);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
      assertSafeExistingPath(root, current, 'directory');
    }
  }
}

function readExisting(root, filePath) {
  const stat = assertSafeExistingPath(root, filePath, 'file');
  if (!stat) {
    return null;
  }
  if (stat.size > MAX_RECORD_BYTES) {
    throw writerError('document-too-large', '기존 문서가 2 MiB 한도를 초과합니다.');
  }
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    throw writerError('document-read-failed', `기존 문서를 읽지 못했습니다: ${error.message}`, error);
  }
}

function temporaryPathFor(target) {
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
}

function writeTemporary(target, buffer) {
  const temporary = temporaryPathFor(target);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx');
    fs.writeFileSync(descriptor, buffer);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    return temporary;
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve original error */ }
    }
    try { fs.unlinkSync(temporary); } catch { /* preserve original error */ }
    throw error;
  }
}

function installFile(root, target, buffer, existing) {
  ensureSafeDirectory(root, path.dirname(target));
  const temporary = writeTemporary(target, buffer);
  try {
    if (existing === null) {
      fs.linkSync(temporary, target);
      fs.unlinkSync(temporary);
      return;
    }

    const latest = readExisting(root, target);
    if (!latest || !latest.equals(existing)) {
      throw writerError('document-changed', '문서가 읽은 뒤 변경되어 덮어쓰지 않았습니다.');
    }
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* preserve original error */ }
    throw error;
  }
}

function validateTransition(kind, existingMetadata, nextMetadata, changeKind) {
  if (!existingMetadata) {
    if (changeKind !== undefined) {
      throw writerError('change-kind-invalid', '새 문서에는 --change-kind를 사용하지 않습니다.');
    }
    if (kind === 'spec' && nextMetadata.revision !== 1) {
      throw writerError('spec-revision-invalid', '새 Spec revision은 1이어야 합니다.');
    }
    return;
  }

  if (existingMetadata.id !== nextMetadata.id || existingMetadata.title !== nextMetadata.title) {
    throw writerError('document-identity-changed', '기존 문서의 ID와 title은 변경할 수 없습니다.');
  }
  if (kind === 'plan') {
    if (changeKind !== undefined) {
      throw writerError('change-kind-invalid', 'Plan에는 --change-kind를 사용하지 않습니다.');
    }
    return;
  }
  if (!CHANGE_KINDS.has(changeKind)) {
    throw writerError('change-kind-required', 'Spec 변경에는 --change-kind major 또는 operational이 필요합니다.');
  }
  const expectedRevision = changeKind === 'major'
    ? existingMetadata.revision + 1
    : existingMetadata.revision;
  if (nextMetadata.revision !== expectedRevision) {
    throw writerError(
      'spec-revision-invalid',
      `${changeKind} Spec revision은 ${expectedRevision}이어야 합니다.`
    );
  }
}

function ensureSnapshot(root, target, existing, revision) {
  const relativePath = `.proofline/specs/${path.basename(path.dirname(target))}/revisions/REV-${revision}.md`;
  const snapshot = path.join(root, ...relativePath.split('/'));
  const current = readExisting(root, snapshot);
  if (current) {
    if (!current.equals(existing)) {
      throw writerError('snapshot-conflict', `기존 snapshot 내용이 다릅니다: ${relativePath}`);
    }
    return { status: 'reused', path: relativePath };
  }
  installFile(root, snapshot, existing, null);
  return { status: 'created', path: relativePath };
}

function registrationResult(projectRoot) {
  try {
    const result = registerProject(projectRoot);
    return {
      status: result.status,
      project: result.project,
      registry_path: result.registryPath,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: {
        code: error.code || 'registration-failed',
        message: error.message,
      },
    };
  }
}

function writeDocument(options, sourceBuffer) {
  const projectRoot = canonicalProjectRoot(options.project_root);
  const content = decodeContent(sourceBuffer);
  const { expectedId, target } = resolveTarget(projectRoot, options.kind, options.relative_path);
  const nextMetadata = metadataFor(options.kind, content, expectedId);
  const existing = readExisting(projectRoot, target);

  if (existing && existing.equals(sourceBuffer)) {
    return {
      schema_version: 1,
      write: {
        status: 'no-op',
        kind: options.kind,
        id: nextMetadata.id,
        title: nextMetadata.title,
        path: options.relative_path,
        revision: options.kind === 'spec' ? nextMetadata.revision : undefined,
        snapshot: null,
      },
      registration: null,
    };
  }

  const existingMetadata = existing
    ? metadataFor(options.kind, decodeContent(existing), expectedId)
    : null;
  validateTransition(options.kind, existingMetadata, nextMetadata, options.change_kind);

  let snapshot = null;
  if (options.kind === 'spec' && existing && options.change_kind === 'major') {
    snapshot = ensureSnapshot(projectRoot, target, existing, existingMetadata.revision);
  }

  try {
    installFile(projectRoot, target, sourceBuffer, existing);
  } catch (error) {
    if (error instanceof DocumentWriterError) {
      throw error;
    }
    throw writerError('document-write-failed', `문서를 쓰지 못했습니다: ${error.message}`, error);
  }

  return {
    schema_version: 1,
    write: {
      status: existing ? 'updated' : 'created',
      kind: options.kind,
      id: nextMetadata.id,
      title: nextMetadata.title,
      path: options.relative_path,
      revision: options.kind === 'spec' ? nextMetadata.revision : undefined,
      snapshot,
    },
    registration: registrationResult(projectRoot),
  };
}

function formatError(error) {
  return {
    error: {
      code: error.code || 'document-write-failed',
      message: error.message,
    },
  };
}

function main(argv = process.argv.slice(2), sourceBuffer) {
  try {
    const options = parseArgs(argv);
    const input = sourceBuffer === undefined ? fs.readFileSync(0) : sourceBuffer;
    const result = writeDocument(options, input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result;
  } catch (error) {
    process.stderr.write(`${JSON.stringify(formatError(error))}\n`);
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DocumentWriterError,
  main,
  parseArgs,
  writeDocument,
};
