---
name: frontend-motion
description: "When deciding whether a frontend interaction benefits from motion, or designing or reviewing state, enter/exit, and gesture motion — make movement purposeful, continuous, accessible, and economical."
---

# Frontend Motion

**Motion earns its frames.** Preserve orientation, causality, and direct control;
when they do not improve, prefer no motion.

- Give every motion a purpose—feedback, state indication, orientation,
  explanation, or a bridge across a jarring change—and gate its prominence by
  frequency. Repeated, keyboard, and task-focused interactions need the most
  restraint; delight belongs only where it will not delay work.
- Keep state, enter, and exit motion spatially and causally continuous. Match a
  transform origin to the source when one exists, preserve an object's path and
  identity, and make a reversal or interruption begin from what is visibly on
  screen.
- Choose CSS transitions for explicit, retargetable property changes; use
  keyframes only for bounded authored sequences; use gestures and springs when
  input, velocity, or interruption determines the result. Name every
  transitioned property exactly.
- Treat direct manipulation as a conversation: track the pointer live, retain
  its grab offset, capture it through release, and choose the endpoint from
  position and release velocity rather than a discontinuous snap.
- Hand off a usable reduced-motion path with `frontend-accessibility`, and
  profile motion before trading rendering cost for decoration. Read
  [references/REFERENCE.md](references/REFERENCE.md) for mechanics and the
  compact vocabulary.

For focused motion review, hand evidence and findings to the
[shared review contract](../frontend-design/references/REVIEW.md); use its schema
rather than creating one here.
