# Verification

| Command | What it proves |
|---|---|
| `bun run test` | Skill/Nico-agent schemas, role-specific model/thinking tiers, workflow routing, guard policy, project memory, installer behavior, extension loading, native package-agent discovery, and provenance isolation satisfy current contracts. |
| `bun run pack:dry` | Published package contains only root runtime files/directories, `skills/`, `docs/`, README, and license files. |
| `bun test test/skills.test.cjs test/harness.test.cjs` | Static upstream-review entry, approval, checkpoint/provenance, reference-link, and ignored/untracked working-record contracts. Agent behavior still needs scenario probes from the upstream-review reference. |
| `bun skills/maintenance/skill-audit/scripts/skill-cleaner.ts --root skills --root-only --no-logs` | Skill names are unique and the complete source fleet remains visible within the prompt budget; inspect its overlap and description candidates. |
| `bun run memory:check` | Required project-memory substrate exists without requiring ignored record directories. |
| `bun test test/harness.test.cjs test/setup.test.cjs` | Fixture-backed CLI command/scope isolation, named skill selection, both agent destinations, global core exclusion, collision consent, preservation, duplicate warnings, containment and safe root aliases, staging/rollback, and ignored local copies. Explicit setup retains pack choices and runtime/config migrations; Pi calls use a fake process, not live package installation. |
| `pi -p --no-session "Run one foreground researcher workflow…"` | The installed Nico runtime discovers Kirin's package-owned fleet, launches the ambient `pi-web-access` researcher, returns output, and creates an automatic mission. |
| `bun test test/chatgpt-export.test.ts` | Pi and Claude share one ChatGPT export parser and the standalone Claude CLI preserves metadata, message limits, formats, and explicit output. |

Interactive choices and cancellation are tested through injected prompts and streams, not a manual terminal session. Skill transactions roll back selected trees, not newly created parent directories or full setup's later runtime/configuration phases. Planning and application reject root-resolution paths through selected trees, including intermediate links and a root's self-dependencies; ordinary equal-root aliases remain supported. Installation roots must not be concurrently retargeted during a run. Existing global skill copies are reported, never automatically migrated by project installation.

Bun 1.3.14 is pinned by `packageManager`. No lockfile is needed while the package owns no runtime dependencies; Pi supplies declared peer packages.
