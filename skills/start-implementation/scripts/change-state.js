'use strict';

// Working-tree snapshots use external blobs, never the repository's index or refs.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnGit, canonical } = require('../../../lib/git-policy.js');

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function git(cwd, args) {
  const result = spawnGit(cwd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Git read failed');
  return result.stdout;
}
function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || /[\0\r\n]/.test(value)
    || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)
    || path.posix.normalize(value) !== value || value === '..' || value.startsWith('../')) {
    throw new Error(`Expected a repository-relative path: ${value}`);
  }
  return value;
}
function repository(cwd) {
  const root = fs.realpathSync(cwd);
  const actual = fs.realpathSync(git(root, ['rev-parse', '--show-toplevel']).trim());
  if (canonical(root) !== canonical(actual)) throw new Error('cwd must be the repository root');
  return root;
}
function captureFiles(cwd, blobDir = null, prefix = '', entries = Object.create(null)) {
  const names = [...new Set(git(cwd, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort();
  for (const name of names) {
    relativePath(name);
    const target = path.join(cwd, name);
    let stat;
    try { stat = fs.lstatSync(target); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const key = prefix + name;
    if (stat.isDirectory()) {
      // Git lists a submodule as a directory. Inspect it without altering it.
      const head = git(target, ['rev-parse', 'HEAD']).trim();
      entries[key] = { kind: 'gitlink', hash: head, mode: 0 };
      captureFiles(target, blobDir, `${key}/`, entries);
      continue;
    }
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error(`Unsupported file kind: ${key}`);
    const bytes = stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(target)) : fs.readFileSync(target);
    const digest = hash(bytes);
    entries[key] = { kind: stat.isSymbolicLink() ? 'symlink' : 'file', hash: digest, mode: stat.mode & 0o111 };
    if (blobDir) {
      const blob = path.join(blobDir, digest);
      if (!fs.existsSync(blob)) fs.writeFileSync(blob, bytes, { flag: 'wx' });
    }
  }
  return entries;
}
function snapshot(cwd, blobDir = null) {
  const entries = captureFiles(cwd, blobDir);
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, 'en')));
  return { fingerprint: hash(JSON.stringify(sorted)), entries: sorted };
}
function entry(snapshotValue, key) {
  return Object.hasOwn(snapshotValue.entries, key) ? snapshotValue.entries[key] : undefined;
}
function changedPaths(before, after) {
  return [...new Set([...Object.keys(before.entries), ...Object.keys(after.entries)])].sort()
    .filter(key => JSON.stringify(entry(before, key)) !== JSON.stringify(entry(after, key)));
}
function relevantFingerprint(snapshotValue, dependencies = ['.']) {
  for (const dependency of dependencies) relativePath(dependency);
  return hash(JSON.stringify(Object.fromEntries(Object.entries(snapshotValue.entries).filter(([key]) =>
    dependencies.some(dependency => dependency === '.' || key === dependency || key.startsWith(`${dependency}/`))))));
}
function diff(cwd, storage, before, after) {
  const changes = changedPaths(before, after);
  const output = [];
  for (const name of changes) {
    const oldEntry = entry(before, name);
    const newEntry = entry(after, name);
    output.push(`\nPath: ${name}\nBefore: ${JSON.stringify(oldEntry || null)}\nAfter: ${JSON.stringify(newEntry || null)}\n`);
    if (oldEntry?.kind === 'gitlink' || newEntry?.kind === 'gitlink') continue;
    const oldFile = oldEntry ? path.join(storage, 'blobs', oldEntry.hash) : path.join(storage, 'empty');
    const newFile = newEntry ? path.join(storage, 'blobs', newEntry.hash) : path.join(storage, 'empty');
    if (!fs.existsSync(oldFile) || !fs.existsSync(newFile)) throw new Error('Run snapshot as the main implementer before preparing review input or diff');
    const result = spawnGit(cwd, ['diff', '--no-index', '--no-ext-diff', '--no-textconv', '--binary', '--', oldFile, newFile],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error || ![0, 1].includes(result.status)) throw new Error(result.error?.message || result.stderr || 'Diff read failed');
    output.push(result.stdout);
  }
  return output.join('');
}
module.exports = { hash, git, relativePath, repository, snapshot, changedPaths, relevantFingerprint, diff };
