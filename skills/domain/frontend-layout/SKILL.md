---
name: frontend-layout
description: "When shaping or reviewing a frontend's spatial structure—grouping and aligning content, setting reading order, adapting a component to its container, or keeping a layout intact under RTL and localization stress."
---

# Frontend Layout

**Make structure survive stress.** Space, shared edges, and source order should
still explain the interface after content grows, direction changes, or a lane
narrows; decoration cannot repair a broken relationship.

- Group related material with proximity, align it to a small set of shared
  logical edges, and keep DOM order aligned with reading and interaction order.
  Demote secondary detail through a visible progressive-disclosure cue rather
  than hiding its existence.
- Let content set adaptive breakpoints. Prefer container-driven adaptation for
  components; preserve the established density and use safe-area-aware stable
  chrome when controls meet a viewport edge.
- Treat leading/trailing as directional: use logical properties and test RTL;
  reserve physical sides for genuinely physical geometry. Leave room for
  translation and content growth instead of sizing lanes for their English copy.
- Give every flex, grid, card, table, and control lane a shrink/reflow contract.
  Stress narrow lanes with long localized names, money, IDs, and labels: content
  must not bleed into an adjacent lane or hide a critical action. Layout owns
  the lane; `frontend-typography` owns the text policy within it.

For selected edge cases, read [REFERENCE.md](REFERENCE.md). For a holistic
frontend review, contribute layout evidence to the
[shared review contract](../frontend-design/references/REVIEW.md); it owns the
consolidated review.
