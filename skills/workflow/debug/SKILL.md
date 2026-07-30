---
name: debug
description: "A check fails or behavior is wrong and the cause isn't obvious — reproduce, isolate the root cause, fix narrowly, and prove it."
---

# Debug

Find the cause before changing code. A bug you can't reproduce you can't fix; a
fix you can't prove you haven't made.

Resist: patching the symptom, changing several things at once, calling it fixed
without re-running the failing check.

- Reproduce first — a fast, deterministic pass/fail signal that asserts the user's
  exact symptom (not merely "runs without erroring"), run once to watch it go red,
  is most of the fix; bisection, hypotheses, and instrumentation all just consume
  it. If you can't build one, stop and ask for artifacts (logs, traces, a
  recording) instead of hypothesizing blind.
- For a regression with a known-good version, read `git diff <last-good>..HEAD` of
  the suspect area before bisecting — the cause is usually visible in the delta and
  far cheaper than a full bisect; fall through to bisect only when the diff is large
  or the culprit isn't obvious.
- One hypothesis, one change at a time.
- Three failed fixes is a circuit breaker: stop patching — the diagnosis or the
  architecture is wrong. Hand off what you know: hypotheses tested, ruled out,
  evidence, unknowns.
- Fix where it's wrong, not where it surfaced.
- For UI, visual, or generated-artifact bugs, compiling and green unit tests
  prove nothing — verify the rendered surface or artifact, or name exactly what
  the user should check.
- Re-run the exact failing signal, then add the regression that would have caught
  it; if there's any doubt the regression can fail, revert the fix once and
  watch it. If no correct seam exists to lock the bug down, that absence is the
  finding — hand the architecture gap to `architecture`.

Deliver: the failing signal, the root cause (not the symptom), proof of the fix,
and any follow-up it exposed. Log the cause and regression in
`docs/known-issues.md` (committed substrate) only after the fix is proven, creating the minimal
project-memory structure if the repo lacks it.
