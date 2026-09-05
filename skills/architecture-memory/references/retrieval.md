# Retrieval details

Run `skills/architecture-memory/scripts/memory.js` with Node. Every command needs `--project-root <project>`. It validates schema-v2 registration and searches registered Markdown locally; only output enters model context. There is no persisted search index, network request or query-time write. Local disk work still grows with the collection.

## Selection

`search --query "<domain terms>" [--path <path>]` ranks exact/related repository paths, headings, authored aliases and body matches. Repeat `--path` for multiple owners; paths are literal prefixes, not globs. Search is lexical, so use the project's vocabulary. The default page has five pointers; inspect `next_offset` only when the current candidates do not cover an affected responsibility. History requires `--history`; a required historical link can still accompany a current record.

`read --id <ID> [--id <ID>] --revision <search-revision>` returns whole level-2 sections, nested headings, document preambles, `always` records and transitive required links. With no candidates, `--id @global` reads shared constraints. A stale revision requires a fresh search; keep earlier evidence only if still unchanged.

## Reuse and bounds

Each section includes a `receipt`. While its full text and preamble remain in the current context, pass it as `--seen <receipt>` on later reads to omit unchanged evidence, including shared constraints. Changed content returns again; new prerequisites remain required. Never carry receipts alone across compaction or to another agent: the tool cannot know whether their evidence is still in context.

`complete: false` reports omitted IDs/sizes and `next_cursor`. Continue with the same IDs and original `--seen` set plus `--cursor <next_cursor>`; do not accumulate receipts for pages of one read. Keep preceding pages in context until completion. The cursor is valid only for the same corpus and selection; it is not evidence by itself. Continue only while acquiring needed evidence.

Search defaults to 6,000 JSON characters and read to 12,000; `--max-chars` accepts 1,500–32,000. For a single larger section, inspect its exact source range with shared preamble and prerequisites. A larger cap or whole-document dump is not a search fallback. If one section or its dependency graph exceeds the working context, identify the affected decision as unresolved; never silently drop conditions or call incomplete evidence complete. These are per-response limits, not a total task budget.

## Legacy and failures

Unannotated sections remain searchable as temporary `document-id@line` IDs, with missing status unclassified. Interpret their evidence before use and add stable routing only when maintaining them.

`check` validates readable registration, UTF-8, routing, unique IDs and required links, not truth, source agreement or ordinary Markdown links. All commands reject malformed metadata, missing registered files and broken links. The shared reader limits manifests to 256 KiB, documents to 2 MiB and the corpus to 32 MiB. Invalid registration is not an empty successful search. If the helper is unavailable, inspect the manifest and specifically relevant source sections under the same ownership/path rules; state the retrieval limitation when material.
