# Repository purpose

This repository is Bryan's reusable coding-agent harness.

## Boundaries

- Root `agents/`, `extensions/`, `hooks/`, and setup/policy files own executable integration.
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

## Evaluation

Judge the harness, not only the change in front of you, whenever one of these fires:

- Something new wants in — an upstream lesson, a repeated correction, a fresh idea.
- A `docs/UPSTREAM_LEDGER.md` revisit trigger fires, or a host release ships a native feature a component was built to work around.
- The same correction recurs across sessions, or a component stops firing.

Two questions settle it. **Does each piece still earn its keep**, judged per layer against `skill-audit`'s criteria and measured before it is argued. **Does the new thing enter, and where** — fold it into an existing principle first, then a reference, then an existing component; a new skill, agent, extension, or hook is the last rung and claims a whole mindset or capability is missing. Climbing a rung takes evidence that the one below it failed, not a reason it might.

Record only what changes: current truth in `docs/`, third-party relationships in the ledger, durable lessons folded into the owning skill's principles. A clean verdict is a valid outcome — say it and write nothing, since this repository keeps no evaluation diary.
