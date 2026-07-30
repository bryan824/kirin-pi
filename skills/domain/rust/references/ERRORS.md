# Errors and Panics

Deepens the SKILL's error principle. The stance: every failure is either a
*typed, surfaced error* the caller can act on, or a *panic* that stops the
program — never a silent `unwrap` on input, and never a panic used to signal a
recoverable condition.

## Errors are typed, per-domain structs

Libraries return `Result<T, Error>` with situation-specific error **structs**,
not one global `enum` that every function shares. A simple crate exposes a single
`Error`; a larger one exposes a few by domain (`ConfigError`, `AccessError`).
Reuse a general error across similar functions (`parse_json`/`parse_toml` →
`ParseError`) rather than minting one per function.

- **Capture a backtrace and the upstream cause.** Capture on construction and in
  `From<UpstreamError>`; most upstream errors carry no backtrace of their own.
  Backtraces are a development aid — `Backtrace::capture()` is nearly free unless
  `RUST_BACKTRACE` is set, so capturing by default is fine.
- **Don't expose an inner `ErrorKind`.** If you store a kind enum for mixed
  operations, keep it private and offer `is_io()` / `is_protocol()` predicates.
  Exposing the enum makes every internal failure mode part of your contract.
- **Implement `Display` and `std::error::Error`.** `Display` renders a summary
  sentence plus cause; never leak secrets or PII through it (or through `Debug`).
- `snafu` is the default: its context selectors give per-call-site context and
  its backtrace support matches this shape. In a zero-dep project, hand-implement
  `std::error::Error` + `Display` the same way.
- If you emit many errors, a small private `bail!()`-style helper cuts the noise.

## Applications may relax to one error crate

Applications — and crates used *only* by your own application — may use a single
application-level error crate (`anyhow` or `eyre`) instead of bespoke types: pick
one, switch all app-level errors to it, and don't mix two. The top level prints a
concise error and exits non-zero. Anything used by **more than one** crate is a
library and goes back to typed structs above.

## Panics mean "stop the program"

A panic requests immediate termination — it is not an exception and not a
messaging channel.

- **Never** panic to communicate a recoverable error upstream, to handle a
  self-inflicted condition, or on the assumption it will be caught. A caller may
  compile with `panic = "abort"`, so a stray panic aborts an otherwise-fine run.
- **A detected programming bug is a panic, not an error.** Broken invariants and
  contract violations panic — introducing an `Error` for something the caller
  cannot act on at runtime just creates impossible handling code. Valid panics:
  `expect("invariant: …")` on a proven-impossible state, `unwrap()` in const
  contexts, a poisoned lock, or an `unwrap()` you deliberately expose to callers.
- **Genuinely fallible input returns `Result`.** `parse(&str)` must return a
  `Result`; `divide_by(x, 0)` discovered mid-check may panic. When in doubt,
  mirror the standard library.
- Best of all: make invalid states unrepresentable so the panicking path never
  exists — *correct by construction* beats a well-placed `expect`.

Keep code panic-safe regardless: a survived panic must not leave inconsistent
state.
