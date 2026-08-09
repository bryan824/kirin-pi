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
  it. For an intermittent bug the goal is a higher reproduction rate rather than a
  clean repro — a 50% flake is debuggable, 1% is not. If you can't build one, stop
  and ask for artifacts (logs, traces, a recording) instead of hypothesizing blind.
- Once it goes red, shrink the repro until every remaining element is load-bearing
  and removing any one turns it green. That cut is what collapses the hypothesis
  space, and what the regression test is made from.
- Redact secrets from every command, output, and captured artifact you show,
  writing `<REDACTED>` in their place, and build loops against env vars so the
  credential stays in the environment. Traces carry auth headers — quote only the
  lines carrying signal. Say so when redacted evidence is no longer enough to
  diagnose.
- For a regression with a known-good version, read `git diff <last-good>..HEAD` of
  the suspect area before bisecting — the cause is usually visible in the delta and
  far cheaper than a full bisect; fall through to bisect only when the diff is large
  or the culprit isn't obvious.
- Rank three to five falsifiable hypotheses before testing any one of them — each
  naming what its cause predicts would change — because testing the first
  plausible idea anchors you to it. Show a reachable user the ranking; they
  re-rank it instantly from what they shipped last week. Then one hypothesis, one
  change at a time.
- Tag every debug probe with a unique prefix (`[DEBUG-a4f2]`) so removing them is
  one grep — untagged probes survive into main. One breakpoint beats ten logs, and
  a performance regression wants a measured baseline and a bisect rather than
  logging at all.
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
every probe and throwaway harness removed, and any follow-up it exposed. Log the cause and regression in
`docs/known-issues.md` (committed substrate) only after the fix is proven, creating the minimal
project-memory structure if the repo lacks it.
