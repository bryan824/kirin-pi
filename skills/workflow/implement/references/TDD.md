# Test-Driven Development

The development discipline `implement` defaults to for any behavior change — the good
parts of test-first practice without the iron-law ceremony. kirin trusts a capable
model, so there is no "delete every line of untested code" ritual and no
rationalization table; the value is the *order* and the *test quality*, not enforcement.

## The loop: red → green → refactor, one slice at a time

- **Red.** One failing test for one behavior. Watch it fail, and fail for the *right
  reason* — the behavior is missing, not a typo or a setup error. A test you never saw
  fail proves nothing; a test that passes the moment you write it is testing something
  you already had.
- **Green.** The minimal code that passes — no speculative options or features the test
  doesn't demand (YAGNI).
- **Refactor** — only while green, never while red. Remove duplication, deepen modules,
  improve names; keep every test green.

**Vertical, not horizontal.** One test → its implementation → the next test. Do *not*
write all the tests first and then all the code: bulk tests describe imagined behavior
and the shape of things, pass when behavior breaks, and commit you to a structure you
didn't understand yet. Each test responds to what the last cycle taught you — tracer
bullets, not a wall of specs.

## Bug fixes: prove it first

Reproduce the bug with a failing test *before* touching the fix. It fails → the bug is
confirmed and you know the test bites; apply the fix → it passes → that same test is now
the regression guard. Never fix a bug without it. (`debug` owns finding the cause; this
owns locking it down.)

## What makes a test good

- **Test behavior through the public interface**, not implementation. Assert the
  outcome a caller observes, not which internal methods ran or in what order. Verify
  *through* the interface, not around it (retrieve via the API; don't query the database
  directly to check a write).
- **The refactor test:** if a behavior-preserving refactor breaks the test, the test
  was coupled to implementation — rewrite it against behavior. Code changes; tests of
  behavior shouldn't.
- **One behavior per test**, named for that behavior so the suite reads like a
  specification ("completing a task records the timestamp", not "test3"). An "and" in
  the name means split it.
- **Expected values come from an independent source of truth** — a known-good literal,
  a worked example, the spec. A tautological test recomputes the expectation the way
  the code does (`expect(add(a, b)).toBe(a + b)`) and passes by construction; a test
  that cannot disagree with the code proves nothing.
- **DAMP over DRY.** A test should be readable on its own; duplicated setup across tests
  is fine when it lets each test tell its whole story. Over-extracting shared helpers
  hides what each test actually checks.

## Test doubles: real > fake > stub > mock

Use the simplest double that works, preferring real code — the more real, the more a
test can catch. Mock *only at system boundaries* you don't control: external APIs, time,
randomness, sometimes the filesystem or DB (prefer a test DB or in-memory fake). Never
mock your own collaborators — over-mocking yields green tests over broken production.
Inject boundary dependencies rather than constructing them inside, and prefer specific
per-operation interfaces (each independently fakeable) over one generic fetcher that
needs conditional logic in the mock.

## Let the tests shape the design

Hard to test is a design signal, not a testing problem. If you must mock everything the
code is too coupled; if setup is huge the interface is too wide. Fix the design — inject
dependencies, improve the module behind a smaller interface — rather than contorting the
test. "Hard to test" usually means "hard to use." (Hand structural findings to `architecture`.)

## Scope

You can't test everything, and trying to is its own waste. Prioritize critical paths and
complex logic; when it's unclear, confirm with the user which behaviors matter most —
and at which seams (public boundaries) the tests will live, before writing them. Keep
most tests small and fast (no I/O, milliseconds); reserve slow end-to-end tests for
genuinely critical user flows.
