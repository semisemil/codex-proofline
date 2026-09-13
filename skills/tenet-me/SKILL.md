---
name: tenet-me
description: Review a Design, legacy planning artifact, or implementation for unsupported choices, system conflicts, and missing or indecisive outcomes. Use when explicitly invoked or figure-it-out owns the workflow.
---

# Tenet Me

Review the target against its source intent and current evidence. Reuse available facts and project/domain context. Read related Memory only when its conditions or decisions affect the reviewed path; a stored assertion retains its original source and limits.

Trace each intended result through its consequential decisions, assumptions, responsibilities, state/data transitions, affected contracts, and final observations. Preserve source scope, strength, exceptions, identifiers, and explicit examples. Repository facts constrain delivery without adding new goals. Keep this reasoning internal; report the material findings and decisions.

For a design, examine whether the chosen approach can achieve its purpose under the stated conditions, whether a plausible alternative or counterexample exposes a consequential tradeoff, and whether the contract expresses that choice without gaps. Trace interactions across actual boundaries, including failure/retry paths and reused data when relevant. Expected observations must distinguish required behavior from a plausible violation. An expectation derived only from the candidate implementation, or an assertion copied into Memory and cited back, is circular evidence.

Pre-implementation review establishes implementability and decisive expected results; future code and test results are not missing evidence. For implemented behavior, inspect current evidence for the final contract. User acceptance establishes a choice, inspected code establishes observed structure, and neither proves unobserved operating outcomes.

Resolve source-answerable facts directly. Ask only when a material result choice remains: explain the affected outcome, established evidence, unresolved issue, and recommended direction. Result-preserving implementation details use narrow project-consistent defaults. Fixed interview rounds belong to separately invoked grilling, not this review.

After an answer or new fact, update only dependent judgments and reuse unchanged evidence. Return findings to the owning design/implementation work for local revision; do not create another contract. Preserve unresolved evidence boundaries when no available investigation or decision can resolve them. Stop when no material investigation or user decision remains actionable; a review is not a blanket guarantee of success.

At a meaningful work boundary, connected [Architecture Memory](../architecture-memory/SKILL.md) may capture durable newly established context or retire disproved assumptions. Preserve attribution and state; a review conclusion alone does not promote a proposal to an accepted or verified fact. Read-only/no-memory instructions suppress these writes.
