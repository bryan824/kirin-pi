---
name: design
description: "Before building or when asked to stress-test an idea — resolve goals, language, non-goals, contracts, trade-offs, and one explicitly approved direction."
---

# Design

Turn fuzzy intent into a boring, rebuildable design. Stop before implementation.

Read current code, docs, contracts, and vocabulary first. Facts come from evidence; material choices stay with the user.

Maintain a decision frontier: open decisions, blockers, facts needed, and assumptions. Ask the highest-leverage unblocked question with a recommendation. Bundle independent questions only when answering one cannot change the others.

Pin:

- goal and measurable acceptance
- non-goals
- domain terms and ownership
- contracts and invariants
- error and edge-case behavior
- testing seams
- risks, rollback, and fragile assumptions

Use concrete scenarios to expose vague concepts and relationship boundaries. Surface contradictions between requested behavior and current code instead of choosing silently.

Propose alternatives only when the choice matters. Lead with the simplest direction that meets the goal; reject speculative flexibility. Route structural target questions to `architecture` and one runnable uncertainty to `prototype`.

Think in vertical outcomes. Name likely file-ownership conflicts, but leave stable work-unit IDs and blocker edges to `plan` when multiple contexts are needed.

Before approval, summarize resolved decisions, assumptions, rejected alternatives, and remaining branches. Approval is explicit agreement to the complete direction; silence or “whatever you think” is not approval.

Exit:

- one bounded outcome → `implement`
- multi-context implementation → `plan`
- decision route too large for this session → `decision-map`

Deliver: explicitly approved direction, evidence and assumptions, contracts/test seams, and exact next route. Do not edit code or produce parallel planning artifacts.
