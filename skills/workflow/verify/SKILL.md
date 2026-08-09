---
name: verify
description: "After a change, before commit/merge — independently code-review the complete candidate on Spec and Standards, run real checks, and emit a verdict."
---

# Verify

Be skeptical. Judge the complete candidate against intent, contracts, runtime
evidence, and standards — not just whether the diff looks reasonable.

Resist: reviewing only committed `HEAD` while work is uncommitted, letting one
review axis mask the other, trusting a hollow green, making large fixes mid-review,
or manufacturing findings.

- **Pin the candidate.** Resolve the user-supplied fixed point when present; for a
  branch use a merge-base three-dot diff and commit list. Always add staged,
  unstaged, and untracked candidate changes — a `HEAD`-only comparison can hide
  the work awaiting review. Fail early on an invalid ref or genuinely empty
  candidate. A user-named folder/file set with no pending change is also a valid
  candidate: review it as a complete entity on the same two axes, no diff
  pinning, with a completeness lens — untested exports, missing error paths.
- **Find the intent source.** Prefer an explicit spec/ticket path, then references
  in commits/branch records and project memory; ask when material intent is still
  ambiguous. If no spec exists by explicit choice, say the Spec axis is limited —
  never reverse-engineer intent from the diff.
- **Keep two evidence axes.** For a material review, use independent fresh
  reviewers in parallel when available (otherwise make two separate passes):
  - **Spec** — missing/partial requirements, incorrect behavior, scope creep,
    contracts, acceptance, tests, and docs.
  - **Standards** — documented repo rules first, then the named smell baseline in
    `references/SMELLS.md` (paste it into an independent reviewer's brief, which
    can't reach it otherwise), then complexity, reliability, security, and
    maintainability findings. Repo rules override generic taste; skip anything
    tooling already enforces.
  Preserve the two reports under separate headings before the combined verdict so
  one axis cannot hide the other.
- Prefer executable checks over inspection. Distrust skipped jobs, empty
  assertions, and paths never exercised. A pass counts only when a non-skipped,
  non-empty case hits the real path. If no honest test seam exists, the missing
  seam is the finding (`architecture`), not permission to fake a green.
- Read the tests first; they state what the change claims. Check intended behavior,
  affected call sites, adopted project memory, and the full diff before polishing
  implementation quality.
- Explicitly flag input handling, authn/z, secrets, migrations, reliability
  regressions, added layers/indirection, and simpler alternatives. Findings name
  file:line, trigger, why guards miss it, and the remedy — the move, not just the
  complaint. Treat a dependency bump as behavior nobody wrote: read the
  changelog, not the semver; review the lockfile/transitive diff; prefer one
  dependency per change; thin test coverage around the dependency is itself a
  finding.
- After a pattern fix, sweep siblings and disposition each match as fixed, safe
  (why), or flagged. Before unifying an outlier, read why it diverged. List code
  the change orphaned as findings rather than deleting it silently.
- Calibrate: a clean review is valid. Lead with correctness/security, then
  structure, then nits; one structural problem outranks ten cosmetics. Pass what
  clearly improves health — do not block on not-how-I'd-write-it. Git history is
  a severity prior: a finding in a file whose recent commits kept needing
  follow-up fixes deserves a bump.
- Do not make large fixes in review. Route an unknown failure to `debug`, a bounded
  correction to `implement`, and structural debt to `architecture`, then review the new
  candidate fresh.
- At plan scope, walk every ticket/slice acceptance criterion before calling the
  whole effort shipped. Incoming reviewer findings are claims to verify, not
  orders; push back with evidence and fix in leverage order.
- Emit `VERDICT: FAIL` when either axis has a required fix or real checks fail;
  `VERDICT: PASS_WITH_RISKS` only for explicit non-blocking risks; otherwise
  `VERDICT: PASS`. Only a pass or user-accepted risks hand the dirty tree to
  `commit` — verification readiness is not commit grouping.

Deliver: verdict, fixed point/candidate scope, `## Spec`, `## Standards`, commands
run, required fixes, risks, and next seam. Record stable verification commands,
invariants, and accepted risks in `docs/verification.md` with what each proves,
creating project memory when absent.
