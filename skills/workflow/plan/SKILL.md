---
name: plan
description: "When approved work has consequential dependencies, risk, or handoff needs — organize outcomes, ownership, evidence, blockers, and rollback."
---

# Plan

Make execution constraints visible. A plan is useful structure, not a compulsory
step for every bounded request.

- Start from user intent and current contracts, not an imagined implementation.
  Read relevant decisions and evidence; surface contradictions or missing material
  choices before scheduling work that depends on them. Named future components
  are requested additions, not permission to repurpose unrelated APIs.
- Return the outline in the response unless the request clearly authorizes writing
  a planning file. An input document is not an implicit overwrite target. When
  persistence is authorized, reuse one suitable effort record. Include outcomes,
  exclusions, constraints, acceptance, risks and rollback; derive acceptance from
  the user's requirements, not convenient tests. A green baseline is not acceptance
  for new behavior; name the new check and how it reaches that behavior.
- Divide work by verifiable outcomes. Prefer a thin end-to-end slice across a risky
  boundary—a tracer bullet—before expanding whole layers, and name its observable check.
  If that slice must wait, explain the blocking dependency rather than leaving
  integration last by default. Name owned files or boundaries, prerequisites and
  evidence for each unit. Use stable keys where handoff needs them. Paths and short
  code may express a real contract.
- Only ready file-disjoint units may run concurrently through the active
  orchestration runtime. Serialize shared files/contracts and resolve integration
  ownership. A preparatory refactor or migration phase earns a unit only when it
  removes an actual execution risk.
- Keep intent and dependency structure here; use the runtime's claims and status
  rather than maintaining a duplicate execution store. Preserve exact run,
  worktree and artifact identities in handoffs when applicable. A failed delegated
  path stays blocked: changing model, CLI or moving its work to direct execution
  needs explicit authorization, not a shortcut in the plan.
- Make consequential choices and scope explicit for approval. Existing authority
  can cover equivalent implementation details; changed material intent requires
  an amendment, not silent adaptation. Open requirements need evidence, an
  explicit user-approved deferral, or a blocker. Proposed contract defaults remain
  proposals until approved; silence does not settle a dependency.

[PLAN_TEMPLATE.md](PLAN_TEMPLATE.md) is an optional starting point, not a required
file location or output quota.

Deliver: intent source, ready work, ownership, verification and rollback. Planning
does not authorize implementation, commits, deployment, or a delegation-protocol
switch.
