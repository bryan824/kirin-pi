# kirin-pi

Bryan's compact coding-agent harness: one Pi package, a small workflow, reusable skills, focused extensions, and a curated subagent fleet.

## Design

Executable integration stays flat because this repository is already the harness:

```text
kirin-pi/
├── agents/       Pi subagent presets
├── extensions/   Pi runtime extensions
├── hooks/        Claude and Git hooks
├── chatgpt-export.ts  shared parser CLI
├── setup.cjs     installer
├── skills/       portable workflow, maintenance, and domain prompts
├── docs/         current truth and upstream provenance
└── test/         repository contracts
```

Pi loads package resources natively from `package.json`. No custom deploy layer, package doctor, generated runtime tree, or legacy job loop.

## Workflow

Routing lives in the global instruction block installed by `kirin-pi setup`. Skills own one mode each.

```text
small: design -> implement -> verify -> commit
large: design | decision-map -> plan -> implement -> verify -> commit
bug:   debug -> verify -> commit
```

`survey`, `research`, and `prototype` gather different evidence. `architecture` chooses structure. Ready file-disjoint plan units may use the installed orchestration runtime; shared files or contracts force serialization.

### Workflow skills

| Skill | Purpose |
|---|---|
| `architecture` | Improve existing structure or rethink it explicitly, evidence first. |
| `commit` | Group verified changes, stage exact paths, push only when asked. |
| `debug` | Reproduce, isolate root cause, fix narrowly, prove it. |
| `decision-map` | Resolve a multi-session decision frontier before planning. |
| `design` | Set goals, non-goals, contracts, trade-offs, and explicit approval. |
| `implement` | Build one approved outcome or delegated plan unit within its file boundaries. |
| `plan` | Produce one approved intent + blocker graph artifact. |
| `prototype` | Answer one logic question or compare divergent UI variants, then delete the harness. |
| `research` | Answer one external question from primary sources. |
| `survey` | Map current repository behavior without editing. |
| `verify` | Independently judge complete candidate on Spec and Standards. |

### Maintenance skills

| Skill | Purpose |
|---|---|
| `agents-md` | Explicitly create or repair a minimal AGENTS.md and canonical CLAUDE.md import. |
| `project-memory` | Initialize/check minimal committed `docs/` + ignored `context/`. |
| `session-close` | Preserve only needed handoff context or durable session lessons. |
| `skill-audit` | Measure harness health; explicitly review upstream changes and propose consolidation. |
| `write-skill` | Create or simplify one sharp skill. |

### Upstream absorption

`skill-audit` is harness-repository maintenance, not a global setup default.
Install it here from this checkout:

```bash
bun run kirin-pi install skill-audit --scope project
```

Restart your agent, then in Pi run
`/skill:skill-audit Review upstream changes and propose consolidation.`
Existing global copies need a separate migration; installing locally does not remove them.
It reviews the [upstream ledger](docs/UPSTREAM_LEDGER.md) plus any sources you supply.
Ordinary audits stay local. The upstream branch pins
source revisions, establishes missing baselines, and evaluates improvements across
the whole harness, including replacements and deletions. It presents one
consolidation plan for approval before editing source or the ledger, then uses the
existing implementation, independent verification, and commit workflow.

Review checkpoints are separate from borrowing provenance. Fully reviewed sources
can receive approved checkpoint-only updates; incomplete sources cannot advance.
Ignored working plans and research are allowed, but are not tracked or published.
There is no new extension, scheduler, automatic dependency upgrade, push, or deploy.

### Domain skills

| Skill | Purpose |
|---|---|
| `apple-interface` | Apply Apple-style direct manipulation, materials, and platform behavior when explicit. |
| `chatgpt-export` | Recover saved ChatGPT HTML as Markdown or JSON in Pi or Claude Code. |
| `frontend-accessibility` | Build native-first interfaces for keyboard, screen reader, zoom, and motion needs. |
| `frontend-color` | Preserve semantic color roles and verify rendered themes and contrast. |
| `frontend-design` | Set one aesthetic direction and coordinate the frontend disciplines. |
| `frontend-layout` | Make spatial structure survive containers, content growth, and direction changes. |
| `frontend-motion` | Make state and gesture motion purposeful, continuous, and economical. |
| `frontend-polish` | Refine surfaces, elevation, optical alignment, and icon craft. |
| `frontend-typography` | Keep type hierarchy, wrapping, values, and language rendering stable. |
| `frontend-writing` | Write clear, consistent, localization-safe interface copy. |
| `herdr` | Official Herdr control guidance plus Kirin's typed Pi integration. |
| `python-tooling` | uv, Ruff, and ty as one Python toolchain. |
| `rust` | Bryan's Rust API, crate, error, safety, and verification conventions. |
| `teach` | Create a persistent learning workspace when explicitly requested. |

Vault, Obsidian, and travel skills are intentionally absent. A project that needs private or domain-specific behavior mirrors it under `.agents/skills/` and `.claude/skills/`.

## Runtime

### Extensions

| Extension | Purpose |
|---|---|
| `chatgpt-export` | Parse saved ChatGPT HTML exports into Markdown or JSON. |
| `guardrails` | Block broad Git staging, hook bypass, and non-uv Python commands; ensure Git hooks. |
| `herdr` | Pane/workspace orchestration and settled Pi status reporting. |
| `opencode-cli` | Register local OpenCode CLI models as a Pi provider. |
| `session-breakdown` | Interactive session/token/model/cost dashboard. |

### Claude native equivalents

Claude hooks cover lifecycle events, not Pi's full extension API. Kirin uses the smallest native surface instead of adding an MCP server or plugin:

| Pi extension | Claude Code equivalent |
|---|---|
| `chatgpt-export` | Shared `chatgpt-export` skill and `~/.claude/kirin/chatgpt-export.ts` CLI. |
| `guardrails` | Global `PreToolUse:Bash` and `SessionStart` hooks using the same policy and Git-hook installer as Pi. |
| `herdr` | Shared Herdr skill and CLI. Herdr owns Claude agent-state hooks; Pi's typed aliases and session replay stay Pi-only. |
| `opencode-cli` | Unsupported: Claude provider registration is unsupported. |
| `session-breakdown` | Claude's built-in `/insights`; Pi's custom TUI and exact 7/30/90-day view stay Pi-only. |

### Subagent presets

Package-owned roles target Nico Bailon's `pi-subagents`. Kirin overrides Nico's built-ins with fused role contracts and adds three evidence specialists. Nico owns workflows, worktrees, automatic missions, artifacts, and the native child-to-parent supervisor channel; approved plans remain the source of intent.

| Agent | Model / thinking | Role |
|---|---|---|
| `scout` | `gpt-5.6-luna` / low | Fast read-only reconnaissance and compressed handoff context. |
| `researcher` | `gpt-5.6-terra` / high | Primary-source external research through web tools. |
| `worker` | `gpt-6-astra` / high | One bounded implementation packet with supervisor escalation. |
| `reviewer` | `gpt-6-astra` / xhigh | Independent read-only Spec + Standards verdict. |
| `oracle` | `gpt-6-astra` / high | Protect inherited decisions and detect trajectory drift. |
| `delegate` | `gpt-6-astra` / high | General bounded execution with supervisor escalation. |
| `codebase-analyzer` | `gpt-5.6-terra` / medium | Deep read-only implementation tracing. |
| `precedent-locator` | `gpt-5.6-terra` / medium | Git-history and follow-up-fix evidence. |
| `claim-verifier` | `gpt-6-astra` / high | Adversarial claim grounding. |

Quality-first tiers use Astra for implementation, general execution, and adversarial judgment; Terra for research and analysis; Luna for bounded lookup. Thinking remains role-specific rather than globally maximized. Agent frontmatter owns these defaults; native per-agent settings or per-run overrides can replace them. Kirin does not set Pi's parent/startup model. Model-selection sources live in the [upstream ledger](docs/UPSTREAM_LEDGER.md).

Nico creates a mission for every delegated run, keeps schedules disabled, and stores project-local recovery artifacts under `.pi/subagents/`. Worktrees are workflow execution options rather than agent frontmatter.

## Install skills

Requires Bun. Choose `install` for individual skills or explicit `setup` for the full harness. No command shows help without changing anything. Missing `--scope` prompts in a terminal and errors without one; there is no implicit global installation.

```bash
# From this checkout: current skill sources, no push or link step required.
bun run kirin-pi install skill-audit --scope project
bun run kirin-pi install debug verify --scope global
bun run kirin-pi install frontend-design --scope project --project /path/to/repo

# From a published commit: the same commands and scope rules.
bunx "github:bryan824/kirin-pi#$(git ls-remote https://github.com/bryan824/kirin-pi main | cut -c1-7)" install skill-audit --scope project
```

Names select individual directories from the shipped skills listed above, regardless of their pack. `install` copies each complete skill, including references and scripts. It never runs package updates, configures hooks or instructions, or installs other skills as dependencies.

- **Project:** defaults `--project` to the current directory; writes both `<project>/.agents/skills/<name>` and `<project>/.claude/skills/<name>`.
- **Global:** writes both `~/.agents/skills/<name>` and `~/.claude/skills/<name>`.

The destination root must exist. Skill-root ancestor links must stay inside its canonical directory. Both hosts may share a skill root, but no root's lookup path may pass through a selected skill tree—even if an intermediate link ends elsewhere. Such dependent layouts are rejected before copying.

Unrelated and unselected skills remain; identical copies are skipped. Differing trees are collisions, not proof of ownership: an interactive run offers replace, paired skip, or cancel. Without a terminal, replacement requires `--replace`. `--yes` alone never authorizes a skill overwrite.

Replacement discards the old selected trees after the batch succeeds; it is not a permanent backup. Copy/swap failures roll back the skill batch. A failed rollback retains staging and reports recovery paths. Do not concurrently modify installation roots while a run is active.

Rerun `install` for the same selection to copy source changes, with replacement consent when needed. There is no separate ownership database or update/removal manager. Project installation reports known global copies but does not migrate them; Pi may keep a global copy on a name collision, so do not assume a local copy overrides it. Restart active agents afterward; Pi must trust project-local resources.

This repository ignores its own `.agents/skills/` and `.claude/skills/` copies: `skills/` remains authoritative. The installer does not change another project's ignore rules.

Pin remote installations to a commit rather than a branch. `bunx` resolves each source string once, so `#main` can keep serving an old cached commit. Resolving the SHA makes the source string change with the published revision. A checkout command uses its working tree directly.

## Full harness setup

Only explicit `setup` reaches the full-harness path:

```bash
bun run kirin-pi setup --scope global --yes
bun run kirin-pi setup --scope project --project . --packs frontend
```

Global setup selects workflow skills, curated shared maintenance skills, ChatGPT export, and Herdr guidance. It excludes `skill-audit`; adding a maintenance directory does not automatically install it globally. Existing project pack conveniences remain available: `frontend`, `rust`, `python`, and `teaching`. Both modes use selective skill writes and the same collision rules; neither rebuilds entire skill roots or silently removes formerly installed skills.

Global setup additionally:

- merges its workflow block into `~/.agents/AGENTS.md`, copies canonical instructions for Pi/Claude, and keeps Claude's `CLAUDE.md` import and custom text
- copies Claude runtime files under `~/.claude/kirin/` and merges Kirin hook entries into `~/.claude/settings.json`, preserving unrelated settings and hooks
- backs up changed instruction copies, runtime files, and Claude settings; settings backups live under `~/.claude/kirin-backups/<run>/settings/`
- when `pi` is available, uses its package commands to install/update Kirin, `pi-subagents`, and `pi-web-access`; package-owned roles remain natively discovered
- removes untouched legacy managed agent copies while preserving user-edited overrides

These runtime/configuration phases are not one transaction with the skill batch. `--yes` confirms setup, while differing skills still need `--replace` or an interactive collision decision. Restart active agents afterward. The Herdr application remains a separate system install.

## Project memory

Committed current truth lives in `docs/`. Gitignored effort records live in `context/` and may be deleted after their value reaches code, tests, or docs.

```bash
bun run memory:check
bun run memory:init
```

## Development

```bash
bun run test
bun run pack:dry
bun run hooks:install
```

Bun version is pinned by `packageManager`. Package contents are allowlisted in `package.json`.

## Provenance and license

Third-party repositories, reviewed revisions, relationships, and required notices live only in [`docs/UPSTREAM_LEDGER.md`](docs/UPSTREAM_LEDGER.md).

Kirin code is MIT licensed. Identified bundled portions retain their MIT or Apache-2.0 terms through `docs/UPSTREAM_LEDGER.md`, `LICENSE`, and `LICENSE-APACHE`.
