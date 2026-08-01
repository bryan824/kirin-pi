# Verification

| Command | What it proves |
|---|---|
| `bun run test` | Skill/agent schemas, workflow routing, guard policy, project memory, agent sync, one-command setup, extension loading, and provenance isolation satisfy current contracts. |
| `bun run pack:dry` | Published package contains only root runtime files/directories, `skills/`, `docs/`, README, and license files. |
| `bun skills/maintenance/skill-audit/scripts/skill-cleaner.ts --root skills --root-only --no-logs` | Skill names are unique and the complete source fleet remains visible within the prompt budget; inspect its overlap and description candidates. |
| `bun run memory:check` | Required project-memory substrate exists without requiring ignored record directories. |
| `bun test test/setup.test.cjs` | Zero-argument global setup works with and without Pi, rebuilds both skill roots, preserves instruction and Claude settings ownership, installs durable Claude hooks idempotently, and leaves `~/.pi/agent/settings.json` to `pi install`. |
| `bun test test/chatgpt-export.test.ts` | Pi and Claude share one ChatGPT export parser and the standalone Claude CLI preserves metadata, message limits, formats, and explicit output. |

Bun 1.3.14 is pinned by `packageManager`. No lockfile is needed while the package owns no runtime dependencies; Pi supplies declared peer packages.
