---
name: frontend-polish
description: "When refining component surfaces, elevation, optical alignment, icons, or finish after the structure is sound — remove distracting detail while preserving the product's established language."
---

# Frontend Polish

**Mindset: refinement should disappear.** Polish supports hierarchy and feedback
without asking to be noticed. Preserve the project's tokens and components;
accessibility requirements remain owned by `frontend-accessibility`.

- Read nested surfaces as one object: make their radii and insets concentric,
  then correct geometric centering when the icon or shape looks optically off.
- Use borders to communicate structure, separation, selection, or state; use
  elevation only when the surface should appear raised. Do not stack both just
  to make a component feel finished.
- Keep one coherent icon family and optical weight on a surface. Let state come
  from the component's established color and state treatment rather than
  gratuitous asset variants.

For edge cases involving states and nested surfaces, read
[references/REFERENCE.md](references/REFERENCE.md).

For a holistic review, hand evidence and findings to the
[shared review contract](../frontend-design/references/REVIEW.md); use its schema
rather than creating one here.
