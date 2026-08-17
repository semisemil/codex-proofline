#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

class PlanError extends Error {}

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

function fail(message) {
  throw new PlanError(message);
}

function readSlice(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) fail(`${path.basename(filePath)}: JSON frontmatter is missing`);

  let metadata;
  try {
    metadata = JSON.parse(match[1]);
  } catch (error) {
    fail(`${path.basename(filePath)}: invalid JSON frontmatter: ${error.message}`);
  }
  return { filePath, metadata, body: content.slice(match[0].length).trim() };
}

function requiredSection(body, heading, id) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`^## ${escaped}\\r?\\n+([\\s\\S]*?)(?=\\r?\\n## |$)`, 'm'));
  if (!match || match[1].trim().length === 0) fail(`${id}: ${heading} section is required`);
  return match[1].trim();
}

function stringArray(value, field, id) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${id}: ${field} must be an array of Slice IDs`);
  }
  return value;
}

function stableTopologicalOrder(slices, dependencies) {
  const remaining = new Map(slices.map((slice) => [slice.id, new Set(dependencies.get(slice.id))]));
  const order = [];

  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, incoming]) => incoming.size === 0)
      .map(([id]) => id)
      .sort();
    if (ready.length === 0) fail('blocked_by + run_after contains a cycle');

    for (const id of ready) {
      order.push(id);
      remaining.delete(id);
      for (const incoming of remaining.values()) incoming.delete(id);
    }
  }
  return order;
}

function inspectSlicePlan(sliceDirectory) {
  const root = path.resolve(sliceDirectory);
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`slice directory does not exist: ${root}`);
  }

  const files = fs.readdirSync(root)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort()
    .map((name) => path.join(root, name));
  if (files.length === 0) fail('slice plan is empty');

  const slices = [];
  const seen = new Set();
  for (const { filePath, metadata, body } of files.map(readSlice)) {
    const id = metadata.id;
    if (typeof id !== 'string' || !/^SLICE-\d+$/.test(id)) {
      fail(`${path.basename(filePath)}: id must match SLICE-<number>`);
    }
    if (seen.has(id)) fail(`${id}: duplicate Slice ID`);
    seen.add(id);

    if (metadata.schema_version !== 1 && metadata.schema_version !== 2) {
      fail(`${id}: schema_version must be 1 or 2`);
    }
    if (typeof metadata.spec_id !== 'string' || metadata.spec_id.length === 0) {
      fail(`${id}: spec_id is required`);
    }
    if (!Number.isInteger(metadata.spec_revision) || metadata.spec_revision < 1) {
      fail(`${id}: spec_revision must be a positive integer`);
    }
    if (typeof metadata.title !== 'string' || metadata.title.trim().length === 0) {
      fail(`${id}: title must be a non-empty string`);
    }
    if (metadata.status !== 'pending' && metadata.status !== 'completed') {
      fail(`${id}: status must be pending or completed`);
    }

    const structuralBody = stripFencedCode(body);
    const blockedBy = stringArray(metadata.blocked_by, 'blocked_by', id);
    let runAfter = [];
    let specSectionAnchor = null;
    if (metadata.schema_version === 2) {
      if (!Object.hasOwn(metadata, 'run_after')) fail(`${id}: v2 requires run_after`);
      runAfter = stringArray(metadata.run_after, 'run_after', id);
      requiredSection(structuralBody, 'Outcome', id);
      const specSection = requiredSection(structuralBody, 'Spec section', id);
      const specSectionMatch = specSection.match(/\]\(\.\.\/SPEC\.md#([^)]+)\)/);
      if (!specSectionMatch) {
        fail(`${id}: Spec section must link to ../SPEC.md#<section>`);
      }
      specSectionAnchor = specSectionMatch[1];
      requiredSection(structuralBody, 'Concurrency boundary', id);
      requiredSection(structuralBody, 'Slice checks', id);
      requiredSection(structuralBody, 'Integration checks', id);
    } else if (structuralBody.length === 0) {
      fail(`${id}: Slice body is required`);
    }

    slices.push({
      id,
      schemaVersion: metadata.schema_version,
      specId: metadata.spec_id,
      specRevision: metadata.spec_revision,
      status: metadata.status,
      blockedBy,
      runAfter,
      specSectionAnchor,
      file: path.basename(filePath),
    });
  }

  const specIds = new Set(slices.map((slice) => slice.specId));
  const revisions = new Set(slices.map((slice) => slice.specRevision));
  if (specIds.size !== 1) fail('all Slices must target one spec_id');
  if (revisions.size !== 1) fail('all Slices must target one spec_revision');

  const byId = new Map(slices.map((slice) => [slice.id, slice]));
  const dependencies = new Map();
  for (const slice of slices) {
    const refs = [...slice.blockedBy, ...slice.runAfter];
    if (new Set(refs).size !== refs.length) fail(`${slice.id}: dependency IDs must be unique`);
    for (const ref of refs) {
      if (ref === slice.id) fail(`${slice.id}: self-reference is not allowed`);
      if (!byId.has(ref)) fail(`${slice.id}: unknown Slice ID ${ref}`);
    }
    dependencies.set(slice.id, refs);
  }

  for (const slice of slices) {
    if (slice.status !== 'completed') continue;
    const incomplete = dependencies.get(slice.id).filter((id) => byId.get(id).status !== 'completed');
    if (incomplete.length > 0) {
      fail(`${slice.id}: completed Slice has incomplete dependencies: ${incomplete.join(', ')}`);
    }
  }

  const integrationOrder = stableTopologicalOrder(slices, dependencies);
  const versions = new Set(slices.map((slice) => slice.schemaVersion));
  const planMode = versions.size === 1 && versions.has(2)
    ? 'v2'
    : versions.size === 1
      ? 'legacy-sequential'
      : 'mixed-sequential';
  const concurrencyLimit = planMode === 'v2' ? 2 : 1;
  const runnable = slices
    .filter((slice) => slice.status === 'pending')
    .filter((slice) => dependencies.get(slice.id).every((id) => byId.get(id).status === 'completed'))
    .map((slice) => slice.id)
    .sort();

  return {
    plan_mode: planMode,
    concurrency_limit: concurrencyLimit,
    spec_id: slices[0].specId,
    spec_revision: slices[0].specRevision,
    integration_order: integrationOrder,
    runnable,
    dispatch: runnable.slice(0, concurrencyLimit),
    slices,
  };
}

function main(argv) {
  if (argv.length !== 1) {
    process.stderr.write('Usage: inspect-slice-plan.js <slice-directory>\n');
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(inspectSlicePlan(argv[0]), null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof PlanError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { PlanError, inspectSlicePlan, main, stripFencedCode };
