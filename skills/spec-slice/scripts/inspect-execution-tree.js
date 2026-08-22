#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  GateParseError,
  gateStatus,
  parseGateFile,
} = require('./run-gates.js');

const NODE_FIELDS = [
  'schema_version',
  'id',
  'spec_id',
  'spec_revision',
  'parent_id',
  'title',
  'status',
  'blocked_by',
  'run_after',
  'write_scope',
];
const NODE_ID = /^SLICE-\d{2}(?:\.\d{2})*$/;
const SPEC_ID = /^SPEC-\d+$/;
const NODE_BODY_HEADINGS = ['Outcome', 'Spec sections', 'Contract', 'Context'];

class ExecutionTreeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExecutionTreeError';
  }
}

function fail(message) {
  throw new ExecutionTreeError(message);
}

function stripFencedCode(content) {
  let fence = null;
  return content.split(/\r?\n/).map((line) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      return '';
    }
    if (fence && marker && marker[1][0] === fence.character
      && marker[1].length >= fence.length && marker[2].trim() === '') {
      fence = null;
      return '';
    }
    return fence ? '' : line;
  }).join('\n');
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    fail(`${filePath}: cannot read file: ${error.message}`);
  }
}

function parseJsonFrontmatter(filePath) {
  const content = readText(filePath);
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const label = path.basename(filePath);
  if (!match) fail(`${label}: JSON frontmatter is missing`);

  let metadata;
  try {
    metadata = JSON.parse(match[1]);
  } catch (error) {
    fail(`${label}: invalid JSON frontmatter: ${error.message}`);
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    fail(`${label}: JSON frontmatter must be an object`);
  }

  return {
    filePath,
    fileName: label,
    metadata,
    body: content.slice(match[0].length).trim(),
  };
}

function ensureSpecDirectory(specDirectory) {
  const root = path.resolve(specDirectory);
  let stat;
  try {
    stat = fs.statSync(root);
  } catch (error) {
    fail(`spec directory does not exist: ${root}`);
  }
  if (!stat.isDirectory()) fail(`spec directory is not a directory: ${root}`);
  return root;
}

function listDirectMarkdown(directory) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    fail(`${directory}: cannot read directory: ${error.message}`);
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => ({ name: entry.name, filePath: path.join(directory, entry.name) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bodySection(body, heading, owner, required) {
  const lines = stripFencedCode(body).split('\n');
  const headingPattern = new RegExp(`^##[ \\t]+${escapeRegex(heading)}[ \\t]*$`);
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (headingPattern.test(lines[index])) starts.push(index);
  }
  if (starts.length > 1) fail(`${owner}: duplicate ${heading} section`);
  if (starts.length === 0) {
    if (required) fail(`${owner}: ${heading} section is required`);
    return null;
  }

  let end = lines.length;
  for (let index = starts[0] + 1; index < lines.length; index += 1) {
    if (/^##[ \t]+\S/.test(lines[index])) {
      end = index;
      break;
    }
  }
  const content = lines.slice(starts[0] + 1, end).join('\n').trim();
  if (required && content.length === 0) fail(`${owner}: ${heading} section must be non-empty`);
  return content;
}

function validateNodeBody(body, id) {
  const lines = stripFencedCode(body).split('\n');
  const headings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^##[ \t]+(.+?)[ \t]*$/);
    if (match) headings.push({ name: match[1], index });
  }
  if (headings.length !== NODE_BODY_HEADINGS.length
    || headings.some((heading, index) => heading.name !== NODE_BODY_HEADINGS[index])) {
    fail(`${id}: H2 sections must be exactly ${NODE_BODY_HEADINGS.join(', ')} in that order`);
  }

  const sections = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const start = headings[index].index + 1;
    const end = index + 1 < headings.length ? headings[index + 1].index : lines.length;
    const content = lines.slice(start, end).join('\n').trim();
    if (content.length === 0) fail(`${id}: ${headings[index].name} section must be non-empty`);
    sections.set(headings[index].name, content);
  }

  const specSections = sections.get('Spec sections');
  if (!/\[[^\]\r\n]+\]\(\.\.\/SPEC\.md#[^)\s]+\)/.test(specSections)) {
    fail(`${id}: Spec sections must link to ../SPEC.md#<anchor>`);
  }
}

function validateSpec(parsed) {
  const { metadata } = parsed;
  if (typeof metadata.id !== 'string' || !SPEC_ID.test(metadata.id)) {
    fail(`${parsed.fileName}: id must match SPEC-<number>`);
  }
  if (!Number.isInteger(metadata.revision) || metadata.revision < 1) {
    fail(`${metadata.id}: revision must be a positive integer`);
  }
  if (metadata.status !== 'ready' && metadata.status !== 'completed') {
    fail(`${metadata.id}: status must be ready or completed`);
  }
  return {
    id: metadata.id,
    revision: metadata.revision,
    status: metadata.status,
    body: parsed.body,
  };
}

function validateExactNodeFields(metadata, label) {
  const actual = Object.keys(metadata);
  const expected = new Set(NODE_FIELDS);
  const missing = NODE_FIELDS.filter((field) => !Object.hasOwn(metadata, field));
  const extra = actual.filter((field) => !expected.has(field)).sort();
  if (missing.length === 0 && extra.length === 0) return;

  const details = [];
  if (missing.length > 0) details.push(`missing ${missing.join(', ')}`);
  if (extra.length > 0) details.push(`extra ${extra.join(', ')}`);
  fail(`${label}: frontmatter fields must be exactly ${NODE_FIELDS.join(', ')} (${details.join('; ')})`);
}

function stringArray(value, field, id) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${id}: ${field} must be an array of strings`);
  }
  return [...value];
}

function validateNode(parsed, spec) {
  const { metadata } = parsed;
  validateExactNodeFields(metadata, parsed.fileName);

  if (metadata.schema_version !== 3) fail(`${parsed.fileName}: schema_version must be 3`);
  if (typeof metadata.id !== 'string' || !NODE_ID.test(metadata.id)) {
    fail(`${parsed.fileName}: id must match SLICE-01 or SLICE-01.01 hierarchy`);
  }
  const id = metadata.id;
  if (metadata.spec_id !== spec.id) fail(`${id}: spec_id must be ${spec.id}`);
  if (!Number.isInteger(metadata.spec_revision) || metadata.spec_revision < 1) {
    fail(`${id}: spec_revision must be a positive integer`);
  }
  if (metadata.spec_revision !== spec.revision) {
    fail(`${id}: spec_revision must match ${spec.id} revision ${spec.revision}`);
  }
  if (typeof metadata.parent_id !== 'string' || metadata.parent_id.length === 0) {
    fail(`${id}: parent_id must be a non-empty string`);
  }
  if (typeof metadata.title !== 'string' || metadata.title.trim().length === 0) {
    fail(`${id}: title must be a non-empty string`);
  }
  if (metadata.status !== 'pending' && metadata.status !== 'completed') {
    fail(`${id}: status must be pending or completed`);
  }

  const blockedBy = stringArray(metadata.blocked_by, 'blocked_by', id);
  const runAfter = stringArray(metadata.run_after, 'run_after', id);
  const writeScope = stringArray(metadata.write_scope, 'write_scope', id);
  validateNodeBody(parsed.body, id);

  return {
    schemaVersion: 3,
    id,
    specId: metadata.spec_id,
    specRevision: metadata.spec_revision,
    parentId: metadata.parent_id,
    title: metadata.title,
    status: metadata.status,
    blockedBy,
    runAfter,
    writeScope,
    fileName: parsed.fileName,
  };
}

function expectedParentId(id, specId) {
  const separator = id.lastIndexOf('.');
  return separator < 0 ? specId : id.slice(0, separator);
}

function validateParents(nodes, byId, specId) {
  for (const node of nodes) {
    if (node.parentId !== specId && !byId.has(node.parentId)) {
      fail(`${node.id}: orphan parent ${node.parentId}`);
    }
  }

  const state = new Map();
  function visit(id) {
    if (state.get(id) === 1) fail(`parent cycle detected at ${id}`);
    if (state.get(id) === 2) return;
    state.set(id, 1);
    const parentId = byId.get(id).parentId;
    if (byId.has(parentId)) visit(parentId);
    state.set(id, 2);
  }
  for (const id of [...byId.keys()].sort()) visit(id);

  for (const node of nodes) {
    const expected = expectedParentId(node.id, specId);
    if (expected !== specId && !byId.has(expected)) {
      fail(`${node.id}: orphan hierarchy parent ${expected} is missing`);
    }
    if (node.parentId !== expected) {
      fail(`${node.id}: parent_id must be ${expected} to match ID hierarchy`);
    }
  }
}

function buildChildren(nodes, specId) {
  const children = new Map([[specId, []]]);
  for (const node of nodes) children.set(node.id, []);
  for (const node of nodes) children.get(node.parentId).push(node.id);
  for (const ids of children.values()) ids.sort();
  return children;
}

function validateDependencies(nodes, byId) {
  const dependencies = new Map();
  for (const node of nodes) {
    const refs = [...node.blockedBy, ...node.runAfter];
    if (new Set(refs).size !== refs.length) {
      fail(`${node.id}: dependency IDs must be unique across blocked_by and run_after`);
    }
    for (const ref of refs) {
      if (ref === node.id) fail(`${node.id}: self dependency is not allowed`);
      const target = byId.get(ref);
      if (!target) fail(`${node.id}: unknown dependency ${ref}`);
      if (target.parentId !== node.parentId) {
        fail(`${node.id}: dependency ${ref} must be a sibling`);
      }
    }
    dependencies.set(node.id, refs);
  }

  const state = new Map();
  function visit(id) {
    if (state.get(id) === 1) fail('blocked_by + run_after contains a dependency cycle');
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const dependency of dependencies.get(id)) visit(dependency);
    state.set(id, 2);
  }
  for (const id of [...byId.keys()].sort()) visit(id);
  return dependencies;
}

function extractNodeIds(value) {
  return value.match(/\bSLICE-\d{2}(?:\.\d{2})*\b/g) || [];
}

function markdownLinks(content) {
  if (content === null) return { links: [], remainder: '' };
  const links = [];
  const masked = [];
  const linkPattern = /\[([^\]\r\n]*)\]\(([^\r\n)]*)\)/g;
  let cursor = 0;
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    masked.push(content.slice(cursor, match.index));
    links.push({ raw: match[0], label: match[1], target: match[2].trim() });
    masked.push(' '.repeat(match[0].length));
    cursor = linkPattern.lastIndex;
  }
  masked.push(content.slice(cursor));
  return { links, remainder: masked.join('') };
}

function resolvedMarkdownTarget(target, specId) {
  let destination = target.trim();
  if (destination.startsWith('<') && destination.endsWith('>')) {
    destination = destination.slice(1, -1);
  }
  const fragment = destination.indexOf('#');
  if (fragment >= 0) destination = destination.slice(0, fragment);
  if (destination.length === 0 || destination.includes('\\')
    || destination.startsWith('/') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(destination)) {
    fail(`${specId}: Slices links must use relative targets to direct Node documents`);
  }
  return path.posix.normalize(destination);
}

function validateSpecSliceLinks(spec, children, nodes) {
  const topLevel = children.get(spec.id);
  const section = bodySection(spec.body, 'Slices', spec.id, topLevel.length > 0);
  const { links, remainder } = markdownLinks(section);
  const topLevelSet = new Set(topLevel);
  const counts = new Map(topLevel.map((id) => [id, 0]));
  const nodesByTarget = new Map(nodes.map((node) => [`slices/${node.fileName}`, node]));

  for (const link of links) {
    const target = resolvedMarkdownTarget(link.target, spec.id);
    const targetNode = nodesByTarget.get(target);
    if (!targetNode) fail(`${spec.id}: unknown Node document ${target} in Slices`);
    const id = targetNode.id;
    if (!topLevelSet.has(id)) {
      fail(`${spec.id}: deeper Node document ${target} must not appear in Slices`);
    }
    const mentionedIds = new Set(extractNodeIds(link.raw));
    if ([...mentionedIds].some((mentioned) => mentioned !== id)) {
      fail(`${spec.id}: Slices link for ${id} contains another Node ID`);
    }
    counts.set(id, counts.get(id) + 1);
  }

  const plainTextIds = extractNodeIds(remainder);
  if (plainTextIds.length > 0) {
    fail(`${spec.id}: Node ID ${plainTextIds[0]} in Slices must be an actual Markdown link`);
  }
  for (const id of topLevel) {
    if (counts.get(id) !== 1) {
      fail(`${spec.id}: top-level Node ${id} must be linked exactly once in Slices`);
    }
  }
}

function validateScopeEntry(entry, id) {
  if (entry.length === 0 || entry.trim() !== entry) {
    fail(`${id}: write_scope entry must be a normalized project-relative boundary`);
  }
  if (/[\\]/.test(entry)) fail(`${id}: write_scope must use forward slashes: ${entry}`);
  if (entry.startsWith('/') || /^[A-Za-z]:/.test(entry)) {
    fail(`${id}: write_scope must be project-relative: ${entry}`);
  }
  if (/[*?!\[\]{}]/.test(entry)) {
    fail(`${id}: write_scope must not contain glob metacharacters: ${entry}`);
  }
  if (/[\u0000\r\n]/.test(entry)) {
    fail(`${id}: write_scope contains an invalid control character`);
  }

  const directory = entry.endsWith('/');
  const boundary = directory ? entry.slice(0, -1) : entry;
  if (boundary.length === 0) {
    fail(`${id}: write_scope entry must not be empty`);
  }
  const segments = boundary.split('/');
  if (segments.some((segment) => segment.length === 0)) {
    fail(`${id}: write_scope must not contain empty path segments: ${entry}`);
  }
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    fail(`${id}: write_scope must not contain . or .. segments: ${entry}`);
  }
  if (path.posix.normalize(boundary) !== boundary) {
    fail(`${id}: write_scope entry is not normalized: ${entry}`);
  }
  return { value: entry, boundary, directory };
}

function validateWriteScopes(nodes, children) {
  const scopes = new Map();
  for (const node of nodes) {
    const isLeaf = children.get(node.id).length === 0;
    if (!isLeaf && node.writeScope.length !== 0) {
      fail(`${node.id}: Branch write_scope must be exactly []`);
    }
    if (isLeaf && node.writeScope.length === 0) {
      fail(`${node.id}: Leaf write_scope must be non-empty`);
    }
    if (new Set(node.writeScope).size !== node.writeScope.length) {
      fail(`${node.id}: duplicate write_scope entry`);
    }
    scopes.set(node.id, node.writeScope.map((entry) => validateScopeEntry(entry, node.id)));
  }
  return scopes;
}

function boundariesOverlap(left, right) {
  if (left.boundary === right.boundary) return true;
  if (left.directory && right.boundary.startsWith(`${left.boundary}/`)) return true;
  if (right.directory && left.boundary.startsWith(`${right.boundary}/`)) return true;
  return false;
}

function dependsTransitively(from, target, dependencies) {
  const pending = [...dependencies.get(from)];
  const seen = new Set();
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...dependencies.get(id));
  }
  return false;
}

function pathFromRoot(id, byId, specId, cache) {
  if (cache.has(id)) return cache.get(id);
  const node = byId.get(id);
  const result = node.parentId === specId
    ? [id]
    : [...pathFromRoot(node.parentId, byId, specId, cache), id];
  cache.set(id, result);
  return result;
}

function divergentSiblings(leftId, rightId, byId, specId, cache) {
  const leftPath = pathFromRoot(leftId, byId, specId, cache);
  const rightPath = pathFromRoot(rightId, byId, specId, cache);
  let index = 0;
  while (leftPath[index] === rightPath[index]) index += 1;
  return [leftPath[index], rightPath[index]];
}

function validateConcurrentScopes(nodes, children, scopes, dependencies, byId, specId) {
  const leaves = nodes.filter((node) => children.get(node.id).length === 0);
  const pathCache = new Map();
  for (let leftIndex = 0; leftIndex < leaves.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < leaves.length; rightIndex += 1) {
      const left = leaves[leftIndex];
      const right = leaves[rightIndex];
      let overlap = null;
      for (const leftScope of scopes.get(left.id)) {
        for (const rightScope of scopes.get(right.id)) {
          if (boundariesOverlap(leftScope, rightScope)) {
            overlap = [leftScope.value, rightScope.value];
            break;
          }
        }
        if (overlap) break;
      }
      if (!overlap) continue;

      const [leftSibling, rightSibling] = divergentSiblings(
        left.id,
        right.id,
        byId,
        specId,
        pathCache,
      );
      const ordered = dependsTransitively(leftSibling, rightSibling, dependencies)
        || dependsTransitively(rightSibling, leftSibling, dependencies);
      if (!ordered) {
        fail(
          `concurrent write_scope conflict: ${left.id} (${overlap[0]}) overlaps `
          + `${right.id} (${overlap[1]}), but ${leftSibling} and ${rightSibling} are unordered`,
        );
      }
    }
  }
}

function loadGateStates(root, spec, nodes) {
  const owners = [
    { id: spec.id, specId: spec.id, specRevision: spec.revision },
    ...nodes,
  ];
  const ids = owners.map((owner) => owner.id);
  const gateDirectory = path.join(root, 'gates');
  const files = listDirectMarkdown(gateDirectory);
  const actual = new Map(files.map((file) => [file.name, file.filePath]));
  const expectedNames = ids.map((id) => `${id}.md`);
  const expected = new Set(expectedNames);
  const missing = expectedNames.filter((name) => !actual.has(name));
  if (missing.length > 0) fail(`missing Gate file${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
  const orphan = files.map((file) => file.name).filter((name) => !expected.has(name));
  if (orphan.length > 0) fail(`orphan Gate file${orphan.length === 1 ? '' : 's'}: ${orphan.join(', ')}`);

  const states = new Map();
  for (const owner of owners) {
    const { id } = owner;
    const gateFileName = `${id}.md`;
    let document;
    try {
      document = parseGateFile(actual.get(gateFileName));
    } catch (error) {
      if (error instanceof GateParseError) fail(error.message);
      throw error;
    }
    if (document.scope !== id) {
      fail(`${gateFileName}: Gate heading must be "# Gates: ${id}"`);
    }
    const expectedScopeLine = `${owner.specId} revision ${owner.specRevision}`;
    if (document.scopeLine !== expectedScopeLine) {
      fail(`${gateFileName}: Gate Scope must be "Scope: ${expectedScopeLine}"`);
    }
    const statuses = document.gates.map(gateStatus);
    states.set(id, {
      allMet: statuses.length > 0 && statuses.every((status) => status === 'met'),
      abandoned: statuses.includes('abandoned'),
      counts: {
        met: statuses.filter((status) => status === 'met').length,
        unmet: statuses.filter((status) => status === 'unmet').length,
        abandoned: statuses.filter((status) => status === 'abandoned').length,
      },
    });
  }
  return states;
}

function dependenciesCompleted(id, dependencies, byId) {
  return dependencies.get(id).every((dependency) => byId.get(dependency).status === 'completed');
}

function validateCompletedStates(nodes, children, dependencies, byId, gateStates) {
  for (const node of nodes) {
    if (node.status !== 'completed') continue;
    const incompleteChildren = children.get(node.id)
      .filter((child) => byId.get(child).status !== 'completed');
    if (incompleteChildren.length > 0) {
      fail(`${node.id}: completed node has incomplete children: ${incompleteChildren.join(', ')}`);
    }
    const incompleteDependencies = dependencies.get(node.id)
      .filter((dependency) => byId.get(dependency).status !== 'completed');
    if (incompleteDependencies.length > 0) {
      fail(`${node.id}: completed node has incomplete dependencies: ${incompleteDependencies.join(', ')}`);
    }
    if (!gateStates.get(node.id).allMet) {
      fail(`${node.id}: completed node requires all own Gates met`);
    }
  }
}

function validateCompletedSpec(spec, children, byId, gateStates) {
  if (spec.status !== 'completed') return;
  const incompleteChildren = children.get(spec.id)
    .filter((child) => byId.get(child).status !== 'completed');
  if (incompleteChildren.length > 0) {
    fail(`${spec.id}: completed Spec has incomplete direct children: ${incompleteChildren.join(', ')}`);
  }
  if (!gateStates.get(spec.id).allMet) {
    fail(`${spec.id}: completed Spec requires the root Gate to be all met`);
  }
}

function lineage(id, byId, specId) {
  const nodes = [];
  let current = byId.get(id);
  while (current) {
    nodes.push(current);
    current = current.parentId === specId ? null : byId.get(current.parentId);
  }
  return nodes;
}

function descendantsCompleted(id, children, byId) {
  const pending = [...children.get(id)];
  while (pending.length > 0) {
    const descendant = pending.pop();
    if (byId.get(descendant).status !== 'completed') return false;
    pending.push(...children.get(descendant));
  }
  return true;
}

function inspectExecutionTree(specDirectory) {
  const root = ensureSpecDirectory(specDirectory);
  const spec = validateSpec(parseJsonFrontmatter(path.join(root, 'SPEC.md')));
  const parsedNodes = listDirectMarkdown(path.join(root, 'slices'))
    .map((file) => parseJsonFrontmatter(file.filePath));

  if (parsedNodes.some((parsed) => parsed.metadata.schema_version === 1
    || parsed.metadata.schema_version === 2)) {
    fail('explicit re-slice required');
  }

  const nodes = parsedNodes.map((parsed) => validateNode(parsed, spec));
  const byId = new Map();
  for (const node of nodes) {
    if (byId.has(node.id)) fail(`${node.id}: duplicate Node ID`);
    byId.set(node.id, node);
  }
  nodes.sort((left, right) => left.id.localeCompare(right.id));

  validateParents(nodes, byId, spec.id);
  const children = buildChildren(nodes, spec.id);
  const dependencies = validateDependencies(nodes, byId);
  validateSpecSliceLinks(spec, children, nodes);
  const scopes = validateWriteScopes(nodes, children);
  validateConcurrentScopes(nodes, children, scopes, dependencies, byId, spec.id);

  const gateIds = [spec.id, ...nodes.map((node) => node.id)];
  const gateStates = loadGateStates(root, spec, nodes);
  validateCompletedStates(nodes, children, dependencies, byId, gateStates);
  validateCompletedSpec(spec, children, byId, gateStates);

  const abandonedIds = gateIds.filter((id) => gateStates.get(id).abandoned);
  const executionStopped = abandonedIds.length > 0;
  let runnableLeaves = [];
  let runnableSlices = [];
  let completableBranches = [];
  let reviewReady = [];

  if (!executionStopped && spec.status === 'ready') {
    if (nodes.length === 0) {
      if (!gateStates.get(spec.id).allMet) runnableLeaves = [spec.id];
    } else {
      runnableLeaves = nodes
        .filter((node) => children.get(node.id).length === 0)
        .filter((node) => !gateStates.get(node.id).allMet)
        .filter((node) => lineage(node.id, byId, spec.id)
          .every((ancestor) => ancestor.status === 'pending'
            && dependenciesCompleted(ancestor.id, dependencies, byId)))
        .map((node) => node.id)
        .sort();

      completableBranches = nodes
        .filter((node) => children.get(node.id).length > 0)
        .filter((node) => node.status === 'pending')
        .filter((node) => children.get(node.id)
          .every((child) => byId.get(child).status === 'completed'))
        .filter((node) => dependenciesCompleted(node.id, dependencies, byId))
        .filter((node) => node.parentId !== spec.id || !gateStates.get(node.id).allMet)
        .map((node) => node.id)
        .sort();

      reviewReady = nodes
        .filter((node) => node.parentId === spec.id && node.status === 'pending')
        .filter((node) => descendantsCompleted(node.id, children, byId))
        .filter((node) => dependenciesCompleted(node.id, dependencies, byId))
        .filter((node) => gateStates.get(node.id).allMet)
        .map((node) => node.id)
        .sort();

      const reviewReadySet = new Set(reviewReady);
      runnableSlices = nodes
        .filter((node) => node.parentId === spec.id && node.status === 'pending')
        .filter((node) => dependenciesCompleted(node.id, dependencies, byId))
        .filter((node) => !reviewReadySet.has(node.id))
        .map((node) => node.id)
        .sort();
    }
  }

  return {
    spec_id: spec.id,
    spec_revision: spec.revision,
    spec_status: spec.status,
    root_id: spec.id,
    root_gate_all_met: gateStates.get(spec.id).allMet,
    abandoned_ids: abandonedIds,
    execution_stopped: executionStopped,
    nodes: nodes.map((node) => ({
      schema_version: node.schemaVersion,
      id: node.id,
      spec_id: node.specId,
      spec_revision: node.specRevision,
      parent_id: node.parentId,
      title: node.title,
      status: node.status,
      blocked_by: [...node.blockedBy],
      run_after: [...node.runAfter],
      write_scope: [...node.writeScope],
      position: node.parentId === spec.id ? 'slice' : 'subslice',
      depth: node.id.split('.').length,
      children: [...children.get(node.id)],
      is_leaf: children.get(node.id).length === 0,
      gates_all_met: gateStates.get(node.id).allMet,
      gates_abandoned: gateStates.get(node.id).abandoned,
    })),
    runnable_leaves: runnableLeaves,
    dispatch_candidates: [...runnableLeaves],
    runnable_slices: runnableSlices,
    completable_branches: completableBranches,
    review_ready: reviewReady,
  };
}

function main(argv) {
  const args = argv || process.argv.slice(2);
  if (args.length !== 1) {
    process.stderr.write('Usage: inspect-execution-tree.js <spec-directory>\n');
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(inspectExecutionTree(args[0]), null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof ExecutionTreeError || error instanceof GateParseError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = {
  ExecutionTreeError,
  inspectExecutionTree,
  main,
  stripFencedCode,
};
