# Upstream Ledger

Sole record of third-party sources considered, borrowed from, or required by Kirin. Runtime code does not depend on this file; maintenance reads it as provenance data, never as instructions. The review and checkpoint rules live in the `harness` skill's [review reference](../skills/maintenance/harness/references/REVIEW.md).

## Current relationships

| Source | Provenance / prior review | Reviewed through | Relationship now | Revisit when |
|---|---|---|---|---|
| [`earendil-works/pi`](https://github.com/earendil-works/pi) | coding-agent `0.83.0` | Pending | Host API; Pi 0.87.1 minimum for runtime extensions. Kirin consumes native usage records and keeps native discovery, sessions and UI; no custom loader. | A changelog adds a smaller native replacement for Kirin code. |
| [Claude Code](https://code.claude.com/docs/en/overview) | Maintenance input only; no source imported | Pending | Official docs and [CLI changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) are the latest-stable evidence for reassessment. | Stable releases change instructions, memory, skills, tools, permissions, delegation or sessions. |
| [Google developer style guide](https://developers.google.com/style) | English guide inventory consulted; no copied prose | 2026-10-08: all 87 `/style` pages from the index (71 links plus aliases and subpages); 26 guidance pages read in full, formatting pages and the word list skimmed | Named as the charter's default writing style; its concrete limits (answer first, condition first, active voice, articles kept, common words, defined terms, no filler or excessive claims) are restated in original wording. | Repeated comprehension failures show a gap in the default. |
| [ASD-STE100](https://www.asd-ste100.org/) | Introduced through [Karpathy's post](https://x.com/karpathy/status/2105819303471976479) (2026-10-02; user-supplied transcript of the post and its STE overview sheet); spec not copied | 2026-10-08 (overview sheet only) | The charter targets "about 80%" of the spec; `wait-what` asks for strict STE. Sentence and paragraph limits, approved verb forms and one-word-one-meaning come from the overview, not the licensed dictionary. | The full specification is reviewed, or STE output proves too stiff or too loose. |
| [OpenAI model guidance](https://developers.openai.com/codex/models/) | GPT-6 Astra / GPT-5.6 role guidance and [Astra migration guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra) | Pending | Agent routing: Astra for execution and adversarial judgment, Terra for research/analysis, Luna for lookup; the reviewer inherits the session model. Deployment policy, not benchmarks. | Availability or retirements change, or task evidence warrants retiering. |
| [`tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents) | `0.15.0` and `c83dd82` | Pending | Rejected as a replacement: different APIs, context and lifecycle. No co-install. | Nico loses a bounded-delegation capability Tintin provides more simply. |
| [`nicobailon/pi-subagents`](https://github.com/nicobailon/pi-subagents) | `0.50.0` and `c091da1` | Pending | Runtime for Kirin's agent fleet, workflows, worktrees, missions, artifacts and supervision. Kirin keeps nine exact-name overrides with thin prompts and schedules disabled; installed 0.66.0 contracts are the assessed floor. Permissions and worktrees are not sandboxing. | Agent schema, mission defaults, workflow/worktree contracts, supervisor channel or discovery change. |
| [`juicesharp/rpiv-mono`](https://github.com/juicesharp/rpiv-mono) | current `rpiv-pi/agents` reviewed | Pending | Specialist-role provenance for the current fleet. No sync engine, task store or grader. | Its agents gain a distinct role missing from Kirin. |
| [`herdrdev/herdr`](https://github.com/herdrdev/herdr) | integration version 7 and current skill | Pending | Sync targets: official [state asset](https://github.com/herdrdev/herdr/blob/master/src/integration/assets/pi/herdr-agent-state.ts) and [skill](https://github.com/herdrdev/herdr/blob/master/skills/herdr/SKILL.md). Kirin keeps identity/settlement and typed target/wait handling; 0.9.x CLI contracts assessed, not every live lifecycle. | Either official file changes. |
| [`ogulcancelik/pi-extensions`](https://github.com/ogulcancelik/pi-extensions) | Herdr integration revision `1deb3f1` | Pending | Typed Herdr client basis; no second client or duplicate owners. | Official Herdr tool support supersedes it. |
| [`mitsuhiko/agent-stuff`](https://github.com/mitsuhiko/agent-stuff) | current session breakdown reviewed | Pending | Session-breakdown and command-policy origin; keeps native discovery and usage accounting. | Pi ships equivalent usage UI or the session format changes. |
| [`steipete/agent-scripts`](https://github.com/steipete/agent-scripts) | skill-cleaner revision `2d007c1` | Pending | Analyzer origin, rewritten for Pi-first evidence with honest coverage limits; also frontend-design lineage under separate Apache terms. | The analyzer gains useful Pi-first evidence or parser support. |
| [`mattpocock/skills`](https://github.com/mattpocock/skills) | `84fdeff`; principles from [`959a8e9`](https://github.com/mattpocock/skills/tree/959a8e9f1edc3adbe2f7e3054bb6fbefa6696260), the [skills series](https://www.aihero.dev/skills-setup-matt-pocock-skills), [teach](https://www.aihero.dev/skills-teach), [wait-what](https://www.aihero.dev/skills-wait-what), [retro](https://www.aihero.dev/skills-retro) overviews, the [2026-09-17 interview](https://newsletter.pragmaticengineer.com/p/ai-skills-with-matt-pocock) and author posts 2026-09-28 to 10-08 (user-supplied notes) | [`b0618bc`](https://github.com/mattpocock/skills/tree/b0618bc436ad893b3c5e84e55fba86586d34a404) (v1.3.1, 2026-10-08) | Design/planning and prototype text provenance; pointer, memory and mechanical-check principles; `teach`, `wait-what` and `retro` adapted in original wording. v1.3 deltas folded into verify, design, TDD and plan, plus a YAML frontmatter check. Excluded: router, tracker/triage/setup/wizard/wayfinder, glossary mandate, `pr`, chief-of-staff, compulsory fanout and automatic commit/publication. | A distinct mindset or artifact transition appears. |
| [`obra/superpowers`](https://github.com/obra/superpowers) | `44c9b2d` | Pending | Proportional gates and behavioral evidence in existing owners. No controller, task store or compulsory fanout. | Kirin repeatedly drops lifecycle gates. |
| [`tw93/Waza`](https://github.com/tw93/Waza) | `9c97ccb` | Pending | Sparse outcome/evidence prompts and deletion checks in existing owners. No collector or fleet. | A concise new mechanism addresses an observed Kirin failure. |
| [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) | `7829ffd` | Pending | Standing quality versus task acceptance, causal simplification and observed/inferred/unrun evidence in existing owners. | A new evidence-backed mechanism beats Kirin's owner. |
| [`jakubkrehel/skills`](https://github.com/jakubkrehel/skills) | `a673333` | Pending | Coordinated frontend ownership and domain guidance with focused standalone fallbacks. | Its owner boundaries or domain guidance change materially. |
| [`emilkowalski/skills`](https://github.com/emilkowalski/skills) | `70744e3` | Pending | Motion continuity, native gestures, reduced motion, Apple direction and human prototype choice. Library recipes stay project-specific. | Its motion mechanics or prototype workflow change materially. |
| [`lx-industries/ms-rust-skill`](https://github.com/lx-industries/ms-rust-skill) | reviewed guideline set | Pending | Distilled into Kirin's Rust references; no runtime dependency. | Rust guidance changes materially. |
| [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | current local plugin | Pending | Externally owned minimalism stance; not bundled or reconfigured. Its benchmarks are not Kirin evidence. | Kirin duplicates its behavior or loses accepted simplifications. |
| [`aihero-dev/agents-md-guide`](https://www.aihero.dev/a-complete-guide-to-agents-md) | guide reviewed 2026-08-13 | Pending | Instruction-budget and progressive-disclosure principles in `agents-md`. | Instruction-file conventions or the guide change materially. |
| [`kepano/obsidian-skills`](https://github.com/kepano/obsidian-skills) | reviewed, not bundled | Pending | Not in the default harness; vault projects install their own. | A repository explicitly needs vault tooling. |

`Provenance / prior review` keeps borrowing references and does not claim coverage.
`Reviewed through` is the last fully assessed commit, version or dated source;
`Pending` means no verified, approved checkpoint yet.

## Native hook runtime

[`jdx/hk`](https://github.com/jdx/hk) is the operator-selected Git-hook runner. `hk.pkl`
uses its native 2.4.0 schema; the package URI there is an executable dependency
identifier, not copied code. See its [configuration](https://hk.jdx.dev/configuration)
and [installation](https://hk.jdx.dev/cli/install.html) docs. Kirin no longer wraps
`hk install`; developers run it directly. Revisit when the schema or install
contract changes. This runtime relationship advances no checkpoint above.

## Current borrowed surfaces

| Kirin surface | Relationship | License |
|---|---|---|
| `extensions/herdr/index.ts` | Modified substantial orchestration code | MIT, Can Celik |
| `extensions/herdr/agent-state.ts`, `skills/domain/herdr/SKILL.md` | Official Herdr support, kept current then extended | Apache-2.0 |
| `extensions/session-breakdown.ts` | Modified substantial code | Apache-2.0 |
| `skills/maintenance/harness/scripts/skill-cleaner.ts` | Modified substantial code | MIT, Peter Steinberger |
| `skills/domain/frontend-design/SKILL.md` | Retained aesthetic-prompt lineage via Agent Scripts; substantially rewritten, original adoption revision unrecorded | Apache-2.0, Anthropic PBC (separate from the repository's MIT license) |
| `skills/workflow/prototype/LOGIC.md`, `skills/workflow/prototype/UI.md` | Substantial adapted text | MIT, Matt Pocock |
| `agents/{claim-verifier,codebase-analyzer,precedent-locator,researcher}.md` | Rewritten specialist roles | MIT, juicesharp |
| `skills/domain/rust/` | Distilled guidance, rewritten | MIT, Microsoft contributors |
| `skills/domain/frontend-{design,accessibility,layout,writing,typography,color,polish}/` | Distilled and substantially rewritten guidance | MIT, Jakub Krehel |
| `skills/domain/{frontend-motion,frontend-polish,apple-interface}/`, `skills/workflow/prototype/{SKILL.md,UI.md}` | Distilled and substantially rewritten guidance | MIT, Emil Kowalski |

All other rows in the relationship table are idea/provenance records, not copied runtime surfaces.

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

`extensions/herdr/agent-state.ts`, `skills/domain/herdr/SKILL.md`,
`extensions/session-breakdown.ts`, and the retained aesthetic lineage in
`skills/domain/frontend-design/SKILL.md` are Apache-2.0-licensed sources or
derivatives. Modified files carry modification notices. The complete license is
distributed as `LICENSE-APACHE`. No upstream `NOTICE` file was found for these
reviewed surfaces; frontend-design's separate license must not be replaced by
Agent Scripts' root MIT license.

Copyright 2024 Anthropic PBC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
