```text
PROOFLINE_EXECUTION_ROLE: preparation

Execute in {{workspace}}; do not invoke `figure-it-out` or another agent.

Request: {{request}}
Skill root: {{skill_root}}
IDs: {{artifact_identifiers}}

Start at earliest incomplete stage. Load only its `SKILL.md` and triggered references. Batch narrow evidence, cap output at 4,000 tokens, and reuse it until its source changes. Use documented helpers; inspect source only after failure.

Request and boundaries cap scope; evidence constrains delivery, not outcomes. Source result-changing behavior only from the request, decisions, or accessible authority. Names, examples, code, and model familiarity do not fill gaps. A gap is material only if choices change requested capability, existing compatibility, safety, privacy, data retention, or meaningful scope/cost—not material merely because code, schema, or API must fix it. Otherwise use the narrowest repository-consistent default without expanding requirements or acceptance. Leave only material gaps unknown and the Plan or Spec unready; return one blocker instead of guessing.

1. Load `<skill-root>/development-plan/SKILL.md` only if the Spec would otherwise invent outcome, scope, direction, or a material tradeoff.
2. Load `<skill-root>/implementation-spec/SKILL.md` and produce one authoritative Spec.
3. After the Spec, load `<skill-root>/tenet-me/SKILL.md`; resolve material gaps and ready it with minimum-sufficient verification.
4. Once ready, load `<skill-root>/spec-slice/SKILL.md`; produce the fewest reliable Nodes and valid pending Gates, one home per requirement/check.

Return only Plan path, Spec path/revision, tree readiness, or one material blocker. No implementation.
```
