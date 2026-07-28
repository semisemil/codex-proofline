---
name: proofline-capability-growth
description: "Use for Codex capability growth: review repeated manual work, shortlist automation candidates, check existing tools, and prepare skill/script/hook/Codex automation registration only after user approval."
---

# Proofline Capability Growth

Use this skill to decide whether repeated manual work should become a small automation.

Do not create or register automation without explicit user approval.

## Always apply

- Shortlist first; do not automate immediately.
- Prefer the smallest useful change.

## Read more only when needed

Do not read every asset by default. Use this file as the router.

- Candidate scan:
  - Read `assets/protocols/candidate-selection.md`
  - Read `assets/protocols/existing-tool-check.md`
  - Use `assets/prompts/capability-growth-scan.md`
  - Use `assets/templates/capability-shortlist.md`
  - Trigger when repeated manual work, repeated user corrections, recurring `.proofline/issues/`, or automation requests appear.
  - Complete when each inspected workflow is shortlisted after both checks or rejected with a reason; create no automation.

- Existing tool check:
  - Read `assets/protocols/existing-tool-check.md`
  - Trigger when checking a specific candidate outside a full scan.
  - Complete when an inspected alternative is sufficient or an evidenced gap remains.

- User-approved registration:
  - Read `assets/protocols/approval-before-registration.md`
  - Use `assets/prompts/automation-registration.md`
  - Use `assets/templates/automation-registration-request.md`
  - Trigger only after the user approves a specific candidate.
  - Complete when the artifact matches approved scope/files and each approved check has a result or unverified reason.
