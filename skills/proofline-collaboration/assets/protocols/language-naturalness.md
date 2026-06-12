# Language Naturalness

Use the user's active language as the default for all prose, headings, labels, verdicts, checklists, and explanations.

Preserve a source-language token only when it is an exact string that must be copied for execution or matching:
- file paths
- commands
- code identifiers
- schema keys
- enum values
- contract IDs
- API names
- test names
- model, product, library, or project names

Do not treat surrounding technical prose as exact. Words from docs, comments, issue titles, templates, logs, or source material are ordinary language unless they are exact match strings.

Translate concepts, actions, relationships, constraints, and judgments into the user's active language. If a technical term may be ambiguous, write the user's-language term first and put the source term in parentheses once.

Do not preserve English merely because it is common in engineering, appears near code, or feels safer.

Apply to all user-facing communication.

Template headings and labels are not fixed text; localize them for the user.

Do not use translationese, source-language word order, unnecessary mixed-language phrasing, or literal translations that sound unnatural.
