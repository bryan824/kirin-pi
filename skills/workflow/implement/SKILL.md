---
name: implement
description: "Build one approved design slice or ready ticket — smallest safe diff, tests/contracts updated, checks run, then hand the uncommitted candidate to verify."
---

# Implement

Change code for exactly one approved slice, no more. Don't design while
implementing: if the plan or contract is wrong, stop and say so rather than
working around it.

Resist: scope creep past the slice, redesigning mid-change, silently diverging
from the contract, large noisy diffs, skipping the verification.

- Start only from one approved design slice or one ready ticket whose blockers
  are done. If neither exists — a bare "just build X" — stop and route to
  `design`; don't invent the scope. For a ticket, reread its approved graph/spec
  and claim it before edits.
- One plan unit only; stop before the next. A design approved in this same
  session may continue here; every later unit starts fresh from the approved
  plan plus that unit. Use `session-close` when another session must resume it.
- Smallest safe change that satisfies the slice; preserve behavior unless told
  otherwise. Before new code or a new dependency, reach in order for: something
  already in this codebase, the stdlib, a native platform feature, an
  already-installed dependency.
- On a plan-vs-reality mismatch, present Expected / Found / Why-it-matters and
  offer: follow the plan, skip the change, or revise the plan. Never silently
  adapt.
- Update tests and adopted project memory when behavior, contracts,
  architecture, or verification truth changes.
- Default to test-first for a behavior change: write one failing test, watch it fail
  for the *right* reason (behavior missing, not a typo or error), write the minimal
  code to pass, then refactor only while green. A check that never failed proves
  nothing. Slice vertically — one test → its code → repeat (tracer bullets), never all
  tests then all code.
- Test behavior through the public interface — assert outcomes, not internal calls or
  structure; a test that breaks on a behavior-preserving refactor was testing
  implementation. Mock only at boundaries you don't control; if it's hard to test, fix
  the design, not the test. Full discipline: `references/TDD.md`.
- During the slice, run typechecking and the narrow relevant test file regularly;
  run the full relevant suite once at the end. Then hand the complete
  **uncommitted** candidate to `verify` for independent code review. Implementation
  never commits itself or marks a ticket `done`; the parent handles those seams.
- If assigned through `parallel-work`: edit only the packet's writable files,
  treat forbidden files as walls, and escalate blockers instead of guessing.

Deliver: what changed and where, contract/behavior changes, checks run, current
ticket state, and `verify` as the required next step. If code must diverge from
the contract, record an explicit amendment — never change intent silently.
