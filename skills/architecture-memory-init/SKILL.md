---
name: architecture-memory-init
description: Initialize a code-first, human-readable architecture memory for an existing project.
---

# Architecture Memory Initialization

Initialize only on an explicit user request. Read [the initialization procedure](references/initialization.md) completely and run its preflight first. For a new baseline, read [the document contract](../architecture-memory/references/document-contract.md) and [the base templates](../architecture-memory/references/base-templates.md) after the evidence pass; read [the component templates](../architecture-memory/references/component-templates.md) only when an L3 document is selected and [the decision template](../architecture-memory/references/decision-templates.md) only when an ADR is warranted. Reactivation reads the contract and registered files but no templates.

Create a compact baseline from repository evidence, preserving unknowns instead of inventing intent or retrospective decisions. An explicit initialization request authorizes `managed: true`; ask only when the architecture root conflicts with existing documents or the request does not authorize file creation.

Follow the procedure through its write, registration, and compact result report.
