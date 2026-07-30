# Verification and Lints

Deepens the SKILL's gate. The gate itself is always run before calling a change
done:

```bash
cargo fmt -- --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo check            # add rustfmt/clippy components if missing
```

Everything below is the *recommended baseline* a project can adopt and the deeper
checks worth running when the project warrants — not a per-edit requirement.

## Recommended lint configuration

Enable in `Cargo.toml`. Treat it as a starting point and opt back out of specific
lints (with a reason) when one is a poor fit:

```toml
[lints.rust]
ambiguous_negative_literals = "warn"
missing_debug_implementations = "warn"
redundant_imports = "warn"
redundant_lifetimes = "warn"
trivial_numeric_casts = "warn"
unsafe_op_in_unsafe_fn = "warn"
unused_lifetimes = "warn"

[lints.clippy]
cargo = { level = "warn", priority = -1 }
complexity = { level = "warn", priority = -1 }
correctness = { level = "warn", priority = -1 }
pedantic = { level = "warn", priority = -1 }
perf = { level = "warn", priority = -1 }
style = { level = "warn", priority = -1 }
suspicious = { level = "warn", priority = -1 }

# selected `restriction` lints for consistency and to keep unsafe honest
allow_attributes_without_reason = "warn"
clone_on_ref_ptr = "warn"
undocumented_unsafe_blocks = "warn"
unnecessary_safety_comment = "warn"
map_err_ignore = "warn"
semicolon_outside_block = "warn"
string_to_string = "warn"
unused_result_ok = "warn"

# avoids fighting structured-logging message templates
literal_string_with_formatting_args = "allow"
```

The full `restriction` group is opt-in by design — pull in more of it
deliberately, not wholesale.

## Deeper checks (when the project warrants)

- `cargo audit` — flags dependencies with known vulnerabilities.
- `cargo hack` — builds every feature combination; pairs with additive features
  (`API_DESIGN.md` → *Crate hygiene*).
- `cargo udeps` — finds unused dependencies in `Cargo.toml`.
- `miri` — validates `unsafe` correctness; run it whenever `unsafe` is touched
  (`SAFETY.md`).

## Lint and code hygiene

- Override a project-wide lint locally with `#[expect(lint, reason = "…")]`, not
  `#[allow]` — an `expect` that's no longer triggered warns, so stale overrides
  surface instead of accumulating. (`#[allow]` is still right for generated code
  and macros.)
- Give every magic value a named `const` and a comment covering why it was chosen,
  the side effects of changing it, and any external system it's tied to.
