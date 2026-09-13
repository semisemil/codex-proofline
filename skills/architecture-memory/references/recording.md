# Record durable context

Preserve information that affects future project decisions, with its original source, scope, conditions, exceptions, and confidence/lifecycle. Code proves observed structure, not motives; an accepted target is not evidence of implementation. A user's operating fact needs attribution, not another approval round. Preserve meaningful uncertainty and reconsideration conditions.

Reuse the canonical section or search the concept before adding one. Each independently useful item belongs in a routed level-2 section under [record format](record-format.md). Keep its reasons and limits together. Detailed contracts remain in their Design; link them rather than copying their requirements.

## Patch relevant sections

After the Design writer establishes a connection, or in an already connected ordinary project conversation, patch once per settled decision or meaningful work boundary. Read-only/no-memory instructions suppress writes. No durable change means no patch.

Use the `receipt` returned by `memory.js read` as the expected value for each existing section. For a new section use `expected: null`. Send only changed sections on stdin:

```text
node <skill-root>/scripts/record.js patch --project-root <project> --document <registered-document-ID>
```

```json
{"edits":[{"id":"AM-example","expected":null,"text":"## Topic\n<!-- am: {\"id\":\"AM-example\"} -->\n\n**confirmed/planned**\n\nAccepted target with its actual source, scope, reasons and conditions.\n"}]}
```

The example is format guidance, not project evidence. Use `text: null` to retire a resolved temporary section only when its reasons need not remain. Replacement decisions preserve historical reasons and supersession as appropriate.

For a new document add `--path <relative-markdown-path> --kind <manifest-kind>` with a unique `--document` ID. The helper merges registrations, validates the prospective collection, preserves document verification fields and Git checkpoint, and checks receipts before publication. Concurrent changes to the same section require rereading that section and reconciling; independent section changes are retained. A publication journal is resumed before another patch and never bypassed by direct overwriting.

For related changes across documents, omit `--document` and send `{"documents":[{"document":"context","edits":[...]},{"document":"adr-001","path":"decisions/ADR-001-choice.md","kind":"decision","edits":[...]}]}`. The helper validates their combined links before publishing any file. A document item may include `"intro":{"before":"<exact trimmed current preamble>","after":"<replacement preamble>"}` for its title or allowed ADR lifecycle fields; use `before: null` for a new document and `edits: []` for an introduction-only change. Preserve accepted ADR history. Interrupted publication blocks retrieval and init/update until `record.js ensure --project-root <project>` resumes it; external edits are preserved on conflict.

During init/update, edit the returned operation draft and let `apply` validate/publish it. For ordinary capture use this patch helper, not a direct document overwrite followed by a structural check. A failed patch leaves the recording result unresolved; it does not invalidate separately successful work.

Load [base templates](base-templates.md) only for a requested structural survey, [component templates](component-templates.md) when a responsibility requires L3, or [decision templates](decision-templates.md) for a consequential explicit choice with rationale. Existing ADR history remains immutable except its allowed lifecycle links. Keep registered relationships coherent and retire obsolete effects without erasing their material reasons.
