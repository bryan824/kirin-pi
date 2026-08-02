---
name: design
description: "Before building or when asked to stress-test an idea — map the decision tree, batch-interview the frontier, and resolve goals, non-goals, contracts, and one explicitly approved direction."
---

# Design

Turn fuzzy intent into a boring, rebuildable design through structured frontier-batch interviewing — and stop before code implementation.

## 1. Fact-Lookup First (Evidence over Asking)
Explore current code, docs, contracts, and git history before asking questions. Classify every unknown:
- **Discoverable Facts**: Look up in the repo/docs. Never ask the user what the codebase already answers.
- **Design Choices**: Material trade-offs and product decisions that belong to the user.

## 2. Decision Tree & Frontier-Batch Interviewing
Conceptualize the task as a **Design Tree** where upstream decisions branch into downstream consequences.

Work the tree in **Frontier Rounds**:
- The **Frontier** contains every decision whose prerequisites are settled (questions unblocked *now* without guessing).
- **Batch the Frontier**: Ask all unblocked frontier questions in **one numbered round**.
- For each question:
  - Provide 2–3 concrete options.
  - Highlight a **Recommended Default** with brief rationale so the user can easily respond (e.g., *"1: A, 2: default, 3: B"* or *"Approve defaults"*).
- As the user answers, update settled nodes, collapse resolved branches, and push the frontier outward to the next tier of unblocked questions.

## 3. Scope & Domain Locking
- **Measurable Goals**: Reframe vague asks into testable metrics ("faster" → latency target).
- **Non-Goals List**: Explicitly state what is *not* being built. Half of misalignment is silent disagreement on non-goals.
- **Domain Terms**: Align with existing project vocabulary; challenge overloaded or conflicting names.
- **Edge-Case Stress-Testing**: Test relationships with concrete data scenarios rather than abstract hand-waving.

## 4. Contracts, Invariants & Seams
- Define public contracts, data models, error modes, and test seams *before* implementation.
- Identify the **most fragile assumption** ("This design assumes X; if X breaks, Y"). Deform the design to survive load-bearing failures.
- **Routing Boundaries**:
  - Structural overhaul/rethink → route to `architecture`.
  - Single runnable uncertainty → route to `prototype`.
  - Multi-session decision tree too large for one session → route to `decision-map`.

## 5. Strict Approval Gate
Before seeking approval, present a concise **Design Summary**:
- Goals & Non-Goals
- Resolved Frontier Decisions & Assumptions
- Contracts, Invariants & Test Seams
- Rejected Alternatives

Approval is an explicit **"YES"** to the complete presented design. Silence, "whatever you think", or "sounds good" is NOT approval — re-ask with concrete choices.

## 6. Exit Routes
- Single bounded outcome → `implement`
- Multi-context implementation → `plan`

Deliver: explicitly approved design summary, contracts/test seams, fragile assumptions, and exact next route. Do not write code, scaffold files, or generate parallel planning artifacts.
