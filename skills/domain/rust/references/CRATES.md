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
| HTTP API / JSON service | `axum` | Pairs with `tokio`. The default when the client is code, not a browser. |
| Server-rendered web app | `topcoat` | Batteries-included SSR framework; take it over hand-wiring `axum` + a template engine when the app serves HTML. |
| Async runtime | `tokio` | Default runtime; keep runtime types out of public APIs (`API_DESIGN.md` → *Composition*). |
| Database | `toasty` | Async ORM over SQL and NoSQL; schema and migrations come with it. |
| Hand-written SQL | `sqlx` | Only when the query is the point and an ORM fights it; compile-time-checked queries. |
| HTTP client | `reqwest` | `rustls` features, not system OpenSSL. |
| Dates and times | `jiff` | Time zones and arithmetic done right; `std::time` alone for durations and monotonic clocks. |
| Structured logging | `tracing` | Named events + message templates over `format!`; see `API_DESIGN.md` → *Observability*. |
| Text matching | `regex` | Linear-time; prefer `str` methods (`split`, `strip_prefix`, `contains`) for fixed patterns. |
| Data parallelism | `rayon` | CPU-bound work over collections. Not a substitute for `tokio` on IO. |
| Snapshot tests (dev) | `insta` | For output that is tedious to assert by hand — CLI text, rendered HTML, serialized structs. |
| Property tests (dev) | `proptest` | Parsers, encoders, and invariants; pair with the malformed-input cases in `VERIFICATION.md`. |
| Benchmarking (dev) | `criterion` *or* `divan` | Only once a path is known-hot; see `PERFORMANCE.md`. |
| Temp files / fixtures (dev) | `tempfile` | Self-cleaning temp dirs and files for tests. |
| App allocator | `mimalloc` | Global allocator for allocation-heavy apps; a near-free win (`PERFORMANCE.md`). |

Prefer `std` where it suffices (`std::io`, `std::fs`, `std::collections`,
`from_le_bytes`/`from_be_bytes` for binary) before adding any of the above.
Dev-only utilities (mocking, fixtures, fake data) belong behind a single
`test-util` feature, never in a default build (`API_DESIGN.md` → *Resilience*).
For the verification toolchain (`cargo-audit`, `-hack`, `-udeps`, Miri) see
`VERIFICATION.md`.
