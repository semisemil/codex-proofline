# Architecture memory decision templates

Read only when creating a new ADR. Write headings and prose in the manifest language. Replace every angle-bracket placeholder.

## `decisions/ADR-<number>-<slug>.md`

~~~markdown
# ADR-<number>: <Decision title>

- <Status>: proposed | accepted | deprecated | superseded
- <Decision date>: YYYY-MM-DD | unknown
- <Supersedes>: none | ADR-<number>
- <Superseded by>: none | ADR-<number>
- <Current document>: <Relative link showing the current effect>

## <Context>

<Conditions and constraints at the time.>

## <Decision>

<Direction chosen at the time.>

## <Consequences>

- <Positive or negative consequence>

## <Alternatives>

- <Alternative actually considered and why it was not selected>

## <Evidence>

- <User confirmation or repository-relative path and symbol>
~~~

Create the ADR, add `[ADR-<number>](ADR-<number>-<slug>.md)` to `decisions/README.md`, add a relative link from the affected current C4 or Context item back to the ADR rationale, and register the ADR in the manifest in the same write.

An accepted ADR's Context, Decision, Consequences, Alternatives, and Evidence are historical record. Later edits may change only Status, Supersedes, Superseded by, Current document, and clear typographical errors. A changed direction gets a new ADR whose `Supersedes` points to the old ADR; the old ADR's `Superseded by` points to the new one.
