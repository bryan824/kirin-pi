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
| `skill-audit` | Measure overlap, use, drift, and prompt cost. |
| `write-skill` | Create or simplify one sharp skill. |

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

## Install or update

Requires Bun. A plain command prompts for scope; project scope then prompts for optional packs. Without a TTY it defaults to global. Use `--scope`, `--project`, `--packs`, and `--yes` to resolve those choices explicitly. Global scope installs the current 18 core skills only. Project scope installs selected optional packs only: `frontend`, `rust`, `python`, and `teaching`.

```bash
# Remote or checkout: prompt in a TTY.
bunx "github:bryan824/kirin-pi#$(git ls-remote https://github.com/bryan824/kirin-pi main | cut -c1-7)"
bun run kirin-pi

# Noninteractive global core or project frontend.
bunx "github:bryan824/kirin-pi#$(git ls-remote https://github.com/bryan824/kirin-pi main | cut -c1-7)" --scope global --yes
bun run kirin-pi --scope project --project . --packs frontend --yes
```

Pin a commit rather than a branch. `bunx` caches per source string and resolves each one exactly once, so `#main` keeps serving whatever commit it first saw — neither `--force` nor `--no-cache` re-checks a branch. A commit cannot move, so its cache entry is always right, and resolving the SHA at call time makes the string change whenever `main` does. A checkout has no such problem, so `bun run kirin-pi` needs nothing.

### Global scope

Global setup always owns and replaces both `~/.agents/skills` and `~/.claude/skills`, including the shared ChatGPT export and Herdr skills. It also:

- owns `~/.agents/AGENTS.md`; Claude's global `CLAUDE.md` imports it as `@AGENTS.md`
- copies Claude runtime files under `~/.claude/kirin/` and idempotently merges only Kirin hook entries into `~/.claude/settings.json`, preserving unrelated settings and hooks
- backs up changed Claude settings under `~/.claude/kirin-backups/<run>/settings/`; restoring that file disables the managed hooks, after which `~/.claude/kirin/` is inert
- when `pi` exists in `PATH`, installs or updates Kirin, the latest `pi-subagents`, and `pi-web-access` with Pi's package commands; Nico discovers Kirin's nine package-owned roles directly

A global rerun replaces both global skill roots with core skills. Colliding instruction paths are backed up before replacement. During migration, untouched legacy managed agent copies are removed while user-edited copies remain as higher-priority overrides. Restart active agents afterward.

### Project scope

Project setup defaults `--project` to the current directory and installs selected optional skills to both `<project>/.agents/skills` and `<project>/.claude/skills`. It is additive: unrelated and unselected skills remain, identical skills are skipped, and differing collisions are confirmed together in one batch. Existing `.agents` or `.claude` paths that resolve outside the project are rejected.

Global core includes Herdr integration and guidance; the Herdr application itself remains a separate system install.

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
