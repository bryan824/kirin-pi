---
name: skill-audit
description: "When reassessing a harness after model, host or upstream changes — measure all layers, challenge the architecture, and propose leaner behavior."
---

# Skill Audit

Measure first; `write-skill` owns skill consolidation and `architecture` owns
structural judgment across the harness.

For a model-upgrade or whole-harness reassessment, load [Harness review](references/HARNESS_REVIEW.md).
For an explicit upstream review or absorption request, load [Upstream review](references/UPSTREAM_REVIEW.md).
Both use [Behavior probes](references/BEHAVIOR_PROBES.md) when comparison evidence is needed.
Narrow local audits stay local. Whole-harness reassessments include bounded official
Pi/Claude Code release and documentation checks; broader upstream absorption and
checkpoint edits remain explicit.

Resolve `SKILL_DIR` to the directory containing this loaded `SKILL.md`, not a
checkout-relative path. For an isolated inventory, run:

```bash
bun "$SKILL_DIR/scripts/skill-cleaner.ts" --root PATH --root-only --no-logs
```

Use `--help` for options. Log scans require appropriate private-data scope;
`--log-root PATH` replaces the default Pi/Claude history roots. Do not expand
roots or collect history merely to fill evidence gaps. Default inventory omits
project `.claude/skills` and package resources; include them only through approved
explicit roots. Use an actual host-exported inventory when available; filesystem
presence, frontmatter eligibility, and the comparison base are not effective
selection or ownership.

Read coverage and skipped/error/byte counts before interpreting results. Commands,
body envelopes, successful Skill results, body reads and reference reads are
separate signals. Missing signals, partial logs, unsupported tools, and inherited
context are unknown—not proof of disuse. Listing/body token estimates are
conditional character-ratio estimates, not native prompts, actual retention,
model compliance, or savings. Reference payload and inherited-context costs remain
unmeasured; hypothetical context budgets require an explicit window.

Then inspect what the analyzer cannot prove:

- instruction drift across `AGENTS.md`/`CLAUDE.md`
- package, hook, extension, permission, and agent-preset conflicts
- stale project memory, weak navigation pointers or competing owners of one fact
- native package resources versus optional flattened cross-agent copies

Each layer earns its keep differently, so judge each on its own test — and against
the host's current native features, since a component built to work around a gap
becomes waste when the host release closes it:

- **Skill** — provides a useful stance on its intended turns. Distinguish a weak
  trigger from missing discovery, selection, or observation before retiring it.
- **Agent preset** — holds a role the fleet cannot already cover, and returns
  evidence the parent could not have gathered inline.
- **Extension / hook** — owns tooling around state (commands, UI, gates,
  lifecycle) rather than reasoning that a skill should carry, and stays one shared
  piece rather than one per caller.
- **Doc** — states truth the environment cannot be asked for. Anything a script,
  config, or `--help` already answers is a cache that will go stale.

For a repeated mechanical mistake, inspect existing tests, lint, scripts and CI:
a missing, unwired or broken check may be the defect. Prefer a focused deterministic
check over another prose rule when it can catch the failure. Keep judgment and
non-obvious authority boundaries in guidance; do not install hooks or add a new
enforcement layer merely because one is absent.

Current config and command output outrank memory. Fix an owned source rather than
an unexplained deployed copy. Similarity is a comparison lead, not identity,
provenance, or permission to overwrite. Preserve user files and require authority
for deletion; a clean local verdict writes nothing.

Deliver: evidence and its limits, ranked simplifications, conditional payload
impact, exact owning paths, and any required validation still unrun.
