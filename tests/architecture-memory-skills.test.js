const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
const skills = ['architecture-memory-init', 'architecture-memory', 'architecture-memory-update'];

test('architecture skills disable global implicit invocation; initialized projects use the local connection', () => {
  for (const name of skills) {
    const source = read('skills', name, 'SKILL.md');
    const metadata = read('skills', name, 'agents', 'openai.yaml');
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatter, name);
    assert.ok(frontmatter[1].includes('name: ' + name));
    assert.match(frontmatter[1], /^description:\s*\S.+$/m);
    assert.ok(metadata.includes('allow_implicit_invocation: false'));
    assert.ok(metadata.includes('$' + name));
  }
});

test('all workflow reference pointers resolve without loading templates on the retrieval path', () => {
  const files = [
    ...skills.map((name) => path.join('skills', name, 'SKILL.md')),
    'skills/architecture-memory-init/references/initialization.md',
    'skills/architecture-memory/references/recording.md',
    'skills/architecture-memory/references/retrieval.md',
    'skills/architecture-memory/references/record-format.md',
    'skills/architecture-memory/references/workflow.md',
  ];
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const target = path.resolve(repoRoot, path.dirname(file), match[1]);
      assert.ok(fs.existsSync(target), file + ' -> ' + match[1]);
    }
  }
  const main = read('skills', 'architecture-memory', 'SKILL.md');
  assert.doesNotMatch(main, /\]\(references\/(base|component|decision)-templates\.md\)/);
});

test('document templates cover required baseline and conditional component and decision documents', () => {
  const templates = ['base-templates', 'component-templates', 'decision-templates']
    .map((name) => read('skills', 'architecture-memory', 'references', name + '.md')).join('\n');
  for (const file of ['README.md', '01-system-context.md', '02-containers.md', '04-context.md',
    'components/README.md', 'components/<container-slug>.md', 'decisions/README.md', 'decisions/ADR-<number>-<slug>.md']) {
    assert.ok(templates.includes(file), file);
  }
});

test('main discovery and workflow instructions fit a bounded initial context', () => {
  const main = read('skills', 'architecture-memory', 'SKILL.md');
  const description = main.match(/^description: (.*)$/m)[1];
  assert.ok(description.length <= 240);
  assert.ok(main.length <= 3500, main.length + ' characters');
});
