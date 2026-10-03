# Verification

Judge the complete candidate against user requirements on both Spec and Standards.
Include staged, unstaged and new candidate files plus affected callers/configuration;
a plan or dirty-file list is not the acceptance boundary. Required missing evidence
cannot become a pass. Verification never grants commit, deployment or publication
authority.

## Local checks

| Command | Evidence and limit |
|---|---|
| `bun run test` | Runs repository contracts and analyzer regressions: skill/preset metadata, native AGENTS.md project entry and instruction links, authority wording, installation and generated-memory fixtures, shared command policy, export data protection and inert extension adapters. Static prompts and resolvable pointers do not establish model compliance or successful task navigation. |
| `bun run pack:dry` | Lists the allowlisted publication surface. Inspect entries for accidental state, missing resources and legal files; this does not publish or verify deployment. |
| `bun test ./test/extensions.test.ts` | Compiles extension entrypoints with peers external; exercises export artifacts, hook diagnostics, Herdr with fake API/socket calls, and session rendering/accounting with synthetic files and installed width primitives. Covers standalone usage without extra messages. No live model, Herdr server or interactive Pi session is exercised. |
| `bun test ./test/harness.test.cjs ./test/setup.test.cjs` | Exercises command/scope isolation, individual skills and packs, both host destinations, collision consent, root/symlink containment, byte preservation, staging/rollback and instruction/settings merging in temporary roots. Pi setup calls use a fake executable. |
| `bun test ./test/hooks.test.cjs ./test/project-memory.test.cjs` | Exercises argument-position guards, read-only hk assurance, legacy/native-config wiring, disabled/custom-hook preservation, effective Git paths/ignores and ambiguous-path refusal in isolated repositories. hk installation is faked; config-hook cases require Git 2.54+. Neither guard prose nor fixtures constitute shell containment. |
| `hk validate` / `git hook run pre-commit` | Separately validates the real configuration and executes the installed Git hook. Requires the existing hk/Bun tools; the hook runs the full test suite with fixing, staging and stashing disabled. Record native versions and verify index/worktree preservation. |
| `bun test ./test/chatgpt-export.test.ts` | Shared parser/CLI formatting, code whitespace/entities/fences, metadata and inode-based protection against overwriting the input through aliases. Adapter tests cover the Pi full-output path. Not general browser-DOM equivalence. |
| `bun skills/maintenance/skill-audit/scripts/skill-cleaner.ts --root skills --root-only --no-logs` | Read-only source inventory, raw-body drift, frontmatter eligibility and conditional character-ratio estimates. Inspect coverage/issues before candidates. This does not measure native selection, loaded context, reference payload, actual tokens or disuse. |
| `bun run memory:check` | Checks current memory substrate and effective context protection without creating records or altering the index. A non-Git directory cannot be certified private by this check. |
| `git diff --check` | Detects whitespace errors in the tracked candidate diff, not correctness or completeness. Review new files separately. |

The test script uses explicit `./` paths for the owned tests and analyzer regression.
Bare names are Bun search filters and can also collect archived namesakes under
ignored working records; Git ignores are not a test-execution boundary.

Bun's declared version is in `packageManager`; record the executable/version actually
used in the effort receipt. If the declared version is unavailable, disclose the
compatibility gap instead of silently installing it. Some adapter checks use the
already-installed Pi peers when local peers are absent. Runtime extensions require
Pi 0.87.1 or newer; record the tested host version too. No runtime dependency or
lockfile is added merely for testing.

## Behavioral and live-host evidence

Separately authorize bounded before/after cases under realistic surrounding
instructions on both supported hosts. Check contextual approval, bounded work
without ritual plans, read-only findings, missing requirements/manual evidence,
causal review of dirty files and changed callers, dependency planning, failed
child/no-fallback behavior, protected prototypes, hostile fetched directives and
no-record closure. For instruction/memory changes, include finding the correct
growth/update/fix owner, preserving resolved constraints across a handoff, and
avoiding invented docs or missing-sibling dependencies. Inspect actual decisions/tool traces; a static phrase match,
grader-only result or another project's test is not behavioral evidence.

For repeatable harness/model reassessment, use the audit's
[behavior probes](../skills/maintenance/skill-audit/references/BEHAVIOR_PROBES.md).
Keep model and harness comparisons separate. Hand-injected prompts can test
instruction decisions, not native discovery, loaded defaults or live-host parity.
A few successful cases do not establish universal model superiority.

Use actual host inventory when claiming effective skills/presets. Filesystem
presence and frontmatter are not enabled selection. Resource/metadata fixtures
must disable extension/model execution and isolate settings, roots and artifacts.
Real Herdr controls/state and terminal UI checks need
explicit scope and remain unverified when unrun. No private history scan is implied
by the analyzer command above.

## Standing boundaries

- Command guards prevent common accidents, not substitutions, aliases, arbitrary
  shell programs or direct extension subprocesses. Read-only role labels and copied
  worktrees are not sandboxes.
- Startup hook assurance reports only, without executing hk or evaluating Pkl.
  Explicit wiring uses the installed hk tool, never installs software or changes
  global Git settings. The checker recognizes direct native local wiring;
  other launchers, unknown/disabled hooks, existing sibling hooks and outside/shared
  destinations are preserved for owner review. Commit-time hook overrides and
  explicit hk skip assignments are covered by the best-effort command policy,
  not a sandbox.
- Skill swaps roll back selected trees, not newly created parents or later full-setup
  phases. Failed rollback retains recovery paths. Installation roots must not be
  concurrently retargeted. Project installs never silently migrate global copies.
- Settings writes preserve resolved links and use exclusive same-directory staging;
  ambiguous paths are refused. Export input aliases are rejected before truncation,
  but unrelated output writes are not crash-atomic.
- Herdr waits observe current statuses/output, not necessarily a newly submitted
  turn. Canceling a wait does not stop its work. Aggregate wait deadlines are checked
  between API calls; inert fixtures do not establish hung-transport timing.
- Session totals reflect recorded usage and available pricing, not billed invoices,
  unique retained context or measured performance. Standalone usage of any kind
  counts under its recorded provider/model, never as a message or model switch.
  Native discovery, older formats, summary usage, local-day/DST math, cancellation
  and headless fallback must survive changes.
- Keep exact receipts and unrun checks in the existing ignored effort record.
  Source, installed copies, remote publication and consuming-agent behavior are
  different states; a local green cannot certify all four.
