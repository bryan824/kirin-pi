---
name: project-memory
description: "When a repository needs durable agent-readable context — initialize or check a minimal docs/context memory split, creating only paths current work needs."
---

# Project Memory

Keep current truth in Git and working records out of it. Read [PROJECT_MEMORY.md](PROJECT_MEMORY.md).
Resolve `SKILL_DIR` to the directory containing this loaded skill before invoking
its helper, rather than assuming a checkout layout:

```bash
bun "$SKILL_DIR/scripts/project-memory.cjs" check --root <repo>
# Only when initialization is authorized:
bun "$SKILL_DIR/scripts/project-memory.cjs" init --root <repo>
```

Check is read-only. Init creates only required current docs and an effective
root ignore for `context/`; tracked records remain tracked and must be reported,
not automatically removed from the index. A non-Git directory cannot be certified
ignored. Inspect existing path ownership and conventions before initializing.

Do not migrate, concatenate or rewrite existing docs automatically. Report
unknown/legacy roots or ambiguous symlinks for a human decision. Other paths are
created lazily when authorized work has real content for them.

Deliver: observed adoption state, created paths, privacy/ignore evidence, and
remaining decisions. A marker alone is not proof of a complete or private substrate.
