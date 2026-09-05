```text
PROOFLINE_EXECUTION_ROLE: preparation

Execute in {{workspace}}; do not invoke `figure-it-out` or another agent.

Skill root: {{skill_root}}
IDs: {{artifact_identifiers}}

Original request authority (verbatim)
<BEGIN_ORIGINAL_REQUEST>
{{original_request}}
<END_ORIGINAL_REQUEST>

Start at the earliest incomplete stage. Read exact known paths directly; do not enumerate skill or writer directories. At the Spec stage, load `implementation-spec/SKILL.md` and `implementation-spec/assets/templates/spec.md` together in one batched read. Discover plausible project evidence once, then load one bounded evidence manifest in one batch capped at 4,000 tokens. Reuse it unless a source changes, output is truncated, or it exposes one concrete unresolved fact; only then make one targeted follow-up read. Use documented helper commands directly; use `--help` or inspect helper source only after an actual helper error or contract mismatch.

The delimited request is immutable and caps product scope. Carry every explicit output, identifier, path, command, number, and example unchanged through Plan and Spec without renaming or paraphrasing it away. Evidence constrains delivery, not outcomes, and adds no work. Source result-changing behavior only from the request, decisions, or accessible authority; names, code, and model familiarity do not fill gaps. A gap is material only if choices change requested capability, compatibility, safety, privacy, data retention, or meaningful scope/cost—not material merely because implementation must fix a detail. Otherwise use the narrowest repository-consistent default without new requirements or acceptance. Leave only material gaps unknown and artifacts unready; return one blocker instead of guessing.

1. Load `<skill-root>/development-plan/SKILL.md` only if the Spec would otherwise invent outcome, scope, direction, or a material tradeoff. Review the Plan through `tenet-me/SKILL.md` as its stage contract requires.
2. Produce one authoritative Spec through its documented writer.
3. Load `tenet-me/SKILL.md` to resolve material gaps and ready the Spec with sufficient evidence for its completion conditions. Preserve user-required verification without fixing every implementation-time command.

Return only Plan path when present, Spec path/revision, readiness, `scope=verified-to-original-request`, or one material blocker in the parent-delivered agent result, not a user-facing report. No implementation, parallel assignments, or execution artifact generation.
```
