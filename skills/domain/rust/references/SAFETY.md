# Unsafe, Soundness, and FFI

Reach for this only when a change involves `unsafe`, raw pointers, or an FFI/DLL
boundary. Default stance: don't. `unsafe` transfers the compiler's guarantees to
you, and a mistake is a high-severity vulnerability, not a warning.

## When `unsafe` is allowed

The only valid reasons are **novel sound abstractions** (a new smart pointer or
allocator), **benchmarked performance** (e.g. `get_unchecked` after profiling
proves it pays), and **FFI / platform calls**. Never use ad-hoc `unsafe` to
shorten safe code (a `transmute` to "simplify" an enum cast), to bypass `Send`/
`Sync` bounds (`unsafe impl Send`), or to dodge a lifetime via `transmute`.

`unsafe` marks only operations whose **misuse risks undefined behavior** — not
merely "dangerous" ones. `vec.get_unchecked()` is correctly `unsafe`;
`delete_database()` is safe-but-dangerous and stays safe.

## Soundness is non-negotiable

Most guidelines bend with a good reason; this one doesn't. Safe-looking code that
*any* safe calling sequence could push into UB is **unsound** and never
acceptable — even a remote, weird-code possibility counts. If you cannot
encapsulate something soundly, expose an `unsafe` function and document its
contract instead.

Soundness boundaries equal **module boundaries**: inside a module, a safe function
may rely on invariants other code in that module upholds (a `get(&self)` may
deref `self.0` because `new()` established it).

## The unsafe checklist

- Verify there's no established safe alternative first; if there is, use it.
- Keep the abstraction minimal and testable, and harden it against *adversarial
  code* — assume any safe trait it touches (`Deref`, `Clone`, `Drop`) misbehaves,
  and that a passed closure may panic (poison/invalidate state if it does).
- Every `unsafe` block carries a plain-text safety comment explaining why the
  invariants hold (`clippy::undocumented_unsafe_blocks` enforces this).
- Validate with **Miri**, including the adversarial cases. Document generated
  bindings so callers know which call patterns are permissible.

## FFI: only portable state crosses a DLL boundary

The compiler treats each Rust dynamic library as its own compilation — its own
statics, its own `TypeId`s, its own `#[repr(Rust)]` layouts. So between Rust DLLs
you may exchange only **portable** data: `#[repr(C)]` (or similarly well-defined),
with no interaction with any `static`, thread-local, or `TypeId`, and no pointer
to non-portable data.

Passing a `String`, `Vec<u8>`, `Box<T>`, a non-`repr(C)` struct, or anything
relying on a shared `TypeId` (or a static-backed crate like `tokio`/`log`) across
that boundary is data corruption and UB — even when the type looks invisible at
the signature. Prefer an established interop library over hand-rolled `unsafe`,
and follow the upstream unsafe-code guidelines throughout.
