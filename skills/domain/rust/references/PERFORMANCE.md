# Performance

Reach for this only when a path is actually hot. Optimizing on a hunch trades
readability for nothing — and Bryan's bar is clear over clever.

## Measure before you change anything

Decide early whether the crate is performance- or cost-sensitive. If it is:
identify the hot paths, put them behind benchmarks (`criterion` or `divan`, with
`[profile.bench] debug = 1` so the profiler has symbols), and profile **CPU and
allocations** before touching the code. Note the hot spots for the next
contributor — even a screenshot of the profile helps. If it isn't hot, leave it
readable.

## Where the wins usually are

- Repeated allocations: cloned, growing, or `format!`-assembled `String`s;
  short-lived allocations that could be reused or bump-allocated.
- Memory-copy overhead from cloning `String`s and collections.
- Re-hashing equal data; using the default hasher where collision resistance
  isn't needed (swap in a faster one).

Addressing only the `String` issues has shown ~15% gains on hot paths; deeper work
can reach much more.

## Optimize for throughput, not empty cycles

Measure *items per CPU cycle*. Partition work into chunks, let each task own its
slice independently, design batched APIs and use batched APIs where available,
sleep or yield when idle, and exploit cache locality. Don't hot-spin to grab
single items, and don't pay latency in busy-waiting. Share state only when sharing
costs less than recomputing.

## Long-running async tasks must yield

A future may run on a runtime that can't preempt blocking work.

- I/O-bound loops preempt naturally at their `.await` points — nothing to add.
- A CPU-bound loop with no intervening I/O must call `yield_now().await` at regular
  intervals so it doesn't starve other tasks. Aim for roughly 10–100µs of work
  between yields (task switching costs hundreds of ns; keep its share under ~1%).
  Where item cost is unpredictable, query the runtime's remaining budget.

## Allocator

Applications can set `mimalloc` as the global allocator for a notable, nearly-free
speedup on allocation-heavy paths — a few lines in `main.rs`. This is an
application choice, not a library one.
