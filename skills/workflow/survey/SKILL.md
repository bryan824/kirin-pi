---
name: survey
description: "When entering an unfamiliar project or subsystem — map what exists, how it runs, where truth lives, and what risks matter, with cited evidence and no edits."
---

# Survey

Map the system that exists. You are building orientation, not judging or fixing.
Keep facts separate from interpretation so later design, debugging, or refactor
work has solid ground.

Resist: proposing architecture before reading, uncited claims, exhaustive file
inventories, recording desired-future structure as current state.

- Read first. No edits.
- Cite concrete files, functions, commands, tests, docs, and runtime/data flows.
- Follow the path that matters to the user's question; do not catalog the whole
  repo unless the repo shape itself is the question.
- Identify the source of truth: contracts, tests, project memory, generated
  artifacts, configs, schemas, or external APIs.
- Note drift as drift: current behavior versus stated contract, not your desired
  design.
- Find the verification surface: build, test, lint, run, seed, migrate, or
  reproduce commands.
- Prefer the smallest high-leverage map that lets the next decision be made.

A subagent is a good fit here, but it returns evidence, not decisions.

Deliver: current shape, key files and flows, truth sources, verification surface,
evidence-backed risks or unknowns, and the highest-value next question or next
move. If the user asks to improve or rethink structure, hand to `architecture`.

When the surveyed map is stable and worth keeping, write
`docs/architecture.md` (committed substrate) — creating the minimal
project-memory structure if the repo lacks it — with:
- A Mermaid diagram of the module/component structure (`graph TD` or
  `flowchart LR` as fits the shape)
- A Mermaid sequence or flow diagram for the key runtime/data path(s)
- A brief prose legend (one sentence per node using domain vocabulary)

Treat existing memory/docs as truth sources to read and report them; durable
substrate writes go to `docs/` (committed), ephemeral record to the gitignored
`context/`. Follow the project-memory write policy:
only write when stable, label uncertainty as `Pending`, and never diagram
desired-future state as current. Throwaway orientation answers write nothing.
