# Holistic Review Contract

Review one interface as a system. Resolve the requested screen, flow, or
feature and the available states before judging it; narrow an unreviewable scope
and say where the boundary is. Review foundations before polish with available
discipline guidance; a missing sibling skill need not prevent direct assessment.
Mark an uninspected discipline or state **Not reviewed**. Mark a check that was
not run, or evidence that cannot establish the claimed behavior, **Not verified**.
Neither label is a substitute for the other.

## Evidence and findings

Show coverage for every relevant owner, state, viewport, and artifact actually
inspected. Each finding needs exact evidence: a `path:line` and current code,
or the precise screen, component, state, and observed behavior when source is
not the evidence. Mark uninspected work **Not reviewed**; never imply coverage.

Consolidate repeated symptoms into one finding per root cause, listing all
confirmed locations. Rank findings by user impact, then reach and leverage:
**High** blocks, misleads, hides, or repeatedly fails; **Medium** materially
harms use or comprehension; **Low** is isolated polish. Assign the finding to
the owner of its root cause, not every affected discipline.

Record rejected candidates only when they were actually considered, with their
location and why evidence or an intentional convention rejected them. Do not
invent candidates to fill the report.

## Review result

Use this compact result:

- **Scope and coverage:** scope, boundary, inspected evidence, owners and
  states; use **Not reviewed** for uninspected work, not merely an unrun check.
- **Findings:** severity, owner, exact location, current evidence, proposed
  change, and user impact; say “No actionable interface findings” when empty.
- **Rejected candidates:** real candidates and reasons, when any exist.
- **Verification:** each exact command or interaction and observed result; label
  every unrun or inconclusive check **Not verified** with what remains.
- **Interface verdict:** **Block** when High findings, unresolved material
  requirements or required verification gaps remain; **Needs changes** for other
  actionable findings; **Approve** only with no actionable findings and verified
  claimed coverage. Explicitly excluded scope is not implicitly approved.

A review request changes no source. When implementation is requested, use the
consolidated findings as scope and rerun relevant verification.
