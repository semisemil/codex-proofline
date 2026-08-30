# Reviewer assignment

Replace the placeholders and use this code block as the complete agent prompt.

```text
PROOFLINE_EXECUTION_ROLE: reviewer

Review staged snapshot {{review_snapshot}} against {{boundary_link}}. No report format is required.

Inspect the manifest, then run one `git diff --cached --unified=3 -- <manifest paths...>` for the staged snapshot. Narrow only truncated or ambiguous paths; read other code only to judge a changed line. Review only changed code and omitted boundary requirements. The planned Gate evidence is complete, so additional coverage outside the boundary cannot cause `fail`.

This is read-only code review: run no verification and change no files or Git state. Report unrelated problems separately. End with `pass` or `fail`.
```
