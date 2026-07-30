---
name: architecture
description: "When structure is the problem — improve an existing architecture without changing its goals, or rethink it from first principles when the user explicitly asks."
---

# Architecture

Choose a better system shape before designing implementation details. No edits.

First name the posture:

- **Improve** — preserve product goals, domain language, public contracts, and accepted constraints.
- **Rethink** — challenge inherited constraints and propose a bold target only when the user explicitly asks for an overhaul.

For either posture:

- Read current docs, contracts, tests, consumers, and recent friction before judging structure.
- Separate real constraints from inertia. Public promises, persisted data, compliance, and explicit user direction are real; internal callers and stale layouts are movable.
- Judge interfaces by what callers must know versus behavior hidden behind them. Deep does not mean monolithic; private seams are fine.
- Apply the deletion test: if removing a layer removes complexity, delete it; if complexity leaks into callers, deepen the boundary.
- Add a seam only where something truly varies. One adapter is usually indirection; two real implementations make a boundary.
- Prefer a change proven through one behavior seam. Relocated complexity is not improvement.

For **Improve**, rank evidence-backed candidates by leverage versus blast radius and recommend one.

For **Rethink**, produce a target model, a kill list, assumptions, and falsifiers. Keep inherited pieces only when evidence says they still earn their place.

Compare alternatives only when the interface choice matters. Lead with the recommendation and name the fragile assumption.

Deliver: posture, current constraints, recommended architecture, what disappears, contract/test impact, risks, and next step (`design` for unresolved behavior choices, otherwise `plan`). Stop before implementation.
