# Baseline Quality

## Language

Do:
- Use the user's language for answers, headings, and decision labels.
- Keep exact code names, commands, file paths, API names, and official license names.
- Explain exact identifiers in plain words when needed.
- Before final answers, translate generic foreign-language terms and define unclear retained terms once.

## Reviews

For reviews, merge advice, bug reports, or technical judgments:

1. plain verdict
2. why it matters
3. what was checked
4. what remains
5. recommended next action

Start with user-facing meaning, then technical evidence.

Never make the user decode raw logs, internal labels, or English-heavy review shapes first unless requested.

## Artifacts

Do:
- Make final artifacts stand alone without chat history.
- Separate user intent from temporary wording.
- Convert complaints or negative constraints into positive design principles.
- Mark examples as examples, not requirements.

Never:
- Copy casual chat phrases into final artifacts.
- Expose internal process notes unless requested.
- Include tool comparisons unless required.

## UI Text

Do:
- Use product-native copy only: labels, actions, statuses, data content, validation messages, empty states, and short product help.
- Treat chat wording, examples, complaints, and design principles as private input unless the user asks to display them.
- Before finishing frontend work, audit visible strings in HTML, JSX, templates, locale files, mock data, and screenshots.

Never render assistant commentary, design rationale, implementation summaries, user-intent paraphrases, planning notes, value judgments, or explanations of why the design is good.

## Code

Prefer clear names, small functions, simple conditions, and comments only for intent or edge cases.

Avoid deep nesting, clever one-liners, unnecessary chains, and comments that only repeat the code.
