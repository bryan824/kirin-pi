# Verification

| Command | What it proves |
|---|---|
| `bun run test` | Skill/agent schemas, workflow routing, guard policy, project memory, agent sync, one-command setup, extension loading, and provenance isolation satisfy current contracts. |
| `bun run pack:dry` | Published package contains only `harness/`, `skills/`, `docs/`, README, and license files. |
| `bun run memory:check` | Required project-memory substrate exists without requiring ignored record directories. |
| `bun test test/setup.test.cjs` | Zero-argument global setup works with and without Pi, rebuilds both agent skill roots from the harness on every run, preserves agent and instruction collisions, never requires project scope, and leaves `~/.pi/agent/settings.json` to `pi install`. |

Bun 1.3.14 is pinned by `packageManager`. No lockfile is needed while the package owns no runtime dependencies; Pi supplies declared peer packages.
