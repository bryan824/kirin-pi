---
name: agents-md
description: "When the user explicitly asks to create or repair repository agent instructions — build a minimal AGENTS.md and canonical CLAUDE.md import."
disable-model-invocation: true
---

# AGENTS.md

Build the smallest useful always-loaded map of the repository, not a generated handbook.

1. **Inspect before proposing.** Target the repository root unless the user names a package or subtree. Inspect the path type and content of both `AGENTS.md` and `CLAUDE.md` before proposing any change. A directory at either path is a blocker. Read symlink targets for evidence, but never write through either symlink. Then read the README, manifests, lockfiles, scripts, CI configuration, linked docs, and nested instruction files needed to establish current truth; do not infer commands or conventions from ecosystem defaults.
2. **Resolve the edit.** Present the proposed keep, move, and remove set and get approval. Show contradictions between either instruction file and the repository, and ask which intent wins. Preserve confirmed project constraints; remove stale, redundant, obvious, vague, or unenforceable guidance.
3. **Keep a recovery path.** Before replacing a regular `AGENTS.md` or `CLAUDE.md`, check its Git status. A tracked, clean file needs no backup. Copy any untracked, ignored, staged, or unstaged regular file to the adjacent `<name>.bak` first; never overwrite an existing backup. For a symlink, remove only the link entry after approval, never its target.
4. **Write one canonical source.** Create a regular root `AGENTS.md`. Keep only what matters on nearly every task: a one-sentence project purpose, a non-default package manager, non-standard build/typecheck commands, and truly global invariants. Describe stable capabilities and domain terms instead of maintaining a file-tree inventory.
5. **Disclose progressively.** Link existing focused docs for language, testing, architecture, API, release, or domain rules. Create a focused doc only when valuable existing guidance must move out of an overloaded instruction file; do not scaffold speculative documentation. Use nested `AGENTS.md` files only for real package scopes, without repeating root rules.
6. **Normalize Claude.** Move useful unique `CLAUDE.md` guidance into `AGENTS.md` or a focused linked doc as approved, then replace the root `CLAUDE.md` entry with a regular file containing exactly `@AGENTS.md` and a trailing newline.
7. **Validate.** Re-read both files. Verify every linked local file exists, every named command comes from repository truth, scoped rules have one owner, no symlink was followed for writing, and `CLAUDE.md` is the exact one-line import.

Deliver: files created or changed, backups created, guidance kept/moved/removed, unresolved contradictions, and validation performed.
