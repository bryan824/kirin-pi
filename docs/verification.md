# Verification

| Command | What it proves |
|---|---|
| `bun run test` | Skill/agent schemas, workflow routing, guard policy, project memory, agent sync, bootstrap, extension loading, and provenance isolation satisfy current contracts. |
| `bun run pack:dry` | Published package contains only `harness/`, `skills/`, `docs/`, README, and license files. |
| `bun run memory:check` | Required project-memory substrate exists without requiring ignored record directories. |
| `bun run kirin-pi bootstrap workflow --print` | Canonical always-on workflow block renders from the package entrypoint. |

Bun 1.3.14 is pinned by `packageManager`. No lockfile is needed while the package owns no runtime dependencies; Pi supplies declared peer packages.
