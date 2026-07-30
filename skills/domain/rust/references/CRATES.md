# Preferred Crates

What to reach for, by task. The bar is unchanged: add a crate only when it cuts
meaningful complexity over `std`, and say why in the change. Avoid broad
frameworks in small CLIs, and don't pull a dependency into a public API surface
without weighing the leak (see `API_DESIGN.md` → *Boundaries*).

| Need | Reach for | Notes |
|---|---|---|
| Errors (library) | `snafu` | Typed, per-domain error structs with context selectors and backtraces. See `ERRORS.md`. |
| Errors (application) | `anyhow` *or* `eyre` | App-level only; pick one and don't mix. Libraries stay on typed errors. |
| Nontrivial CLI | `clap` | Derive API. Skip it for a one-flag tool. |
| Serialization / config | `serde` + `serde_json` / `toml` | Derive `Serialize`/`Deserialize`; reach for the format crate you actually parse. |
| HTTP server | `axum` | Pairs with `tokio`. |
| Async runtime | `tokio` | Default runtime; keep runtime types out of public APIs (`API_DESIGN.md` → *Composition*). |
| Relational DB + migrations | `diesel` | When you need a schema and migrations, not for ad-hoc queries. |
| Structured logging | `tracing` | Named events + message templates over `format!`; see `API_DESIGN.md` → *Observability*. |
| Benchmarking (dev) | `criterion` *or* `divan` | Only once a path is known-hot; see `PERFORMANCE.md`. |
| Temp files / fixtures (dev) | `tempfile` | Self-cleaning temp dirs and files for tests. |
| App allocator | `mimalloc` | Global allocator for allocation-heavy apps; a near-free win (`PERFORMANCE.md`). |

Prefer `std` where it suffices (`std::io`, `std::fs`, `std::collections`,
`from_le_bytes`/`from_be_bytes` for binary) before adding any of the above.
Dev-only utilities (mocking, fixtures, fake data) belong behind a single
`test-util` feature, never in a default build (`API_DESIGN.md` → *Resilience*).
For the verification toolchain (`cargo-audit`, `-hack`, `-udeps`, Miri) see
`VERIFICATION.md`.
