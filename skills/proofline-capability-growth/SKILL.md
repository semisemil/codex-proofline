---
name: proofline-capability-growth
description: Use when reviewing repeated manual work, proposing automation candidates, checking whether a workflow should become a skill, script, hook, Codex automation, or AGENTS.md update.
---

# Proofline Capability Growth

This skill helps Codex find repeated manual work and propose safe automation candidates.

It must not create automation without user approval.

## Core rules

1. Do not create automation immediately.
2. First create a shortlist.
3. Use only evidence-backed candidates.
4. Reject broad or speculative automation.
5. Check whether existing skills, scripts, tests, CI, or repo tools already solve the problem.
6. Prefer the smallest useful automation.
7. Ask for user approval before creating or registering anything.

## Load only what is needed

- Candidate scan:
  - Read `assets/protocols/candidate-selection.md`
  - Use `assets/prompts/capability-growth-scan.md`
  - Use `assets/templates/capability-shortlist.md`

- Existing tool check:
  - Read `assets/protocols/existing-tool-check.md`

- User approved automation registration:
  - Read `assets/protocols/approval-before-registration.md`
  - Use `assets/prompts/automation-registration.md`
  - Use `assets/templates/automation-registration-request.md`
