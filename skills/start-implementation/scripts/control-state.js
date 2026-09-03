#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  parseGateDocument,
  renderGateDocument,
} = require('../../spec-slice/scripts/run-gates.js');
const { inspectExecutionTree } = require('../../spec-slice/scripts/inspect-execution-tree.js');

class ControlStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ControlStateError';
  }
}

function fail(message) {
  throw new ControlStateError(message);
}

function normalizeRelative(value) {
  return value.replaceAll('\\', '/');
}

function specRelativePath(checkout, specDirectory) {
  const relative = normalizeRelative(path.relative(path.resolve(checkout), path.resolve(specDirectory)));
  if (!/^\.proofline\/specs\/[^/]+$/.test(relative)) {
    fail('active Spec must be one direct directory under .proofline/specs');
  }
  return relative;
}

function listFiles(root) {
  const result = [];
  function visit(directory, prefix) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch (error) {
      fail(`${directory}: cannot read control directory: ${error.message}`);
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) fail(`${relative}: symbolic links are not allowed in an active Spec`);
      if (stat.isDirectory()) visit(absolute, relative);
      else if (stat.isFile()) result.push(relative);
      else fail(`${relative}: special files are not allowed in an active Spec`);
    }
  }
  visit(path.resolve(root), '');
  return result;
}

function hashParts(parts) {
  const hash = crypto.createHash('sha256');
  for (const [label, value] of parts) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
    hash.update(`${label.length}:${label}:${data.length}:`);
    hash.update(data);
  }
  return `sha256:${hash.digest('hex')}`;
}

function parseFrontmatter(content, filePath) {
  const source = content.replace(/^\uFEFF/, '');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) fail(`${filePath}: JSON frontmatter is missing`);
  let metadata;
  try {
    metadata = JSON.parse(match[1]);
  } catch (error) {
    fail(`${filePath}: invalid JSON frontmatter: ${error.message}`);
  }
  return { metadata, body: source.slice(match[0].length).replaceAll('\r\n', '\n') };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function immutableFile(relative, content, absolute) {
  if (relative === 'SPEC.md' || /^slices\/[^/]+\.md$/.test(relative)) {
    const parsed = parseFrontmatter(content.toString('utf8'), absolute);
    const metadata = { ...parsed.metadata };
    delete metadata.status;
    return Buffer.from(JSON.stringify({ metadata: stable(metadata), body: parsed.body }), 'utf8');
  }
  if (/^gates\/[^/]+\.md$/.test(relative)) {
    const parsed = parseGateDocument(content.toString('utf8'), absolute);
    return Buffer.from(JSON.stringify(stable({
      scope: parsed.scope,
      scopeLine: parsed.scopeLine,
      gates: parsed.gates.map((gate) => ({
        id: gate.id,
        outcome: gate.outcome,
        check: gate.check,
        expect: gate.expect,
        requires: gate.requires,
      })),
    })), 'utf8');
  }
  return content;
}

function controlManifest(specDirectory) {
  const root = path.resolve(specDirectory);
  inspectExecutionTree(root);
  const files = listFiles(root);
  const fullParts = [];
  const immutableParts = [];
  for (const relative of files) {
    const absolute = path.join(root, ...relative.split('/'));
    const content = fs.readFileSync(absolute);
    fullParts.push([`path:${relative}`, relative], [`content:${relative}`, content]);
    immutableParts.push(
      [`path:${relative}`, relative],
      [`content:${relative}`, immutableFile(relative, content, absolute)],
    );
  }
  const tree = inspectExecutionTree(root);
  return {
    spec_id: tree.spec_id,
    revision: tree.spec_revision,
    files,
    full_fingerprint: hashParts(fullParts),
    immutable_fingerprint: hashParts(immutableParts),
  };
}

function copyActiveSpec(sourceSpec, destinationSpec, expectedFingerprint) {
  const source = path.resolve(sourceSpec);
  const destination = path.resolve(destinationSpec);
  const sourceManifest = controlManifest(source);
  if (sourceManifest.full_fingerprint !== expectedFingerprint) {
    fail(`source Spec changed: expected ${expectedFingerprint}, actual ${sourceManifest.full_fingerprint}`);
  }
  if (fs.existsSync(destination)) {
    const destinationManifest = controlManifest(destination);
    if (destinationManifest.full_fingerprint !== expectedFingerprint) {
      fail('Worktree-local Spec already exists with different content');
    }
    return destinationManifest;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
    const copied = controlManifest(destination);
    if (copied.full_fingerprint !== expectedFingerprint) {
      fail('Worktree-local Spec fingerprint differs after copy');
    }
    return copied;
  } catch (error) {
    try {
      fs.rmSync(destination, { recursive: true, force: true });
    } catch (cleanupError) {
      fail(`cannot remove partial Worktree-local Spec: ${cleanupError.message}`);
    }
    if (error instanceof ControlStateError) throw error;
    fail(`cannot copy active Spec: ${error.message}`);
  }
}

function verifyGateWritable(specDirectory) {
  const gateDirectory = path.join(path.resolve(specDirectory), 'gates');
  const files = listFiles(path.resolve(specDirectory))
    .filter((relative) => /^gates\/[^/]+\.md$/.test(relative));
  if (files.length === 0) fail(`${gateDirectory}: no Gate files found`);
  for (const relative of files) {
    const filePath = path.join(specDirectory, ...relative.split('/'));
    const content = fs.readFileSync(filePath);
    try {
      fs.writeFileSync(filePath, content);
    } catch (error) {
      fail(`${filePath}: Gate file is not writable: ${error.message}`);
    }
    if (!fs.readFileSync(filePath).equals(content)) fail(`${filePath}: Gate write verification changed content`);
  }
}

function replaceFrontmatterStatus(content, sourceStatus, filePath) {
  const parsed = parseFrontmatter(content, filePath);
  const current = parsed.metadata.status;
  const next = current === 'completed' || sourceStatus === 'completed' ? 'completed' : current;
  if (current !== sourceStatus && next !== 'completed') {
    fail(`${filePath}: incompatible status values ${current} and ${sourceStatus}`);
  }
  if (current === next) return content;
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const match = content.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  parsed.metadata.status = next;
  return match[1] + JSON.stringify(parsed.metadata, null, 2).replaceAll('\n', eol)
    + match[3] + content.slice(match[0].length);
}

function gateStateContent(destinationContent, sourceContent, destinationPath, sourcePath) {
  const destination = parseGateDocument(destinationContent, destinationPath);
  const source = parseGateDocument(sourceContent, sourcePath);
  const sourceById = new Map(source.gates.map((gate) => [gate.id, gate]));
  for (const gate of destination.gates) {
    const candidate = sourceById.get(gate.id);
    const next = candidate.checked || candidate.abandonedReason ? candidate : gate;
    destination.lines[gate.markerLine].text = destination.lines[gate.markerLine].text.replace(
      /^- \[[ xX]\]/,
      next.checked ? '- [x]' : '- [ ]',
    );
    destination.lines[gate.evidenceLine].text = `  EVIDENCE: ${next.evidence}`;
  }
  let rendered = renderGateDocument(destination);
  const eol = rendered.includes('\r\n') ? '\r\n' : '\n';
  const hadFinalEol = /(?:\r\n|\n|\r)$/.test(rendered);
  const lines = rendered.split(/\r\n|\n|\r/).filter((line) => !/^ABANDON: G\d+ /.test(line));
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  for (const gate of source.gates) {
    if (gate.abandonedReason) lines.push(`ABANDON: ${gate.id} ${gate.abandonedReason}`);
  }
  rendered = lines.join(eol);
  if (hadFinalEol) rendered += eol;
  return rendered;
}

function planControlMerge(sourceSpec, destinationSpec, expectedDestinationFingerprint) {
  const sourceRoot = path.resolve(sourceSpec);
  const destinationRoot = path.resolve(destinationSpec);
  const source = controlManifest(sourceRoot);
  const destination = controlManifest(destinationRoot);
  if (destination.full_fingerprint !== expectedDestinationFingerprint) {
    fail(`original Spec changed: expected ${expectedDestinationFingerprint}, actual ${destination.full_fingerprint}`);
  }
  if (JSON.stringify(source.files) !== JSON.stringify(destination.files)) {
    fail('Worktree and original Spec file sets differ');
  }
  if (source.immutable_fingerprint !== destination.immutable_fingerprint) {
    fail('immutable Spec, Slice, or Gate definitions changed during execution');
  }
  const writes = [];
  for (const relative of destination.files) {
    if (relative !== 'SPEC.md' && !/^slices\/[^/]+\.md$/.test(relative)
      && !/^gates\/[^/]+\.md$/.test(relative)) continue;
    const sourcePath = path.join(sourceRoot, ...relative.split('/'));
    const destinationPath = path.join(destinationRoot, ...relative.split('/'));
    const before = fs.readFileSync(destinationPath, 'utf8');
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    let after;
    if (/^gates\//.test(relative)) {
      after = gateStateContent(before, sourceContent, destinationPath, sourcePath);
    } else {
      after = replaceFrontmatterStatus(
        before,
        parseFrontmatter(sourceContent, sourcePath).metadata.status,
        destinationPath,
      );
    }
    if (after !== before) writes.push({ path: destinationPath, before, after });
  }
  return { source, destination, writes };
}

function commitControlMerge(plan) {
  const written = [];
  try {
    for (const item of plan.writes) {
      fs.writeFileSync(item.path, item.after, 'utf8');
      written.push(item);
    }
  } catch (error) {
    for (const item of written.reverse()) fs.writeFileSync(item.path, item.before, 'utf8');
    fail(`cannot merge control state: ${error.message}`);
  }
  return () => {
    for (const item of [...plan.writes].reverse()) fs.writeFileSync(item.path, item.before, 'utf8');
  };
}

module.exports = {
  commitControlMerge,
  ControlStateError,
  controlManifest,
  copyActiveSpec,
  planControlMerge,
  specRelativePath,
  verifyGateWritable,
};
