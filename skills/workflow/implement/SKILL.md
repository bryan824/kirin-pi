---
name: implement
description: "When implementation intent is clear — deliver the authorized outcome with a small correct diff, meaningful tests, and an uncommitted verification handoff."
---

# Implement

Deliver the approved behavior, not a larger interpretation of it. A clear bounded
user request or a ready approved unit supplies intent; no ritual interview or
one-unit-per-session rule is needed.

- Read the actual flow, callers, contracts and relevant tests before choosing a
  fix. Reuse existing code, the standard library or native host behavior before
  adding machinery. Minimize the correct change, not merely the changed lines.
- Preserve user work, staged intent and unrelated behavior. Explicitly authorized
  writable files are walls for direct requests and delegated packets, including
  temporary probes and cleanup. Ask the user or parent before crossing them,
  changing a contract or deciding a material ambiguity. Follow the governed runtime;
  stop dependent work at a blocker, never silently switch execution protocols.
- Continue authorized ready work while its constraints hold. If reality
  contradicts material intent, explain the discrepancy and amend the plan rather
  than adapting scope silently. Retry only when new evidence, a corrected packet
  or a changed hypothesis gives a reason; unchanged failed retries are not progress.
- Leave meaningful regression evidence for nontrivial behavior. Prefer a failing
  reproduction before a bug fix; expected results come from the contract or an
  independent worked example, not a copy of the implementation. Use the smallest
  honest test seam. [TDD](references/TDD.md) gives the detailed discipline without
  making every useful test prove that it once failed.
- Run the applicable checks and original scenario. Separate actual execution from
  inspection, fixtures and unrun manual/host checks. A missing environment is a
  verification gap, not permission to call a substitute result equivalent.
- Update authorized current docs when their claims changed. Leave an uncommitted
  candidate for fresh independent review; implementation evidence does not replace
  that judgment or grant commit, cleanup, deployment or publication authority.

Deliver: outcome, complete changed-file scope, commands/results and artifacts,
known gaps or blockers, and the verification handoff. Do not mark requirements
complete merely because the local tests are green.
