# Preparation task assignment

Replace the placeholders and use this code block as the complete agent prompt.

```text
Prepare the current Figure It Out request in {{workspace}}.

Assignment
- Requested outcome: {{request}}
- Proofline skill root: {{skill_root}}
- Candidate artifact identifiers: {{artifact_identifiers}}

Run from the earliest incomplete stage. At each reached stage, load only its named `SKILL.md` and triggered references; later-stage skills remain unloaded. Batch narrow evidence, limit potentially large command output to 4,000 tokens, and reuse successful evidence until a relevant source changes.

1. Decide from the request and current artifacts whether a Plan is needed. If the Spec would otherwise invent the outcome, scope, direction, or material tradeoff, load `<skill-root>/development-plan/SKILL.md` and produce it. Otherwise continue without loading that skill.
2. Load `<skill-root>/implementation-spec/SKILL.md` and produce one compact authoritative Spec.
3. After the Spec exists, load `<skill-root>/tenet-me/SKILL.md`. Resolve only material gaps it finds, then leave the Spec ready with its minimum-sufficient verification commitment.
4. Only after readiness, load `<skill-root>/spec-slice/SKILL.md` and produce the fewest reliable execution Nodes, a valid tree, and pending Gates. Each requirement and check has one authoritative home.

Return only the optional Plan path, Spec path and revision, tree readiness, or one material decision blocker. Perform no implementation.
```
