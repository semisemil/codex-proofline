# Architecture memory base templates

Use the manifest language. Replace every angle-bracket placeholder and omit empty conditional sections or rows.

Use [recording](recording.md) for section routing and evidence. Mark confidence and lifecycle explicitly; unmarked existing content is unclassified. For mixed structural tables, put each exceptional state and its evidence beside the affected row. Keep a section's conditions and exceptions together.

## `README.md`

~~~markdown
# <Architecture>

<One paragraph describing the system and this document set.>

<Brief legend explaining explicit confidence/lifecycle and attributed evidence; missing state is not confirmation.>

## <Document map>

| <Document> | <Contents> |
|---|---|
| [<System context>](01-system-context.md) | <Purpose, boundary, external relationships> |
| [<Containers>](02-containers.md) | <Runtime and storage units> |
| [<Components>](components/README.md) | <Selected component boundaries; include only when L3 documents exist> |
| [<Architecture context>](04-context.md) | <Goals, constraints, qualities, plans, risks> |
| [<Decision records>](decisions/README.md) | <Historical architecture decisions> |

## <Find relevant context>

<Use the system context for orientation; for a concrete task search its topic or code path and read the selected sections. Follow related ADRs when the rationale matters.>

## <Unknown areas>

<Point to Open questions sections; do not duplicate them.>
~~~

## `01-system-context.md`

~~~markdown
# <System context>

## <Purpose and boundary>

<Problem, value, included scope, excluded scope.>

## <People>

| ID | <Person or role> | <Need> |
|---|---|---|

## <System of interest>

| ID | <System> | <Responsibility> |
|---|---|---|

## <External systems>

| ID | <System> | <Relationship> |
|---|---|---|

## <Relationships>

| <From> | <To> | <Interaction> |
|---|---|---|

## <Diagram>

```mermaid
<C4 L1 relationships from the tables>
```

## <Open questions>

- <Question> — `unknown/current` — <Evidence needed>
~~~

## `02-containers.md`

~~~markdown
# <Containers>

## <Containers>

| ID | <Container> | <Responsibility> | <Runtime or technology> | <Data> |
|---|---|---|---|---|

## <Relationships>

| <From> | <To> | <Interface or data flow> |
|---|---|---|

## <Diagram>

```mermaid
<C4 L2 relationships from the tables>
```

## <Open questions>

- <Question> — `unknown/current` — <Evidence needed>
~~~

## `04-context.md`

~~~markdown
# <Architecture context>

## <Goals>

- <Goal that directly affects architecture>

## <Constraints>

- <Condition that limits architecture choices>

## <Operating environment>

<Actual users, physical setting, devices, connectivity, and operating procedures that affect design. Attribute conversation facts and distinguish unknown conditions. Split independent constraints into titled level-2 records with their own scope and evidence.>

## <Quality criteria>

- <Performance, security, reliability, operability, or another decision criterion>

## <Architecture principles>

- <Principle guiding repeated structural choices>

## <Domain terms>

| <Term> | <Definition> |
|---|---|

## <Plans and assumptions>

### <Plans>

- <Accepted target state> — `confirmed/planned`

### <Assumptions>

- <Unverified premise> — `inferred/current` — <Evidence or confirmation needed>

## <Risks>

| <Risk> | <Impact> | <Response> |
|---|---|---|

## <Open questions>

| <Question> | <Evidence needed> |
|---|---|
| <Question> — `unknown/current` | <Evidence needed> |

## <Related plans>

- <Relative link to a detailed project Plan>
~~~

Keep only architecture-affecting summaries. Link detailed product plans instead of copying them.

## `decisions/README.md`

~~~markdown
# <Architecture decisions>

| ADR | <Decision> | <Status> | <Current document> |
|---|---|---|---|
~~~

Register kinds: `README.md` as `index`, `01-system-context.md` as `system-context`, `02-containers.md` as `containers`, `04-context.md` as `context`, and `decisions/README.md` as `decision-index`.
