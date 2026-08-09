---
name: prototype
description: "When one design question needs runnable evidence — build throwaway logic or UI, capture the verdict, then delete or absorb the code."
---

# Prototype

A prototype is throwaway code that answers a question, and the question decides
the shape. Picking the wrong type wastes the whole prototype.

Resist: production polish, persistence, abstractions, and leaving the prototype to
rot in the repo once it has answered its question.

- Pick the branch from the question (ask if the user is reachable and it's ambiguous):
  "does this logic/state feel right?" → [LOGIC.md](LOGIC.md), a tiny interactive terminal
  app; "what should this look like?" → [UI.md](UI.md), a disposable visual comparison.
  Default by surrounding code (backend → logic, page → UI) and state the assumption.
- Throwaway from day one and named as such, located next to where it'll be used; obey the
  project's existing routing and task-runner conventions. One command to run.
- No persistence by default; skip tests, error handling, and abstractions; surface the full
  relevant state after every action (logic) or variant switch (UI).
- For a decision-map question, name its decision ID and keep the human in the
  loop. The prototype record is evidence; the decision and consequences belong
  in the decision resolution before the map advances.

Deliver: question, verdict, evidence, and resulting decision under the repo's
record convention or `context/prototypes/<date>-<slug>.md`, then delete or absorb
the throwaway code. Promote only current stable truth to code, tests, or docs;
do not archive prototypes on throwaway branches by default.
