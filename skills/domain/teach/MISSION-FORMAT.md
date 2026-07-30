# MISSION.md Format

`MISSION.md` lives at the workspace root. It captures the concrete reason the
user is learning this topic. Every teaching decision — what to teach next, which
resources to surface, which exercises to design — should trace back to this
file.

## Template

```md
# Mission: {Topic}

## Why
{1-3 sentences. The real-world outcome the user is chasing. What changes in
life or work when they have this skill? Avoid abstract framings like "to
understand X" — push for the underlying outcome.}

## Success looks like
- {A specific, observable thing the user will be able to do}
- {Another specific thing}
- {…}

## Constraints
- {Time, budget, prior commitments, preferences, anything that bounds the approach}

## Out of scope
- {Adjacent topics the user explicitly does not want right now}
```

## Rules

- **One mission per workspace.** Unrelated topics get separate workspaces.
- **Concrete over abstract.** "Ship a Rust CLI to my team" beats "learn Rust."
- **Push back on vagueness.** A bad mission is worse than no mission.
- **Revise when reality shifts.** Update the file when the user's goal changes.
- **Keep it short.** If it stops fitting on a screen, it is no longer a compass.
