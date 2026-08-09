---
name: decision-map
description: "Map a genuinely multi-session decision problem into a bounded frontier, resolve every open question, then hand settled intent to plan."
disable-model-invocation: true
---

# Decision Map

Navigate fog; do not build through it. Use this only when the decision route cannot fit one design session. A clear feature belongs in `design`.

Name the destination and explicit out-of-scope boundary first. Then create one map under `context/decision-maps/<effort>/` using `LOCAL_FORMATS.md`.

- The map is a low-resolution index: destination, standing constraints, linked decision gists, open frontier, unresolved fog, and out-of-scope work.
- One precise unanswered question becomes one decision record with stable ID, type (`design`, `research`, `prototype`, or `task`), and blocker IDs. A `task` is the one type that does rather than decides — provisioning access, signing up so an API can be judged, moving data so its shape becomes visible — and earns its place only by unblocking a decision, never by delivering the destination. Its resolution records what was done plus the facts later decisions depend on.
- Refer to a record by its title in everything a human reads; a wall of bare IDs is illegible, so the ID rides inside the name rather than standing in for it.
- Questions that cannot yet be phrased stay as fog. Do not invent downstream work before the map exposes it.
- Host tasks/runtime own claims and execution status. Markdown owns questions, blocker structure, resolutions, and evidence links only.
- Resolve human choices through `design`, external facts through `research`, and runnable uncertainty through `prototype`. Never simulate the human answer.
- Resolve one record per session, so its consequences reshape the map before the next is chosen. Research is the exception — fan those out in parallel.
- Record decision, consequences, and evidence in its decision file; the map gets only a linked one-line gist.
- After each resolution, re-evaluate blockers, newly visible questions, invalidated edges, and scope.

Set the map to `ready-for-plan` only when no live in-scope question or fog remains. `plan` must read every resolution, not only the map index.

Deliver: map path, open unblocked frontier, unresolved fog, and next decision. Completion hands to `plan`.
