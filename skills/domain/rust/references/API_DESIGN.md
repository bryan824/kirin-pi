# API and Library Design

Reach for this when shaping a public (or crate-internal) API surface, a library,
or a reusable type — beyond the SKILL's "thin `main`, domain modules" baseline.
The throughline: an API that reads like the rest of the Rust ecosystem is easier
for the next human *and* the next agent to use correctly, because the compiler
and the conventions carry the understanding.

## Naming and shape

- **Drop weasel words.** `Service`, `Manager`, `Factory` rarely add meaning — a
  type handling bookings is `Bookings`; one that submits them is a
  `BookingDispatcher`. Lifecycle belongs to `Drop`, not a `Manager`. A type that
  repeatably builds `Foo` is a `FooBuilder`, not a `FooFactory`.
- **Free functions are first-class.** Only put a function in an `impl` block if it
  logically belongs to the receiver; associated functions are for construction
  (`Foo::new`). A helper that doesn't act on `self` is a plain `fn`.
- **Essential functionality is inherent.** Implement core behavior as inherent
  methods; let trait impls *forward* to them. Hiding the main method behind a
  trait forces users to hunt for the right `use`.

## Strong types

- Avoid primitive obsession — wrap meaningful values in newtypes with documented
  semantics. Use the strongest `std` type as early as possible in the flow
  (`Path`/`&str` for OS paths, not `String`). Keep purely numeric API boundaries
  as plain numbers, though — not `NonZero`/`Saturating`.

## Function signatures

- Accept `impl AsRef<str>` / `AsRef<Path>` / `AsRef<[u8]>` when you don't need
  ownership and construction is cheap; take an owned `String`/`Vec<u8>` only on
  hot, high-volume paths where the allocation matters. Don't infect *types* (their
  fields) with these bounds.
- Accept `impl RangeBounds<T>` for ranges, not `(low, high)` or a bare `Range`.
- **Write sans-io.** For one-shot I/O, accept `impl std::io::Read` / `Write`
  (async, multi-runtime: `futures::io::AsyncRead`) instead of a concrete `File`,
  so callers can pass sockets, stdin, or `&[u8]`. This untangles logic from I/O
  and composes N×M.

## Construction

- 0–2 optional parameters → inherent constructors (`new`, `with_a`, `with_a_b`).
- 4+ initialization permutations → a **builder**: `Foo::builder()` (no public
  `FooBuilder::new()`), chainable setters named `x()` (not `set_x()`), terminal
  `.build()`. Pass *required* params when creating the builder, grouped into a
  `deps: impl Into<FooDeps>` struct so new requirements don't break callers.
- 4+ positional parameters → cascade through grouping structs / newtypes so
  same-typed args can't be swapped (`Deposit::new(account, amount)`, not four
  strings).

## Composition

- Prefer **concrete types > generics > `dyn Trait`**. For test-only alternatives
  use the mockable-enum pattern below; for user-provided implementations introduce
  narrow traits (`StoreObject`, `LoadObject`) implemented on top of your inherent
  methods, accept them as `impl Trait` generics, and only escalate to `dyn` (in a
  custom wrapper) once generics nest painfully.
- **Don't expose wrappers or deep generics.** Keep `Arc`/`Rc`/`Box`/`RefCell` and
  nested type parameters out of public signatures — they're infectious and may be
  unresolvable when crates disagree. Service-like types should not nest on their
  own beyond one level (`Service<Backend>` ok, `Service<Backend<Store>>` not).
- **Services are `Clone`.** Heavyweight service / once-per-thread types implement
  cheap shared-ownership `Clone` via `Arc<Inner>` — a clone is a new handle, not a
  deep copy — so collaborators can each hold one.

## Resilience

- **Avoid `static` / thread-local state** where a consistent view matters for
  correctness. Version resolution can silently link several copies of a crate,
  each with its own static — so the "global" counter may read 2, 3, or 5.
  Performance-only statics are fine.
- **Make I/O and syscalls mockable** — file, network, clock, entropy, anything
  non-deterministic or environment-dependent. Don't call them ad-hoc or ship a
  `default()` that does; route them through a private enum core
  (`Native` vs `Mocked`) and expose `Library::new_mocked() -> (Self, MockCtrl)`.
- **Gate every test utility behind one `test-util` feature** — mocking, sensitive
  inspectors, safety-check bypasses, fake-data generators — so production builds
  can't reach them.

## Boundaries

- Prefer `std` types in public APIs; **don't leak third-party types** — each
  becomes part of your contract. Leak only behind a feature (e.g. `serde`) or for
  a substantial ecosystem benefit.
- Public types and the futures they produce should be `Send` (assert it on main
  entry points) unless the type is strictly instantaneous and never held across
  `.await`.
- Wrappers around native handles provide `unsafe` escape hatches
  (`from_native`/`to_native`/`into_native`) for interop. See `SAFETY.md` for FFI.

## Crate hygiene

- **When in doubt, split the crate** — smaller crates compile faster and can't
  form cycles. If a module is independently usable, it's a crate. Use features for
  functionality that can't stand alone; an umbrella crate may re-export siblings.
- **Features are additive**: any combination must compile, adding a feature must
  not remove or change a public item (use `#[non_exhaustive]` for new variants),
  and prefer a `std` feature over a `no-std` one.
- **Libraries work out of the box**: build on Tier-1 platforms with nothing beyond
  `cargo`/`rustc`. No mandatory external tools or env vars; a `-sys` crate vendors
  and `cc`-compiles its native source rather than shelling out to Make.
- **No glob re-exports** (`pub use foo::*`) — they leak items and resist review;
  re-export individually. Mark `pub use` of your *own* items `#[doc(inline)]` so
  they read as native (not third-party ones).

## Documentation

- Every public item opens with a one-line **summary sentence** (~15 words, fits
  one line — it's extracted into the module summary), then free-form detail and
  examples.
- Include the canonical sections when they apply: `# Examples`, `# Errors`
  (conditions when returning `Result`), `# Panics` (when it can panic), `# Safety`
  (invariants a caller of an `unsafe` fn must uphold), `# Abort` (if it can abort
  the process).
- Explain parameters in prose ("copies from `src` to `dst`"), never as a parameter
  table. Public modules get comprehensive `//!` docs: what's inside, when to use
  it (and when not), examples, side effects.

## Observability

- Use structured logging (`tracing`) with **named events** in
  `component.operation.state` form and **message templates** rather than
  pre-formatted strings — deferring `format!` avoids runtime allocation and keeps
  events filterable.
- Follow OpenTelemetry semantic attribute names where they exist
  (`http.request.method`, `file.path`, `db.operation.name`). **Never log secrets
  or PII** — redact emails, tokens, identifying paths.
