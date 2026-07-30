---
name: ui-design
description: "When creating or restyling a page, layout, component, or app UI (HTML/CSS/JS, React, Vue, Svelte, Astro) — commit to one aesthetic direction, then ship distinctive working code. Pass --brief for guidelines only."
allowed-tools: Read Glob Grep Edit Write
---

# UI Design

Frontend work without aesthetic commitment becomes generic. Decide the visual
point of view before coding, then make every typography, color, layout, and
motion choice serve it. Ship real working code — not a mood board.

Resist: generic SaaS defaults, asking before scanning, timid compromise styles,
component-library sameness, styled `<div>`s where real elements belong,
placeholder code that does not run.

- Scan first for product context and constraints: existing design system,
  tokens, CSS strategy, framework, content, audience, accessibility, and
  performance expectations. Respect an established system unless the user asked
  for a redesign.
- If direction is missing, ask at most three targeted questions: purpose/audience,
  brand or tone, and one memorable differentiator. Otherwise state reasonable
  assumptions and proceed.
- Commit to one named aesthetic direction: editorial, brutalist, luxury minimal,
  retro-futurist, art-deco, handcrafted, utilitarian, etc. One strong direction
  beats a safe blend.
- Define the mini-system before implementation: visual thesis, differentiator,
  display + body typography, 4-6 color variables, spacing/rhythm, layout
  strategy, and one meaningful motion/interaction moment.
- Build production-shaped code: semantic elements, headings/labels, responsive
  layout, tokenized CSS, focus states, keyboard navigation, legible contrast,
  and `prefers-reduced-motion`.
- Treat text overflow as a first-class maturity check: every grid/flex/card/table
  lane must have a deliberate shrink/wrap/truncate policy (`min-width: 0`,
  `overflow-wrap: anywhere`, ellipsis, or responsive reflow). Long account names,
  money values, file names, IDs, and labels must not bleed across adjacent cards,
  buttons, or columns.
- Make customization obvious with CSS variables, config objects, component
  boundaries, inline SVGs, or generated CSS patterns when assets are missing.
- Self-check before delivering: unmistakable aesthetic, expressive typography,
  cohesive palette, purposeful spacing, accessible interactions, and code that
  runs as provided.

Never default to: Inter/Roboto/Arial/system-ui/Space Grotesk/Geist/Satoshi;
purple-blue or pink gradients; SaaS blue `#3B82F6`; centered card stacks; hero +
three columns; `max-w-7xl mx-auto`; `rounded-xl shadow-md`; fade-in-everything.

Reach for distinctive alternatives when the repo allows it: serif display faces,
editorial scale contrast, grain/noise, asymmetry, grid breaks, deliberate
negative space, controlled density, unusual borders, masks, clip paths, and one
standout interaction instead of many small animations.

Deliver by default: running code with file paths plus a short direction statement
that names the aesthetic and the memorable choice. With `--brief`: provide only
the one-screen design brief, no code. Prefer the framework and styling approach
the repo already uses.
