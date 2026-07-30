---
name: write-skill
description: "Creating, revising, or cleaning a skill — keep the set small and sharp with situation-first triggers, one mindset each, only the non-obvious, and shared ideas factored out."
---

# Write Skill

A skill is a prompt fragment for a capable model, not a tutorial. It earns its
tokens by carrying only what the model wouldn't already do: the stance to take,
the failure modes it slips into, your local standards, and the seams to
neighboring skills. Cutting the obvious is what makes a skill token-cheap, well
triggered, and roomy to reason in — the same move, not a trade-off.

Resist: a skill per task noun, restating general competence, padding with
procedure and fill-in forms, duplicate bodies across skills.

- Prefer revising an existing skill over adding one. One skill = one mindset.
- Description leads with the situation ("when X…"), then what it does — a
  trigger, not a summary.
- Body: stance → a few non-obvious principles → a one-line carry-forward. Number
  steps only when the order is the point.
- Reach for a leading word — a compact pretrained concept (*tracer bullets*,
  *seam*, *fog of war*) that anchors a behavior in few tokens; make each
  done-condition checkable, not vague. Failure modes and the full vocabulary live
  in `references/SKILL_STYLE.md`.
- Factor shared ideas into one reference; each skill adds only its delta. Shared
  *behavior* factors the sibling way: a real process with two or more hosts
  becomes a skill the others call as a subroutine — a seam that resumes, not
  transitions — while a few lines of posture stay a reference.
- Skills must not grow monotonically: fold a new lesson into an existing
  principle rather than appending a rule; collapsing specifics back into
  principles is maintenance, not loss. Compressing or absorbing a skill runs
  the same test in reverse — a cut must pass "would it do this anyway?"; fold a
  non-obvious instruction into a principle, never drop it. (References load on
  demand; trimming them saves nothing.)
- State is usually just files; reach for an extension or `session_start` hook
  only for tooling around them (commands, UI, gates, lifecycle) — usually one
  shared one, not per skill. Default to model-invoked with a tight trigger and
  body gate. Reserve standard `disable-model-invocation: true` for genuinely
  hand-driven orchestrators that must never autofire; Pi and Claude both honor
  it, but it also prevents other skills from reaching that entry directly.
- Suggest cleanup before editing or deleting anything.

Shape what's actually missing in `design` before adding a new skill. Full guide
and examples: `references/SKILL_STYLE.md`. Project-memory protocol:
`../project-memory/PROJECT_MEMORY.md`. After writing, run `skill-audit` for
collection-wide collisions, drift, use, and prompt budget.

Deliver: the decision (new · revise · clean · extension · harness · memory) and
why, what changed, and any overlap, budget, or consistency concerns.
