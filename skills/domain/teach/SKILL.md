---
name: teach
description: "When the user explicitly wants to learn a subject as an ongoing, multi-session effort — a study plan, curriculum, or learning workspace — not a one-off question or quick explanation. Turns the cwd into a teaching workspace with a mission, trusted resources, short lessons, and learning records."
disable-model-invocation: true
---

# Teach

Treat the current directory as a teaching workspace. The point is not to answer
one question well; it is to leave behind a better learner and a workspace that
knows where they are. Enter this mode only for a real request to learn something
over time — if the user just wants a one-off answer, give it and stop, don't
open a workspace. Before scaffolding files, confirm they want a persistent,
multi-session workspace in this directory, and resume an existing one rather
than restarting it.

Resist: generic tutoring, relying on parametric knowledge, long lessons,
activity logs, and drifting away from the user's real reason for learning.

- Start with the mission. If `MISSION.md` is absent or vague, interview for the
  concrete outcome first; write or update it with
  [MISSION-FORMAT.md](MISSION-FORMAT.md).
- Build knowledge from trusted sources, not memory. Curate `RESOURCES.md` with
  [RESOURCES-FORMAT.md](RESOURCES-FORMAT.md), separating **Knowledge** from
  **Wisdom** / communities, and surface gaps explicitly. Wisdom is earned in the
  real world: answer what you can, then point the user to a high-reputation
  community to test it.
- Teach one small win at a time. Each session usually produces one short lesson
  under `lessons/NNNN-slug.html`: tightly scoped, tied to the mission,
  completable quickly, and clean enough to print. Back every claim with a
  citation and point to the one best primary source; link to related lessons and
  reference docs; offer to open the file; and close by inviting follow-up
  questions.
- Keep the user's zone of proximal development current. Read `learning-records/`
  before choosing what to teach next; write a new numbered record only when the
  user demonstrated understanding, disclosed prior knowledge, corrected a
  misconception, or changed the mission, using
  [LEARNING-RECORD-FORMAT.md](LEARNING-RECORD-FORMAT.md). Keep teaching
  preferences and open threads in `NOTES.md`, separate from what was learned.
- Separate knowledge from retention. Keep explanations as simple as possible,
  then build storage strength with retrieval practice, spaced revisit, and light
  interactive work with immediate feedback — and keep quiz answers the same
  length so formatting leaks no tell. Difficulty belongs in practice, not in
  exposition.
- Build durable references. Promote compressed, reusable knowledge into
  `reference/*.html` docs and `GLOSSARY.md` only after the user genuinely
  understands it. Glossary terms become the canonical language; use
  [GLOSSARY-FORMAT.md](GLOSSARY-FORMAT.md).

Deliver: updated mission/resources/records as needed, the next lesson or
resource move that best serves the mission, and what evidence would justify the
next learning record or glossary addition.
