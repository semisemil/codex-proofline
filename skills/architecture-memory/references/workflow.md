# Workflow commands and recovery

Run the installed `skills/architecture-memory/scripts/workflow.js` with Node. Every command needs `--project-root <absolute-project-root>`. For a custom root, add `--root docs/<name>` until initialization writes the project binding. Helpers read code from a captured commit and store work under `<root>/.architecture-memory/work/`; this work directory is recovery data, not architecture evidence or a transcript archive.

| Command | Output / purpose |
| --- | --- |
| `init [--root docs/name] [--language ko]` | Start/resume baseline draft; complete existing collections need only connection refresh |
| `update` / `status` | Start/resume reconciliation / inspect its compact state |
| `inventory [--prefix dir/] [--offset N] [--limit N]` | Directory counts, or paged captured paths |
| `changes [--prefix dir/] [--offset N] [--limit N]` | Pending change page and directory counts |
| `source --path file [--diff] [--offset N] [--limit N]` | Captured source or diff; zero-based continuation offset |
| `classify --path file\|--prefix dir/ --effect none\|architecture --reason "..."` | Persist one conclusion for matched changed paths; return counts |
| `apply` | Validate draft, publish, checkpoint and finish |

Paths are literal repository-relative paths; prefixes denote directories with a trailing `/`. Inventory pages default to 30 entries/5,000 JSON characters. Source defaults to 80 lines/8,000 text characters; `next_offset` exposes remaining content. CLI output has a 12,000-character envelope. These limits bound one response, not a whole task. Reuse unchanged evidence; read a continuation only for a specific unresolved claim. Oversized single lines require a suitable extractor against that exact captured source, not a whole-file dump.

## Recover the pending operation

`draft` keeps live documents unchanged. Correct the reported draft problem, reuse other evidence/classifications, and rerun `apply`. Publication begins only after baseline, routing and before-image checks. Registration validation cannot establish truth or complete architectural analysis.

`applying` has a saved publication journal. Rerun `apply`: already-written files are recognized, remaining writes resume, and unexpected external edits stop publication without overwriting them. Retrieval is unavailable until completion. Multiple files are not a filesystem-atomic transaction: a crash may leave mixed files, including a written checkpoint, but the unfinished journal remains authoritative. Never report that state as completed or delete its journal to bypass a conflict.

On an external-edit conflict, preserve the edit. Reconcile the specifically reported file and pending draft/journal with its author or current authorized scope; unrelated work need not stop. A journal is not permission to overwrite someone else's content. Do not reset, stash or clean the user's worktree to resume.

For init without a committed source, a changed observed file requires `source --path <path> --refresh` and reconciliation of that file's claims. Added/deleted files require `inventory --refresh` and review of the affected responsibilities. These commands apply only to uncommitted draft evidence. A committed operation stays pinned; a later update covers later commits.

An occupied unregistered architecture root requires a separately scoped integration or an empty custom root. Ambiguous/invalid registrations are not automatically migrated. Existing explicit instructions that prohibit enabling memory remain in force.

## Connection

Successful init writes only the relative root to `.proofline/architecture.json` and removes the old marked architecture-memory block from `AGENTS.md`, preserving other instructions. The hook resolves the currently installed skill, emits no model context before opt-in, and deduplicates the pointer per agent/session until context reset or connection change. Keep the binding and published documents in version control; the helper excludes its recovery work directory with a local `.gitignore`. No startup hook initializes memory or analyzes code. Hosts without these hook events require explicit skill use.
