# Tests That Can Disagree

A test is evidence about a contract, not a ceremonial prerequisite. Test-first
work is especially useful for a regression: reproduce the symptom, observe the
right failure, make a narrow fix, then rerun the original scenario and nearby
paths. A passing characterization or newly added boundary test can still be
useful; do not delete correct code just to manufacture a red step.

## Independent expectations

Use known-good literals, worked examples, invariants, or an independent oracle.
Do not compute an expected result by repeating the production algorithm. A test
that cannot disagree with the code offers no independent evidence.

Test observable behavior across a useful seam. Caller-facing tests survive
refactors better than assertions about helper-call order. Internal seams can
provide precise evidence for difficult branches, but retain coverage of the real
entrypoint so correct internals cannot hide broken integration.

## Small feedback loops

Prefer a small behavior slice and fast feedback, then broaden coverage as the
flow becomes clear. A table can cover related boundary cases without a test per
input. Keep names and setup understandable without following a fixture framework.
Use the repository's existing test tools rather than importing another stack.

Use real components where practical. Substitute time, remote services, processes
or filesystem boundaries when deterministic or safe execution requires it. A fake
must preserve the boundary contract, and the report must distinguish it from the
real environment. Over-mocking the code being evaluated produces hollow greens.

## Strength of evidence

If unsure a regression test detects the bug, run it against the old behavior or
make a controlled mutation in an isolated fixture. Do not revert user changes to
demonstrate a failure. Failed setup, swallowed output and skipped assertions are
not successful reproductions.

Choose checks for consequence: invalid input, failure/cancellation, data and
permission boundaries, and critical user paths. Static compilation does not prove
a rendered interface works; unit tests do not prove a host or model follows a
prompt. Required unavailable evidence remains outstanding. Refactor without
changing the contract and rerun affected checks before independent review.
