---
name: commit
description: "When the user asks to commit, push, write a commit message, or checkpoint changes — group the dirty tree into logical commits, stage exact paths, and push only when explicit."
---

# Commit

Turn a dirty tree into clean history. The unit is not "everything changed in this
session"; the unit is one coherent reason a future reader would want to revert,
review, or cherry-pick.

Resist: `git add -A` reflexes, mixing unrelated or pre-existing changes, hiding
failed or skipped verification, AI/co-author attribution, pushing just because a
commit was requested.

- Inspect `git status`, staged and unstaged diffs, untracked files, and recent
  commit subjects before deciding the shape. If the user supplied paths/globs,
  those paths define the scope unless they explicitly widen it.
- Dirty tree does not mean one commit. Split unrelated concerns: different
  features, bug fixes, generated/schema changes, docs-only changes, or
  pre-existing work that merely happens to be present.
- If the user says "commit all changes," include all intended files but still
  split them into logical commits unless they explicitly ask for one commit.
- Stage exact paths for each commit. Avoid `git add -A`, `git add .`, and broad
  globs unless the commit plan explicitly covers every matched file.
- Preserve existing staged intent. If staged files do not match the logical
  commit plan, ask before unstaging or regrouping.
- Modified or untracked files you didn't author are user work: never stash,
  clean, switch branches, or relocate them to get a clean tree.
- Match the repository's commit-message style from recent history when it is
  clear; otherwise use concise Conventional Commit subjects. Imperative,
  specific, no trailing period.
- Know the verification state before committing. Reuse checks already run; run a
  relevant cheap check when missing and appropriate. If checks are skipped,
  failing, or impossible, say that before or with the commit result.
- Commit as the user only: no "Generated with", no co-author trailers, no
  sign-offs unless the repo already requires them.
- Push only when the user explicitly asks to push. After pushing, report the
  remote/branch and resulting commit range.

Ask when inclusion, grouping, verification expectation, or single-versus-multiple
commit intent is ambiguous. The safe default is multiple atomic commits with
unrelated changes left unstaged.

Deliver: commit plan if confirmation is needed; otherwise commit SHA(s), message
(s), files included per commit, verification used or skipped, and push result if
applicable.
