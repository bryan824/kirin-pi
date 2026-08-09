---
name: skill-audit
description: "When a harness needs judging rather than using — measure its skills, agents, extensions, and hooks for overlap, unused prompts, source drift, instruction conflicts, and prompt-budget waste."
---

# Skill Audit

Measure first; `write-skill` owns keep/merge/delete judgment.

Run the co-located analyzer:

```bash
bun skills/maintenance/skill-audit/scripts/skill-cleaner.ts --months 3
# --no-logs
# --scan-projects
# --budget-root PATH
# --root PATH --root-only
# --context-tokens N --budget-percent P
# --all
# --json
```

Read the report in this order: prompt budget, user-invoked skills, description candidates, source/deploy drift, unused candidates, roots.

Then inspect what the analyzer cannot prove:

- instruction drift across `AGENTS.md`/`CLAUDE.md`
- package, hook, extension, permission, and agent-preset conflicts
- stale project memory naming files or commands that no longer exist
- native package resources versus optional flattened cross-agent copies

Each layer earns its keep differently, so judge each on its own test — and against
the host's current native features, since a component built to work around a gap
becomes waste the release that closes it:

- **Skill** — fires on the turns it claims, and carries what the model would not
  do unguided. One that never fires is dead weight whatever its quality.
- **Agent preset** — holds a role the fleet cannot already cover, and returns
  evidence the parent could not have gathered inline.
- **Extension / hook** — owns tooling around state (commands, UI, gates,
  lifecycle) rather than reasoning a skill should carry, and stays one shared
  piece rather than one per caller.
- **Doc** — states truth the environment cannot be asked for. Anything a script,
  config, or `--help` already answers is a cache that will go stale.

Current config and command output outrank memory. Deployed copies are outputs, never editing targets. Suggest changes before deleting untracked user skills.

Deliver: evidence, ranked cleanup candidates, prompt-budget impact, and exact source paths to change.
