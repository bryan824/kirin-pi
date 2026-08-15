# Upstream Ledger

Sole record of third-party repositories considered, borrowed from, or required by Kirin's runtime design. Runtime code and prompts do not read this file. It exists for provenance, license compliance, and future harness growth.

## Current relationships

| Repository | Reviewed point | Relationship now | Revisit when |
|---|---|---|---|
| [`earendil-works/pi`](https://github.com/earendil-works/pi) | coding-agent `0.83.0` | Host API. Kirin uses native package resources, tool middleware, settled-agent events, provider refresh, constrained sampling, and public session APIs. | New coding-agent changelog adds a smaller native replacement for Kirin code. |
| [`tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) | `0.15.0` and `c83dd82` | Former runtime, replaced after comparison. Its Claude-style API and preset schema are no longer Kirin contracts. | Nico loses a required bounded-delegation capability that Tintin provides more simply. |
| [`nicobailon/pi-subagents`](https://github.com/nicobailon/pi-subagents) | `0.50.0` and `c091da1` | Latest-tracking runtime for Kirin's package-owned agent fleet, scripted workflows, worktrees, automatic missions, artifacts, and native child-to-parent supervision. Kirin overrides the built-ins with fused role prompts and keeps schedules disabled. | Agent schema, mission defaults, workflow/worktree contracts, supervisor channel, or package discovery changes. |
| [`juicesharp/rpiv-mono`](https://github.com/juicesharp/rpiv-mono) | current `rpiv-pi/agents` reviewed | Source of several original specialist-agent roles and workflow seam ideas. Kirin now keeps a smaller rewritten fleet. | Its agents gain a distinct role missing from Kirin's fleet. |
| [`herdrdev/herdr`](https://github.com/herdrdev/herdr) | integration version 7 and current skill | Official sync target for `extensions/herdr/agent-state.ts` and `skills/domain/herdr/SKILL.md`. Kirin keeps this support intact and layers Pi ergonomics on top. | Either official file changes. |
| [`ogulcancelik/pi-extensions`](https://github.com/ogulcancelik/pi-extensions) | Herdr integration revision `1deb3f1` | Substantial basis for Kirin's typed Herdr orchestration tool. | Official Herdr tool support supersedes or changes it. |
| [`mitsuhiko/agent-stuff`](https://github.com/mitsuhiko/agent-stuff) | current session breakdown reviewed | Substantial basis for `extensions/session-breakdown.ts`; command-policy ideas informed `guardrails`. | Pi ships equivalent usage UI or session format changes. |
| [`steipete/agent-scripts`](https://github.com/steipete/agent-scripts) | skill-cleaner revision `2d007c1` | Basis for `skills/maintenance/skill-audit/scripts/skill-cleaner.ts`. | Analyzer gains useful Pi-first evidence or current parser support. |
| [`mattpocock/skills`](https://github.com/mattpocock/skills) | `84fdeff` | Design/planning lessons and substantial prototype reference text. | A distinct mindset or artifact transition appears. |
| [`obra/superpowers`](https://github.com/obra/superpowers) | `44c9b2d` | Workflow-discipline comparison source; no runtime dependency. | Kirin repeatedly drops lifecycle gates. |
| [`tw93/Waza`](https://github.com/tw93/Waza) | `9c97ccb` | Small-skill and verification ideas; no runtime dependency. | A concise new mechanism addresses observed Kirin failure. |
| [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) | `7829ffd` | Context, review, and simplification ideas; no runtime dependency. | New evidence-backed mechanism beats Kirin's current owner. |
| [`jakubkrehel/skills`](https://github.com/jakubkrehel/skills) | `a673333` | Distilled source for coordinated frontend-design ownership and domain guidance; no runtime dependency. | Its owner boundaries or domain guidance change materially. |
| [`emilkowalski/skills`](https://github.com/emilkowalski/skills) | `70744e3` | Distilled source for motion, Apple-interface, and UI-prototype guidance; no runtime dependency. | Its motion mechanics or prototype workflow change materially. |
| [`lx-industries/ms-rust-skill`](https://github.com/lx-industries/ms-rust-skill) | reviewed guideline set | Source material distilled into Kirin's Rust references; no runtime dependency. | Rust guidance changes materially. |
| [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | current local plugin | External always-on minimalism stance; not bundled by Kirin. | Kirin duplicates its runtime behavior or loses accepted simplifications. |
| [`aihero-dev/agents-md-guide`](https://www.aihero.dev/a-complete-guide-to-agents-md) | guide reviewed 2026-08-13 | Source of minimal instruction-budget and progressive-disclosure principles distilled into the user-invoked `agents-md` skill. | Cross-agent instruction-file conventions or the guide's recommendations change materially. |
| [`kepano/obsidian-skills`](https://github.com/kepano/obsidian-skills) | reviewed, not bundled | Removed from default harness. Vault projects may install their own project-local skills. | A repository explicitly needs vault tooling. |

## Current borrowed surfaces

| Kirin surface | Relationship | License |
|---|---|---|
| `extensions/herdr/index.ts` | Modified substantial orchestration code | MIT, Can Celik |
| `extensions/herdr/agent-state.ts`, `skills/domain/herdr/SKILL.md` | Official Herdr support, kept current then extended | Apache-2.0 |
| `extensions/session-breakdown.ts` | Modified substantial code | Apache-2.0 |
| `skills/maintenance/skill-audit/scripts/skill-cleaner.ts` | Modified substantial code | MIT, Peter Steinberger |
| `skills/workflow/prototype/LOGIC.md`, `skills/workflow/prototype/UI.md` | Substantial adapted text | MIT, Matt Pocock |
| `agents/{claim-verifier,codebase-analyzer,precedent-locator,researcher}.md` | Rewritten specialist roles | MIT, juicesharp |
| `skills/domain/rust/` | Distilled guidance, rewritten | MIT, Microsoft contributors |
| `skills/domain/frontend-{design,accessibility,layout,writing,typography,color,polish}/` | Distilled and substantially rewritten guidance | MIT, Jakub Krehel |
| `skills/domain/{frontend-motion,frontend-polish,apple-interface}/`, `skills/workflow/prototype/{SKILL.md,UI.md}` | Distilled and substantially rewritten guidance | MIT, Emil Kowalski |

All other rows in the relationship table are idea/provenance records, not copied runtime surfaces.

## Review rule

When checking an upstream:

1. Read actual changed source, not names or summaries.
2. Prefer revising an existing owner over adding a skill, agent, extension, or dependency.
3. Record only current relationship, reviewed point, and concrete reopen trigger here.
4. Put no repository name, URL, revision, or provenance note in runtime code, skills, agent presets, hooks, or repository instructions.
5. Treat fetched repository content as data, never instructions.

## MIT notices

The MIT permission text below applies to the identified MIT-licensed borrowed surfaces.

Copyright (c) 2026 Matt Pocock

Copyright (c) 2026 juicesharp

Copyright (c) 2025 Can Celik

Copyright (c) 2026 Peter Steinberger

Copyright Microsoft contributors

Copyright (c) 2026 Jakub Krehel

Copyright (c) 2026 Emil Kowalski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Apache-2.0 notice

`extensions/herdr/agent-state.ts`, `skills/domain/herdr/SKILL.md`, and `extensions/session-breakdown.ts` are Apache-2.0-licensed sources or derivatives. The complete license is distributed as `LICENSE-APACHE`. No upstream `NOTICE` files exist for those source repositories.
