# Verification

| Command | What it proves |
|---|---|
| `bun run test` | Skill/agent schemas, workflow routing, guard policy, project memory, agent sync, one-command setup, extension loading, and provenance isolation satisfy current contracts. |
| `bun run pack:dry` | Published package contains only `harness/`, `skills/`, `docs/`, README, and license files. |
| `bun run memory:check` | Required project-memory substrate exists without requiring ignored record directories. |
| `bun test test/setup.test.cjs` | Zero-argument global setup works with and without Pi, updates stable shared skills, preserves collisions, never requires project scope, leaves `~/.pi/agent/settings.json` to `pi install`, and installs content from the branch tip rather than a cached tarball. |

Bun 1.3.14 is pinned by `packageManager`. No lockfile is needed while the package owns no runtime dependencies; Pi supplies declared peer packages.
