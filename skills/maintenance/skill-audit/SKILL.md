---
name: skill-audit
description: "Audit loaded skill roots and surrounding agent configuration for overlap, unused prompts, source drift, instruction conflicts, and prompt-budget waste."
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

Current config and command output outrank memory. Deployed copies are outputs, never editing targets. Suggest changes before deleting untracked user skills.

Deliver: evidence, ranked cleanup candidates, prompt-budget impact, and exact source paths to change.
