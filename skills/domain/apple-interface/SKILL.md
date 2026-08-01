---
name: apple-interface
description: "When explicitly asked for an Apple-style, iOS/macOS-like, or Apple design-language web interface — apply its direct, restrained interaction delta."
---

# Apple Interface

**Make the interface feel held, not performed.** Direct manipulation answers at
once, preserves spatial continuity, and settles without taking control away.

- Load `frontend-motion` for gesture mechanics. Apply only the Apple delta:
  feedback begins on contact, manipulated controls feel attached to input, and
  the system yields immediately when intent reverses.
- Keep navigation and disclosure inside a stable spatial metaphor;
  `frontend-layout` owns its structure and `frontend-motion` owns its paths.
- Use translucent material as functional hierarchy: quiet structural chrome can
  recede while a focused control comes forward. Keep materials restrained; they
  should clarify depth rather than turn every surface into glass.
- Prefer platform typography and let its scale adapt to the person's settings.
  Offer preference-aware alternatives to translucency and contrast treatments;
  [frontend-accessibility](../frontend-accessibility/SKILL.md),
  [frontend-layout](../frontend-layout/SKILL.md),
  [frontend-typography](../frontend-typography/SKILL.md),
  [frontend-color](../frontend-color/SKILL.md), and
  [frontend-motion](../frontend-motion/SKILL.md) own their respective rules.
- Read [the focused mechanics](REFERENCE.md) when implementing a gesture,
  material, or type treatment that must carry this style.

For a holistic review, contribute evidence through
[frontend-design's shared review contract](../frontend-design/references/REVIEW.md);
do not create a style-specific review schema.
