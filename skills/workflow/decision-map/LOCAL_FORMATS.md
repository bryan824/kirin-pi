# Local decision-map format

```text
context/decision-maps/<effort>/
  map.md
  decisions/
    D01-<slug>.md
```

## Map

```markdown
# <Effort>

Status: mapping | ready-for-plan | superseded

## Destination

## Standing constraints

## Decisions

- [D01 — <title>](decisions/D01-slug.md) — <type> — blocked by: none | <IDs>

## Decisions so far

- [D01](decisions/D01-slug.md) — <one-line gist>

## Unresolved fog

## Out of scope
```

## Decision

```markdown
# DNN — <title>

Type: design | research | prototype
Blocked by: none | <stable IDs>

## Question

## Resolution

Status: open | resolved | out-of-scope

<Decision, consequences, and evidence links.>
```

Task/runtime state is intentionally absent from these files.
