# Architecture memory component templates

Read for initialization or when adding the first or another selected C4 L3 document. Write headings and prose in the manifest language. Omit conditional sections when empty. Replace every angle-bracket placeholder.

Unmarked content means `confirmed/current`. Put exceptional state and evidence beside the affected content. For a table row, put a keyed annotation immediately below that table.

## `components/README.md`

~~~markdown
# <Components>

| <Container> | <Document> | <Why L3 is needed> |
|---|---|---|
| <Container> | [<Component document>](<container-slug>.md) | <Why L3 is needed> |
~~~

## `components/<container-slug>.md`

~~~markdown
# <Container name> <components>

## <Scope>

- <Container>: `CNT-<number>`
- <Why L3 is needed>: <Responsibility or risk boundary not explained at L2>

## <Components>

| ID | <Component> | <Responsibility> |
|---|---|---|

## <Relationships>

| <From> | <To> | <Interaction> |
|---|---|---|

## <Diagram>

```mermaid
<Optional C4 L3 relationships from the tables>
```

## <Open questions>

- <Question> — `unknown/current` — <Evidence needed>
~~~

When creating the first L3 document, create `components/README.md`, add its conditional row to the architecture `README.md`, and register both documents in the manifest. Later L3 documents update the component index and manifest in the same write.
