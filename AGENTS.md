# Repository purpose

Kirin is Bryan's reusable coding-agent harness for Pi and Claude Code: portable
skills and focused native integrations, not another workflow runtime.

## Ownership

- `skills/` owns portable prompts; `agents/` owns role presets.
- `extensions/` and `hooks/` adapt native hosts. `guard-policy.cjs` is the shared
  command-policy owner; `setup.cjs` owns explicit installation and its startup charter.
- `docs/` owns current durable truth; `test/` owns repository contracts.
- Edit these sources, not installed packages or the ignored `.agents/skills/` and
  `.claude/skills/` copies. Source approval is not installation, upgrade, global
  configuration, commit or publication authority.

## Essential rules

- Prefer deletion, existing owners and native host features over custom machinery.
- Keep project-specific prompts, generated state and machine-local records out of
  the committed harness. Keep current truth, not a changelog or development diary.
- Third-party repository names, URLs, revisions and provenance belong only in
  [the upstream ledger](docs/UPSTREAM_LEDGER.md); README may link there generically.
  Package/runtime identifiers may appear where executable configuration requires them.
- Keep README and package metadata aligned with behavior. Run `bun run test` after
  code changes and `bun run pack:dry` after package-surface changes.

## Read when relevant

- **Growing, maintaining or updating the harness:** [maintenance map](README.md#maintaining-the-harness)
  for evaluation triggers, owning guidance and source-versus-install boundaries.
- **Creating or changing portable prompts:** [skill authoring](skills/maintenance/write-skill/SKILL.md)
  for preserving useful behavior without adding a framework.
- **Fixing or verifying behavior:** [verification](docs/verification.md)
  for checks, affected surfaces and limits of the evidence.
- **Saving or reorganizing project context:** [memory routing](docs/memory.md)
  for current docs, working records and preservation rules.
