# UI Text and Information Design

- Start from the intended user's knowledge, goal, task, and decision at each screen. Follow the product's established design system, platform conventions, terminology, and voice when they exist. Omit internal schemas, migrations, compatibility paths, implementation history, interface narration, intent paraphrases, design rationale, implementation summaries, planning notes, value judgments, and irrelevant context.

- Treat text as part of the information architecture. Put task- and decision-critical information first; use descriptive headings and labels; group related labels, values, states, and actions; keep corresponding information in the same order across repeated components; and preserve meaningful reading and task order across responsive layouts.

- Let layout, labels, values, states, and actions carry meaning. Add text only when it identifies content, distinguishes options, supplies a requirement, prevents an error, explains a state, clarifies a consequence, or gives a necessary next step. Put required guidance and consequences next to the relevant control or decision. Use progressive disclosure only for secondary details, and do not hide task-critical information in placeholders, tooltips, or detached help text.

- Use the shortest natural expression that preserves the needed meaning. Do not force all UI text into sentences or fragments. Match the form to the role: use concise topic or task names for headings and labels, expected outcomes for actions, clear terms for states, and complete sentences for explanations only when they add necessary context.

- Keep peer UI slots parallel. Repeated headings, cards, steps, actions, and states that serve the same role must use the same information type, grammatical form, tone, punctuation, and terminology. Different roles do not need to share one form.

- Write in the intended language's natural whole expressions and established product terms. Do not preserve source-language syntax, rhetorical templates, idioms, slogan formulas, or mixed-language phrasing. Do not translate multiword terms piece by piece or invent poetic or promotional fragments. Preserve official names, identifiers, lookup terms, and established product vocabulary exactly when their original form matters.

- Label actions by what they do or what happens next. Use the same label for the same function, distinguish materially different outcomes, and do not explain a clear action label again in nearby text. For errors, empty states, blocked states, and consequential actions, state the relevant condition and the available correction, alternative, consequence, or next step without blame.

- Use icons when they materially improve recognition, scanning, hierarchy, status distinction, or action discovery. A familiar icon may stand alone when its meaning is unambiguous in context and it has an accessible name. Pair an icon with visible text when the text materially improves precision, discoverability, learnability, or safety. Do not add a visible label merely to restate an already clear icon, remove a meaningful reference icon merely because nearby text conveys the same literal meaning, or replace a semantic icon with a sequence number unless sequence is the intended meaning. Keep peer icons stylistically consistent.

- Do not rely only on color, shape, position, direction, or visual proximity to convey identity, order, state, instructions, or consequences. When both exist, keep visible labels and accessible names consistent. Preserve meaningful relationships in the reading order, and make dynamic status changes available without unnecessary interruption.

- On a marketing or conversion surface already in scope, keep claims specific and supportable, and place relevant evidence, conditions, costs, and risk-reducing information near the claim or decision they qualify. Do not add marketing copy to task-oriented UI or invent urgency, scarcity, social proof, guarantees, or results.

- Audit visible HTML, JSX, templates, locale files, mock data, and screenshots in context. Review sibling strings and responsive, loading, empty, error, success, blocked, and disabled states. Remove repeated meaning, inconsistent slots, unnecessary sentence scaffolding, and target-language wording that reads as a literal translation.
