'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const repoRoot = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(repoRoot, 'skills/spec-slice/assets/templates/parallel.md'), 'utf8');

test('parallel plan represents main and independent work in one Spec-adjacent document', () => {
  const assignments = {
    spec_id: 'SPEC-0001', spec_revision: '3',
    parallel_benefit: 'Independent email and SMS providers use an accepted shared delivery interface.',
    main_goal: 'Implement the email provider',
    main_spec_links: '[Email delivery](SPEC.md#email)',
    main_write_scope: 'src/email.js and test/email.test.js',
    main_context_and_interfaces: 'DeliveryInput -> Promise<DeliveryReceipt>; recipient is validated upstream',
    main_completion_conditions: 'Email reaches the configured recipient',
    task_id: 'SMS', task_title: 'SMS delivery',
    goal: 'Implement the SMS provider',
    spec_links: '[SMS delivery](SPEC.md#sms)',
    write_scope: 'src/sms.js and test/sms.test.js',
    context_and_interfaces: 'DeliveryInput -> Promise<DeliveryReceipt>; recipient is validated upstream',
    completion_conditions: 'SMS reaches the configured recipient',
  };
  const rendered = template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    assert.ok(Object.hasOwn(assignments, key), key);
    return assignments[key];
  });
  assert.doesNotMatch(rendered, /\{\{|parent_id|blocked_by|schema_version|CHECK:/);
  assert.match(rendered, /Spec: \[SPEC-0001\]\(SPEC\.md\), revision 3/);
  const sections = rendered.split(/^## /m).slice(1);
  assert.equal(sections.length, 2);
  for (const section of sections) {
    for (const field of ['Goal', 'Spec evidence', 'Change scope', 'Context and interfaces', 'Completion conditions']) {
      assert.match(section, new RegExp('^' + field + ': .+', 'm'));
    }
  }
  assert.match(sections[0], /Main implementation/);
  assert.match(sections[1], /SMS: SMS delivery/);
});

test('Spec Slice links its only current plan template and keeps invocation policy', () => {
  const skill = fs.readFileSync(path.join(repoRoot, 'skills/spec-slice/SKILL.md'), 'utf8');
  const metadata = fs.readFileSync(path.join(repoRoot, 'skills/spec-slice/agents/openai.yaml'), 'utf8');
  assert.match(skill, /assets\/templates\/parallel\.md/);
  assert.match(metadata, /allow_implicit_invocation: false/);
  assert.match(metadata, /\$spec-slice/);
  assert.match(metadata, /PARALLEL\.md/);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills/spec-slice/assets/templates/slice.md')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'skills/spec-slice/assets/templates/gates.md')), false);
});
