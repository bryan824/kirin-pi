# Verification

| Command | What it proves |
|---|---|
| `bun run test` | Skill/agent schemas, workflow routing, guard policy, project memory, agent sync, installer behavior, extension loading, and provenance isolation satisfy current contracts. |
| `bun run pack:dry` | Published package contains only root runtime files/directories, `skills/`, `docs/`, README, and license files. |
| `bun skills/maintenance/skill-audit/scripts/skill-cleaner.ts --root skills --root-only --no-logs` | Skill names are unique and the complete source fleet remains visible within the prompt budget; inspect its overlap and description candidates. |
| `bun run memory:check` | Required project-memory substrate exists without requiring ignored record directories. |
| `bun test test/harness.test.cjs test/setup.test.cjs` | Setup resolves interactive choices and `--scope`, `--project`, `--packs`, and `--yes`; global reruns preserve installed optional packs, both scopes stage and roll back skill-tree replacements, and project setup stays inside its selected project root. |
| `bun test test/chatgpt-export.test.ts` | Pi and Claude share one ChatGPT export parser and the standalone Claude CLI preserves metadata, message limits, formats, and explicit output. |

Bun 1.3.14 is pinned by `packageManager`. No lockfile is needed while the package owns no runtime dependencies; Pi supplies declared peer packages.
