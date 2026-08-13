---
name: plan
description: "Turn approved design or a completed decision map into one approved implementation plan with contracts, test seams, stable work units, and blockers."
disable-model-invocation: true
---

# Plan

Compile settled intent; do not restart discovery.

Accept either an explicitly approved design or a `decision-map` marked `ready-for-plan`. Read every linked decision and evidence record, plus current code/contracts needed to validate claims. Surface contradictions instead of choosing silently.

Write one `context/plans/<slug>.md` using `PLAN_TEMPLATE.md`:

- goal and non-goals
- resolved decisions and evidence links
- contracts, invariants, acceptance scenarios, and test seams
- risks and rollback
- stable work-unit IDs with outcomes, blockers, owned files, and verification

Keep work units vertical and independently verifiable. For wide migrations use expand → migrate → contract. Name overlapping file ownership; overlapping units must serialize. Where a unit would be easier after a preparatory move, sequence that prefactor as its own earlier unit — make the change easy, then make the easy change.

State each unit as the end-to-end behavior it delivers rather than a layer-by-layer edit list, and keep code snippets out; they go stale faster than the plan. The exception is a snippet from `prototype` that encodes a decision more precisely than prose can — a state machine, reducer, schema, or type shape — trimmed to the decision-rich part and marked as the prototype's verdict.

Markdown owns intent and dependency structure only. Do not record mutable claims, retries, owners, or completion status in the plan; host task/runtime tools own execution state.

The file starts `Status: DRAFT`. Audit every source decision and placeholder, then present the whole plan. Only explicit approval changes it to `Status: APPROVED`.

If implementation reality contradicts the plan, stop and amend the plan. Do not silently adapt.

Deliver: approved plan path, ready work-unit frontier, test seams, and next route (`implement` for one unit, `parallel-work` only for ready file-disjoint units). Stable runtime work keys equal plan unit IDs. Stop.
