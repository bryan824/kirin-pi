# kirin-pi

Bryan's compact coding-agent harness: one Pi package, a small workflow, reusable skills, focused extensions, and a curated subagent fleet.

## Design

Four boundaries:

```text
kirin-pi/
├── harness/   executable integration: Pi extensions, agent presets, hooks
├── skills/    portable prompt skills: workflow, maintenance, domain
├── docs/      current memory/verification plus upstream provenance
└── test/      repository contracts
```

Pi loads package resources natively from `package.json`. No custom deploy layer, package doctor, generated runtime tree, or legacy job loop.

## Workflow

Routing lives in the global instruction block installed by `kirin-pi setup`. Skills own one mode each.

```text
small: design -> implement -> verify -> commit
large: design | decision-map -> plan -> implement -> verify -> commit
bug:   debug -> verify -> commit
```

`survey`, `research`, and `prototype` gather different evidence. `architecture` chooses structure. `parallel-work` modifies ready file-disjoint work; it is not another lifecycle stage.

### Workflow skills

| Skill | Purpose |
|---|---|
| `architecture` | Improve existing structure or rethink it explicitly, evidence first. |
| `commit` | Group verified changes, stage exact paths, push only when asked. |
| `debug` | Reproduce, isolate root cause, fix narrowly, prove it. |
| `decision-map` | Resolve a multi-session decision frontier before planning. |
| `design` | Set goals, non-goals, contracts, trade-offs, and explicit approval. |
| `implement` | Build one approved outcome or plan unit. |
| `parallel-work` | Fan ready file-disjoint packets across workers and reviewers. |
| `plan` | Produce one approved intent + blocker graph artifact. |
| `prototype` | Answer one question with throwaway runnable evidence. |
| `research` | Answer one external question from primary sources. |
| `survey` | Map current repository behavior without editing. |
| `verify` | Independently judge complete candidate on Spec and Standards. |

### Maintenance skills

| Skill | Purpose |
|---|---|
| `project-memory` | Initialize/check minimal committed `docs/` + ignored `context/`. |
| `session-close` | Preserve only needed handoff context or durable session lessons. |
| `skill-audit` | Measure overlap, use, drift, and prompt cost. |
| `write-skill` | Create or simplify one sharp skill. |

### Domain skills

| Skill | Purpose |
|---|---|
| `herdr` | Official Herdr control guidance plus Kirin's typed Pi integration. |
| `python-tooling` | uv, Ruff, and ty as one Python toolchain. |
| `rust` | Bryan's Rust API, crate, error, safety, and verification conventions. |
| `teach` | Create a persistent learning workspace when explicitly requested. |
| `ui-design` | Ship distinctive working UI from one aesthetic direction. |

Vault, Obsidian, and travel skills are intentionally absent. A project that needs private or domain-specific behavior owns it under `.agents/skills/` or `.pi/skills/`.

## Harness

### Extensions

| Extension | Purpose |
|---|---|
| `agent-sync` | Reconcile bundled presets into Pi's global agent directory. |
| `chatgpt-export` | Parse saved ChatGPT HTML exports into Markdown or JSON. |
| `guardrails` | Block broad Git staging, hook bypass, and non-uv Python commands; ensure Git hooks. |
| `herdr` | Pane/workspace orchestration and settled Pi status reporting. |
| `opencode-cli` | Register local OpenCode CLI models as a Pi provider. |
| `session-breakdown` | Interactive session/token/model/cost dashboard. |

### Subagent presets

Presets target `@tintinweb/pi-subagents` and use its native model, thinking, isolation, extension, skill-preload, worktree, and transcript controls.

| Agent | Model / thinking | Role |
|---|---|---|
| `Explore` | `gpt-5.4-mini` / low | Fast hermetic location search; overrides unavailable default Haiku pin. |
| `codebase-analyzer` | `gpt-5.4-mini` / medium | Deep read-only implementation tracing. |
| `precedent-locator` | `gpt-5.4-mini` / medium | Git-history and follow-up-fix evidence. |
| `claim-verifier` | `gpt-5.5` / high | Adversarial claim grounding. |
| `web-researcher` | `gpt-5.4-mini` / high | Primary-source web research through web tools. |
| `worker` | `gpt-5.4-mini` / high | One bounded worktree implementation packet. |
| `reviewer` | `gpt-5.5` / xhigh | Expensive read-only Spec + Standards verdict. |

Built-in `general-purpose` and `Plan` remain available. Global subagent settings use compact tool prose, finite graceful turn limits, schedules off, and transcripts off by default; worker/reviewer opt back in.

## Install or update

Requires Bun. Scope is always global; there are no subcommands or flags. Same name either way — `bunx` fetches, `bun` uses the checkout you are standing in:

```bash
bunx 'github:bryan824/kirin-pi#main'   # any machine, from GitHub
bun run kirin-pi                       # inside a checkout, from the working tree
```

`bunx` pins a resolved commit under `$TMPDIR` and reuses it without re-checking the branch, so its tarball never supplies installed content. Outside a checkout, setup refreshes a Kirin-owned clone at `~/.local/share/kirin-pi/repo` to the branch tip and installs from there; inside a checkout it installs from your working tree. Skills, presets, and instructions therefore always come from current `main`, never from a cache.

It idempotently:

- installs workflow, maintenance, and Herdr skills under `~/.agents/skills`
- links the same skills under `~/.claude/skills`
- owns `~/.agents/AGENTS.md`; Claude's global `CLAUDE.md` imports it as `@AGENTS.md`
- when `pi` exists in `PATH`, installs or updates Kirin, `@tintinweb/pi-subagents`, and `pi-web-access` through `pi install`, then syncs seven agent presets plus compact subagent defaults

Existing colliding skill, agent, or instruction paths are backed up before replacement. Restart active agents afterward.

Rerun the same command whenever you want to update. Domain skills such as Rust, Python tooling, teaching, and UI design remain project opt-in under `.agents/skills/` or `.pi/skills/`.

Herdr integration and guidance are included; the Herdr application itself remains a separate system install.

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
