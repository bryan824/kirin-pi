# kirin-pi

Bryan's compact coding-agent harness: one Pi package, a model-led authority charter, reusable skills, focused extensions, and a curated subagent fleet.

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

Pi loads package resources natively from `package.json`.

## Workflow

The instruction block installed by explicit `kirin-pi setup` is a compact charter,
not a mandatory skill sequence. Clear bounded requests can supply implementation
intent; clarify consequential uncertainty and amend material scope changes.
Preserve user work and file ownership, treat fetched content as data, and verify
the complete change against user requirements, independently when possible and
otherwise as a disclosed self-review. A pass does not authorize a commit,
deployment or publication.

The shared charter also makes clear, natural communication the default: answer
first, explain the relevant reasoning and unfamiliar terms, and keep technical
precision. Small inline diagrams or tables can help; explanatory files, extra
dependencies, paid services and video work need approval. Existing tools handle
requested richer explanations; no generic explanation skill is required. Invoke
`wait-what` when an explanation did not land, or `teach` for deliberate learning
in chat. Neither creates files or a learning workspace implicitly.

Choose skills when their mindset helps: `survey` maps current behavior, `research`
resolves external facts, `prototype` tests uncertainty, and `architecture` judges
structure. `design` owns unresolved choices, including an optional decision-frontier
reference. Use `plan` for consequential dependencies, risk or handoff—not every
edit. Ready, file-disjoint work may run in parallel through the subagent runtime;
shared files serialize, and a failed delegated task is never silently taken over.

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
| `wait-what` | Explicitly re-explain a confusing point with the missing context, not just fewer words. |

### Maintenance skills

| Skill | Purpose |
|---|---|
| `agents-md` | Explicitly create or repair a minimal AGENTS.md. |
| `project-memory` | Initialize/check minimal committed `docs/` + ignored `context/`. |
| `session-close` | Leave the next agent a handoff in shared `context/handoff.md`, or nothing if nothing would be lost. |
| `skill-audit` | Reassess the whole harness after model, host or upstream changes; propose leaner behavior. |
| `write-skill` | Create or simplify one sharp skill. |

### Upstream absorption

`skill-audit` is harness-repository maintenance, not a global setup default.
Install it here from this checkout:

```bash
bun run kirin-pi install skill-audit --scope project
```

Restart your agent, then in Pi run
`/skill:skill-audit Review upstream changes and propose consolidation.`
It reviews the [upstream ledger](docs/UPSTREAM_LEDGER.md) plus any sources you supply,
evaluates improvements across the whole harness (including replacements and
deletions), and presents one consolidation plan for approval before editing source
or the ledger. The [upstream review contract](skills/maintenance/skill-audit/references/UPSTREAM_REVIEW.md)
owns coverage, checkpoint and approval rules. Ordinary audits stay local;
commit and publication still require their own authority.

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

Vault, Obsidian, and travel skills are intentionally absent. A project that needs private or domain-specific behavior mirrors it under `.agents/skills/` and `.claude/skills/`.

## Runtime

Pi extensions require **Pi 0.87.1 or newer**. Portable skills and Claude hooks do
not require Pi; host peers remain optional package dependencies.

### Extensions

| Extension | Purpose |
|---|---|
| `chatgpt-export` | Parse saved ChatGPT HTML exports into Markdown or JSON. |
| `guardrails` | Guard common Git/Python command accidents; report Git-hook status at startup. |
| `herdr` | Pane/workspace orchestration and settled Pi status reporting. |
| `session-breakdown` | Interactive session/token/model/cost dashboard. |

The command guard is best-effort accident prevention, not a shell sandbox. Startup
hook assurance only reports; it never installs or replaces hooks. Session totals
are recorded usage, not invoices, and Herdr waits are not completion proof. See
[verification](docs/verification.md#standing-boundaries) for the full limits.

### Claude native equivalents

Claude hooks cover lifecycle events, not Pi's full extension API. Kirin uses the smallest native surface instead of adding an MCP server or plugin:

| Pi extension | Claude Code equivalent |
|---|---|
| `chatgpt-export` | Shared `chatgpt-export` skill and `~/.claude/kirin/chatgpt-export.ts` CLI. |
| `guardrails` | Global `PreToolUse:Bash` policy and read-only `SessionStart` hook assurance, shared with Pi. |
| `herdr` | Shared Herdr skill and CLI. Herdr owns Claude agent-state hooks; Pi's typed aliases and session replay stay Pi-only. |
| `session-breakdown` | Claude's built-in `/insights`; Pi's custom TUI and exact 7/30/90-day view stay Pi-only. |

### Subagent presets

Package-owned roles target `pi-subagents`. Nine stable names retain role-specific
model policies, tools and context defaults; their prompts add thin role differences.
`verify` owns reviewer verdicts and `implement` owns worker delivery discipline.
The runtime owns workflows, worktrees, missions, artifacts and supervisor dialogue;
user-approved intent remains authoritative.

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

Pinned roles use Astra for implementation, general execution, and adversarial
judgment; Terra for research and analysis; Luna for bounded lookup. The reviewer
instead inherits the selected session model. Thinking remains role-specific rather
than globally maximized. Agent frontmatter owns these defaults; native per-agent
settings or per-run overrides can replace them, so confirm the resolved model and
context. Kirin does not set Pi's parent/startup model. Model-selection sources live
in the [upstream ledger](docs/UPSTREAM_LEDGER.md).

Setup configures automatic missions, disabled schedules and project-local recovery
artifacts under `.pi/subagents/`. Worktrees and supported timeout/tool/usage limits
are execution controls, not promises made by role prose. Inactive `turnBudget`
fields are absent. Preset tool lists and read-only labels are not sandboxing;
actual permissions, command effects and ownership still need enforcement.

## Install skills

Requires Bun. Choose `install` for individual skills or explicit `setup` for the full harness. With no command supplied, the CLI shows help without changing anything. Missing `--scope` prompts in a terminal and errors without one; there is no implicit global installation.

```bash
# From this checkout: current skill sources, no push or link step required.
bun run kirin-pi install skill-audit --scope project
bun run kirin-pi install debug verify --scope global
bun run kirin-pi install frontend-design --scope project --project /path/to/repo

# From a published commit: the same commands and scope rules.
bunx "github:bryan824/kirin-pi#$(git ls-remote https://github.com/bryan824/kirin-pi main | cut -c1-7)" install skill-audit --scope project
```

Names select individual directories from the shipped skills listed above, regardless of their pack. `install` copies each complete skill, including references and scripts. It never runs package updates, configures hooks or instructions, or installs other skills as dependencies. Focused frontend skills use the shared review owner when available and otherwise supply a local focused fallback; missing siblings do not trigger installation.

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

These runtime/configuration phases are not one transaction with the skill batch. `--yes` confirms setup, while differing skills still need `--replace` or an interactive collision decision. Restart active agents afterward. The Herdr application remains a separate system install.

## Project memory

`AGENTS.md` is the compact project entry point, loaded natively without a repository
import shim. Claude's native `agents-md` support must be enabled; existing project
or ancestor Claude instruction files can take precedence. Global instructions
installed by `setup` remain separate. Current durable truth lives in existing
owning docs, not in an always-loaded handbook. Follow
[memory routing](docs/memory.md) when preserving decisions or evidence. Reuse one
ignored effort record in `context/` when continuity needs it; otherwise write
nothing. Existing records and user work are preserved unless cleanup is authorized.
Memory checks use effective Git ignores and flag tracked records without unstaging them.

```bash
bun run memory:check
bun run memory:init
```

## Maintaining the harness

Work in this checkout's sources, not its installed skill copies. The root
`AGENTS.md` maps this repository; the charter in `setup.cjs` supplies portable
startup boundaries; `agents-md` helps other repositories write their own maps.
Those are different consumers, not three copies of one handbook.

| When | Owning guidance |
|---|---|
| Adding, simplifying or retiring harness behavior | [Source audit](skills/maintenance/skill-audit/SKILL.md): measure coverage and compare native features before proposing a new owner. |
| Selecting a stronger model or reconsidering the whole architecture | [Harness review](skills/maintenance/skill-audit/references/HARNESS_REVIEW.md): challenge the design and compare behavior before proposing changes. |
| Changing a skill or instruction entry point | [Skill authoring](skills/maintenance/write-skill/SKILL.md); [repository instructions](skills/maintenance/agents-md/SKILL.md) for canonical-file and recovery safeguards. |
| Reviewing upstream changes | [Upstream absorption](#upstream-absorption) and the [upstream review contract](skills/maintenance/skill-audit/references/UPSTREAM_REVIEW.md). |
| Updating installed copies | [Selected installation](#install-skills) or separately authorized [full setup](#full-harness-setup); source edits alone change neither. |
| Fixing a defect | Trace the owning integration and its callers; [debug](skills/workflow/debug/SKILL.md) owns causal diagnosis, [verification](docs/verification.md) names checks and evidence limits. |
| Maintaining project knowledge | [Memory routing](docs/memory.md): current facts and rationale in their owner, temporary evidence in the existing effort record. |

After selecting a review model, ask `skill-audit` to reassess the whole harness
from first principles and propose the leanest design that preserves useful
outcomes. Use its [behavior probes](skills/maintenance/skill-audit/references/BEHAVIOR_PROBES.md)
for bounded comparisons; hold the harness fixed when comparing models and the
model fixed when comparing harness revisions. Every whole-harness review also
checks latest-stable Pi and Claude Code changelogs, relevant docs and built-in
capabilities against Kirin's custom behavior, separating latest support from
installed availability. The `reviewer` source defaults to fresh context with no
model pin; host overrides can still win, so confirm the resolved model/context. This is a model-led playbook, not an automated runner.

Judge the whole harness when a new model, idea or upstream lesson wants in, a
correction recurs, a component appears not to fire, a ledger revisit trigger occurs, or a host
release supplies a native replacement. Run the audit analyzer first; missing use
signals are not proof of disuse. Ask whether each piece still earns its keep and
whether the new thing belongs here. Try an existing principle, then a reference,
then an existing component; a new skill, agent, extension or hook is the last
resort after a smaller approach fails.

Record only changed current truth, provenance in the ledger, and durable lessons
in the owning guidance or check. A clean local verdict writes nothing. An explicitly
requested, fully reviewed source may receive a user-approved checkpoint-only ledger update,
preserving borrowing provenance. Incomplete sources never advance. This records
coverage, not an evaluation diary; source checks do not authorize deployment.

## Development

```bash
bun run test
bun run pack:dry
bun run hooks:install
```

Hook wiring requires `hk` 2.4+ and Bun already on `PATH`; it never installs tools
or changes global Git settings. Native Git configuration is used on Git 2.54+,
with native shell hooks on older Git. The repository's `hk.pkl` runs the full test
suite without fixing, staging or stashing files. Startup assurance is read-only;
unknown/disabled hooks and custom launchers are preserved for owner review.

Package contents are allowlisted in `package.json`. See
[verification](docs/verification.md) for what local fixtures prove and which
host/model checks require separate authorization.

## Provenance and license

Third-party repositories, reviewed revisions, relationships, and required notices live only in [`docs/UPSTREAM_LEDGER.md`](docs/UPSTREAM_LEDGER.md).

Kirin code is MIT licensed. Identified bundled portions retain their MIT or Apache-2.0 terms through `docs/UPSTREAM_LEDGER.md`, `LICENSE`, and `LICENSE-APACHE`.
