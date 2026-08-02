---
name: project-memory
description: "When a repository needs durable agent-readable context — initialize or check a minimal docs/context memory split, creating only paths current work needs."
---

# Project Memory

Keep current truth in Git and working records out of it.

Read `PROJECT_MEMORY.md`, then run the co-located helper:

```bash
bun skills/maintenance/project-memory/scripts/project-memory.cjs check --root <repo>
bun skills/maintenance/project-memory/scripts/project-memory.cjs init --root <repo>
```

The helper creates only `docs/memory.md`, `docs/verification.md`, and the root gitignore entry for `context/`. Skills create record or substrate paths lazily when they have real content.

Do not migrate, concatenate, or rewrite existing docs automatically. Report legacy or unknown memory roots for a human decision. Preserve current documentation and repository conventions.

Deliver: state (`absent`, `detected`, or `adopted`), created paths, detected roots, and any decision the user must make.
