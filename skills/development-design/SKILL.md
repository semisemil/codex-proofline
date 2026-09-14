---
name: development-design
description: Develop a software idea or partial design into an implementation-ready Design through explanation, drafts, comparisons, and decisions. Use for development planning, technical design, or Design revision and lifecycle work.
---

# Development Design

Help the user develop what they have already thought through into a concrete design. The Design is the single current source for both the chosen approach and its implementation contract. A direct design request ends with design; `figure-it-out` may own an authorized implementation workflow.

## Start from the current idea

Resolve an explicit Design ID/path directly. Reuse the conversation's settled decisions and inspected evidence. For a new request, inspect plausible same-goal Designs; legacy Plan/Spec succession follows [document operations](references/document-operations.md). Identity ambiguity needs clarification. Lifecycle-only work goes directly to that reference.

Understand the user's purpose, scenario, and current thinking. When purpose is unclear, establish who needs the feature and what should become possible, within the requested feature's necessity and scope. A personal tool or experiment needs no invented business case. Already settled planning needs no repeated interview.

Read project/domain context and relevant implementation when they constrain this change. Connected Architecture Memory supplies relevant conditions and prior decisions; reuse evidence still in context and inspect only gaps or changes. A missing Memory match establishes no absence of constraints. Source required behavior from the request, confirmed choices, and affected existing contracts. Repository evidence constrains delivery without adding adjacent product goals. Research external approaches only when the choice needs facts unavailable locally, and cite what influences it.

## Develop the design together

Choose the next useful contribution by what most changes the design: explain an overlooked situation, sketch a flow, draft responsibilities or data, work through a failure, compare plausible structures, or ask for a material user choice. Adapt depth to this feature and the user's understanding. Use a pattern when its fit and consequences clarify a real choice; explain why the proposed structure is sufficient under current conditions. A catalog of patterns or a fixed interview sequence is unnecessary.

Contribute concrete alternatives and recommendations where choices matter. Explain the affected behavior, evidence, benefit, and cost. Resolve source-answerable facts yourself. The user decides changes to purpose, scope, observable behavior, compatibility, or meaningful cost and operating burden. Reversible details may be drafted with stated assumptions; preserve proposals as proposals. Defaults that preserve required results may remain implementation choices. Repeated questioning or agreement cannot establish empirical demand or feasibility.

Develop the relevant responsibilities, state/data flow, external contracts, failure handling, and operating constraints together. Trace interactions through their final consumer: earlier transformations, reused state, retries, optional behavior, and affected compatibility can change the final result. Keep chosen decisions with the assumptions and tradeoffs that qualify them, including a meaningful condition for revisiting a consequential choice.

## Maintain one contract

Write the current Design so implementation and review need neither the original conversation nor missing requirements from Memory. Organize around this feature's behavior and affected boundaries. Include purpose/scope, selected structure and reasons, responsibilities/data, condition-to-result rules with defaults/exceptions, and expected observations to the depth needed. These are review concerns, not mandatory headings or a questionnaire.

Preserve every requested result at its original strength and scope, including explicit identifiers, fields, paths, commands, quantities, and examples. Give each result one authoritative statement; types, tables, and examples must agree. For interactions where local correctness can hide a wrong final result, include a concrete input/state and work through the final observations, preserving unaffected data. Expected results must distinguish correct behavior from a plausible violation and have a source independent of the candidate implementation.

Store rationale supporting the current choice, rather than the entire teaching conversation or abandoned drafts. Preserve meaningful alternatives actually considered and the limits of available evidence. Keep result-preserving algorithms, file layout, and internal representations open. Define acceptance through required behavior and observations; implementation chooses verification methods. Retain explicit user/project verification obligations with their source.

## Readiness and revisions

Use `ready` when the intended result, scope, consequential structure/behavior, affected contracts, and decisive expected observations are established without inventing a material choice. Check the complete body against the sources for missing results, unsupported obligations, contradictory conditions, and incorrect worked examples. Unresolved details are acceptable only when plausible choices preserve the required outcome and material constraints.

Use `draft` when a material decision or fact still prevents that state, or when the user asks to stop with a draft. Name the gap and what would resolve it. A missing material user decision calls for a focused question while independent work continues. Actual external prerequisites may justify `blocked`. Readiness is neither execution permission nor evidence of unobserved operational outcomes.

During authorized implementation, revise affected decisions and contract sections in the current session using the evidence already gathered. Ask only for material user choices. Reassess affected paths; unchanged evidence is reusable only where it still establishes the revised contract. Follow the owning implementation workflow back to verification, without restarting all preparation or creating another session.

## Save and finish

Read [document operations](references/document-operations.md) for writing, revision, succession, or lifecycle changes. Use the writer's `read` and `patch` for existing Design edits, submitting changed spans with the source hash. Report `no-op` if state is unchanged. Save through its writer and report the path, revision/status, material open decisions, and separate write/registration/Memory results.

The first Design save starts minimal Memory unless disabled or prohibited. At the settled decision boundary, use [Architecture Memory](../architecture-memory/SKILL.md) to preserve only context that will affect future decisions, with source, scope, and confidence/lifecycle. Link the Design for details; do not duplicate its contract. A failed Memory write does not undo a successful Design save. Continue work whose required evidence remains available and report the unresolved recording result.

Independent `tenet-me` or `grilling` may be combined when requested; this skill does not embed their interview procedure. Return to an owning workflow, or finish with the Design.
