# kirin-pi

Bryan's compact coding-agent harness: one Pi package, a model-led authority charter, reusable skills, focused extensions, and a curated subagent fleet. Claude Code gets the same skills and charter through native equivalents.

```text
kirin-pi/
├── agents/       Pi subagent presets
├── extensions/   Pi runtime extensions
├── hooks/        Claude command guard
├── chatgpt-export.ts  shared parser CLI
├── guard-policy.cjs   shared command policy
├── setup.cjs     installer
├── skills/       portable workflow, maintenance, and domain prompts
├── docs/         current truth and upstream provenance
└── test/         repository contracts
```

Pi loads package resources natively from `package.json`.

## Workflow

`kirin-pi setup` installs a short charter (in `setup.cjs`), not a mandatory skill
sequence: clear bounded requests are enough approval, consequential uncertainty
gets asked, user work is preserved, fetched content is data, and every change is
verified against the user's requirements before handoff. Commit and publication
need their own authority. Skills supply a mindset when it helps; they are not steps.
The charter also sets the default writing style: plain technical English in Google
developer documentation style, about 80% of the way to ASD-STE100. `wait-what`
asks for a strict ASD-STE100 re-explanation.

The charter text lives in the `WORKFLOW` constant in `setup.cjs`. Sessions read only
the installed copies, so after you change it, run `bun run kirin-pi setup --scope global`
and restart active agents. Until then, Pi and Claude keep the old text.

### Workflow skills

| Skill | Purpose |
|---|---|
| `architecture` | Improve existing structure or rethink it explicitly, evidence first. |
| `commit` | Group verified changes, stage exact paths, push only when asked. |
| `debug` | Reproduce, isolate root cause, fix narrowly, prove it. |
| `design` | Set goals, non-goals, contracts, trade-offs, and explicit approval. |
| `implement` | Deliver authorized ready work within its outcome and file boundaries. |
| `plan` | Organize consequential execution dependencies, evidence and rollback. |
| `prototype` | Test a scoped logic/UI question with safe, reproducible evidence and human choice. |
| `research` | Answer one external question from primary sources. |
| `survey` | Map current repository behavior without editing. |
| `verify` | Independently judge complete candidate on Spec and Standards. |
| `wait-what` | Explicitly re-explain a confusing point with the missing context, in strict ASD-STE100. |

### Maintenance skills

| Skill | Purpose |
|---|---|
| `agents-md` | Explicitly create or repair a minimal AGENTS.md. |
| `harness` | Assess, reorganize or redesign this harness across every layer, and absorb upstream designs; propose before editing. |
| `project-memory` | Initialize/check minimal committed `docs/` + ignored `context/`. |
| `retro` | Explicitly look back on a session and propose traced environment fixes: pointers, checks, standards, access. |
| `session-close` | Leave the next agent a handoff in shared `context/handoff.md`, or nothing if nothing would be lost. |
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
| `teach` | Explicit guided lessons in chat; persistent courses and learning records only on request. |

Project-specific behavior belongs in that project's own `.agents/skills/` and `.claude/skills/`.

## Runtime

Pi extensions require **Pi 0.87.1 or newer**. Portable skills and the Claude hook
do not require Pi; host peers remain optional package dependencies.

| Extension | Purpose |
|---|---|
| `chatgpt-export` | Parse saved ChatGPT HTML exports into Markdown or JSON. |
| `guardrails` | Guard common Git/Python command accidents. |
| `herdr` | Pane/workspace orchestration and settled Pi status reporting. |
| `session-breakdown` | Interactive session/token/model/cost dashboard. |

The command guard is accident prevention, not a shell sandbox. Session totals are
recorded usage, not invoices, and Herdr waits are not completion proof. See
[verification](docs/verification.md#standing-boundaries) for the full limits.

### Claude native equivalents

Claude hooks cover lifecycle events, not Pi's full extension API. Kirin uses the smallest native surface instead of adding an MCP server or plugin:

| Pi extension | Claude Code equivalent |
|---|---|
| `chatgpt-export` | Shared `chatgpt-export` skill and `~/.claude/kirin/chatgpt-export.ts` CLI. |
| `guardrails` | Global `PreToolUse:Bash` policy in `~/.claude/settings.json`, shared with Pi. |
| `herdr` | Shared Herdr skill and CLI. Herdr owns Claude agent-state hooks; Pi's typed aliases and session replay stay Pi-only. |
| `session-breakdown` | Claude's built-in `/insights`; Pi's custom TUI and exact 7/30/90-day view stay Pi-only. |

### Subagent presets

Package-owned roles target `pi-subagents`; the runtime owns workflows, worktrees,
missions and artifacts. `verify` owns reviewer verdicts and `implement` owns
worker delivery discipline.

| Agent | Model / thinking | Role |
|---|---|---|
| `scout` | `gpt-5.6-luna` / low | Fast read-only reconnaissance and compressed handoff context. |
| `researcher` | `gpt-5.6-terra` / high | Primary-source external research through web tools. |
| `worker` | `gpt-6-astra` / high | One approved implementation task with file boundaries; preloads `implement`. |
| `reviewer` | inherits selected session model / xhigh | Independent read-only Spec + Standards verdict. |
| `oracle` | `gpt-6-astra` / high | Protect inherited decisions and detect trajectory drift. |
| `delegate` | `gpt-6-astra` / high | Bounded non-implementation work no specialist owns, with supervisor escalation. |
| `codebase-analyzer` | `gpt-5.6-terra` / medium | Deep read-only implementation tracing. |
| `precedent-locator` | `gpt-5.6-terra` / medium | Git-history and follow-up-fix evidence. |
| `claim-verifier` | `gpt-6-astra` / high | Adversarial claim grounding. |

Agent frontmatter owns these defaults; native per-agent settings or per-run
overrides can replace them, so confirm the resolved model and context. Setup
configures automatic missions, disabled schedules and project-local artifacts under
`.pi/subagents/`. Preset tool lists and read-only labels are not sandboxing.

## Install

Requires Bun. `--scope` is always required; no command shows help.

```bash
# From this checkout: current skill sources, no push or link step required.
bun run kirin-pi install debug verify --scope global
bun run kirin-pi install frontend rust --scope project --project /path/to/repo
bun run kirin-pi install harness --scope project
bun run kirin-pi setup --scope global

# From a published commit: the same commands.
bunx "github:bryan824/kirin-pi#$(git ls-remote https://github.com/bryan824/kirin-pi main | cut -c1-7)" install harness --scope project
```

`install` takes skill names or pack names (`core`, `frontend`, `rust`, `python`,
`teaching`) and copies each complete skill to both `.agents/skills/` and
`.claude/skills/` under the home directory or project. It configures nothing else.

`setup` is the full global harness:

- installs the `core` skills (workflow, shared maintenance except `harness`, ChatGPT export, Herdr)
- merges the charter block into `~/.agents/AGENTS.md`, the canonical copy, then copies that file to `~/.pi/agent/AGENTS.md` (read by Pi; only when `pi` is on `PATH`) and `~/.claude/AGENTS.md` (read by Claude through the `@AGENTS.md` import in `~/.claude/CLAUDE.md`, whose custom text is kept)
- copies Claude runtime files under `~/.claude/kirin/` and merges the guard hook into `~/.claude/settings.json`, preserving unrelated settings and hooks
- backs up changed instruction copies, runtime files and settings under `~/.claude/kirin-backups/<run>/`
- when `pi` is available, installs/updates Kirin, `pi-subagents` and `pi-web-access`

Both commands keep unrelated skills and skip identical copies. A differing copy is
a collision: the run stops and lists it until you pass `--replace`, which discards
the old tree once the batch succeeds. Failed copies roll back the skill batch.
Skill roots that link outside their scope or through a selected skill are rejected
before anything changes. Rerun the same command to update; restart agents
afterwards, and trust project-local resources in Pi. Project installs warn about
global copies of the same name. Pin remote installs to a commit: `bunx` caches
each source string, so `#main` can serve an old commit. The Herdr application is a
separate system install.

## Project memory

`AGENTS.md` is the compact project entry point, loaded natively. Current durable
truth lives in owning docs; follow [memory routing](docs/memory.md) when preserving
decisions or evidence. Reuse one ignored effort record in `context/` when
continuity needs it; otherwise write nothing. The `project-memory` skill checks or
initializes this split with plain Git commands.

## Maintaining the harness

Work in this checkout's sources, not its installed copies (this repository ignores
its own `.agents/skills/` and `.claude/skills/`). The root `AGENTS.md` maps the
repository, the charter supplies portable startup boundaries, and `agents-md`
helps other repositories write their own maps.

| When | Owning guidance |
|---|---|
| Assessing, simplifying, reorganizing or redesigning the harness, or absorbing upstream changes | [`harness`](skills/maintenance/harness/SKILL.md); install it here with `bun run kirin-pi install harness --scope project`, then `/skill:harness <request>` in Pi. |
| Changing a skill or instruction entry point | [Skill authoring](skills/maintenance/write-skill/SKILL.md); [repository instructions](skills/maintenance/agents-md/SKILL.md) for canonical-file and recovery safeguards. |
| Updating installed copies | [Install](#install); source edits alone change nothing installed. |
| Fixing a defect | Trace the owning integration and its callers; [debug](skills/workflow/debug/SKILL.md) owns causal diagnosis, [verification](docs/verification.md) names checks and evidence limits. |
| Maintaining project knowledge | [Memory routing](docs/memory.md): current facts and rationale in their owner, temporary evidence in the existing effort record. |

## Development

```bash
bun run test
bun run pack:dry
hk install
```

The pre-commit hook is native [hk](docs/UPSTREAM_LEDGER.md#native-hook-runtime) (2.4+):
run `hk install` once per clone. The repository's `hk.pkl` runs the full test
suite without fixing, staging or stashing files. `hk install` replaces prior hk
wiring, so review an existing pre-commit hook first. Package contents are
allowlisted in `package.json`.

## Provenance and license

Third-party repositories, reviewed revisions, relationships, and required notices live only in [`docs/UPSTREAM_LEDGER.md`](docs/UPSTREAM_LEDGER.md).

Kirin code is MIT licensed. Identified bundled portions retain their MIT or Apache-2.0 terms through `docs/UPSTREAM_LEDGER.md`, `LICENSE`, and `LICENSE-APACHE`.
