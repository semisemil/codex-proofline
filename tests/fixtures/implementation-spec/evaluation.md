# Spec behavioral evaluation

Use cases.json to materialize each case in an isolated temporary project. Give the evaluator only that case's request and raw files, the skill path, and the plugin root. For lifecycle, deliver requests in order, retaining each intermediate artifact. Isolate writer registration with a temporary APPDATA (Windows) or XDG_CONFIG_HOME (other systems). Record artifacts, tool actions, questions, and write/registration results outside the repository. Do not provide this rubric to the evaluator.

Evaluate meaning, not headings or layout. Across cases: concise Korean key-fact phrasing, no product edits, source identifiers and constraints preserved, free body structure, and no adjacent requirements. Record actual evidence and limits; a prompt-text match is not a behavioral pass.

| Case | Required observations |
| --- | --- |
| feature | ready; case-sensitive containment, empty query, order, no persistence; no unnecessary decision questions or prescribed helper architecture |
| bug | ready; size 0 yields []; positive integer behavior retained; one required regression test; negative/noninteger scope not added |
| decision | ask about material deletion/retention/recovery behavior; no invented policy or ready document before resolution; draft may record known intent |
| reread | inspect validate/persist in the already-excerpted file; preserve id/label and label-required failure; saved: true only on success |
| lifecycle | first change revision 2 plus exact revision-1 snapshot; repeated request no write/snapshot/revision; heading-only edit operational revision 2; missing completion evidence leaves status unchanged; preserve identity and visible-items anchor throughout |

After fixes, repeat affected cases only. Keep automated schema/writer tests separate from this evaluation.

## Observed run — 2026-09-06

Five cases completed with independent fresh-context evaluators; actual artifacts inspected by the main agent. Feature and bug: ready revision 1, required behavior and evidence retained. Decision: draft revision 1 and unanswered retention/recovery question. Reread: ready revision 1 after inspecting validate/persist, preserving id/label and label-required behavior. Lifecycle: major revision 2 with an exact revision-1 snapshot, repeated-request no-op, operational heading edit at revision 2, then completion withheld without evidence. All raw product files unchanged.

An initial trial exposed drafting-operation remarks inside contract bodies. Added one instruction separating reports from the contract and repeated the four authoring cases; final bodies satisfied it. One initial lifecycle fixture contained an invalid extra metadata key; corrected the input to the existing schema and reran in a fresh project, without changing the parser or writer.

Artifacts: authoring cases under `C:/Users/semif/AppData/Local/Temp/proofline-spec-final-at_j08rv`; lifecycle and step copies under `C:/Users/semif/AppData/Local/Temp/proofline-spec-lifecycle-ateg4g5u`. Registration isolated under each case's config directory. These temporary paths are run evidence, not fixture dependencies.

Automated validation: skill validator passed; npm test passed 238/238; after final prompt refinement, affected tests passed 29/29. Prompt measurement with o200k_base: original 1,800 tokens; final SKILL.md 837 plus document operations 489 = 1,326, a 26.3% reduction including the reference. These finite trials do not establish a model-wide success rate.
