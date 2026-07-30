# Repository purpose

This repository is Bryan's reusable coding-agent harness.

## Boundaries

- `harness/` owns executable integration: extensions, hooks, and subagent presets.
- `skills/` owns portable prompt skills.
- `docs/` owns current durable truth and the sole upstream ledger.
- `test/` owns repository contracts.

## Rules

- Prefer deletion and native Pi features over custom machinery.
- Do not add project-specific prompts, generated state, or machine-local records.
- Third-party repository names, URLs, revisions, and provenance belong only in `docs/UPSTREAM_LEDGER.md`; README may link to the ledger generically.
- Package/runtime identifiers may appear where executable configuration requires them.
- Keep README and package metadata aligned with current behavior. Do not add a changelog or development-history docs.
- Run `bun run test` after code changes.
- Run `bun run pack:dry` after package-surface changes.
