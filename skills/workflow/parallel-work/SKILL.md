---
name: parallel-work
description: "When ready work splits into file-disjoint units — assign bounded packets to model tiers, make blocked workers escalate, and integrate only independently reviewed results."
---

# Parallel Work

Parallelism is a modifier, not a lifecycle stage. Stay single-track unless ready units are genuinely independent.

- Estimate each unit's writable files before spawning. Shared schema, API, config, or files force serialization.
- Keep judgment with the parent. Use cheap models for bounded mechanical work; use strong models for decomposition, risky review, and arbitration. Use commands for questions a command can settle.
- Give each worker a packet: outcome, why, relevant files, writable files, forbidden files, constraints, one verification command, and escalation conditions. Do not send the whole transcript.
- Workers run `implement`, touch only owned files, and stop on ambiguity, overlap, a forbidden-file need, or repeated failure.
- Use the active runtime's bounded worker role with filesystem isolation when available, and a distinct read-only reviewer. Caller chooses foreground/background; do not bake scheduling into the packet.
- Let the installed runtime's own skill and tool schema provide orchestration syntax, durable-run semantics, and parent-contact mechanics. This skill owns the portable packet and review contract, not a vendor API.
- A blocked worker is not re-run unchanged. Change the packet, model tier, or decomposition.
- Run `verify` on each unit before the parent integrates it, using a reviewer that did not write the code. Workers never merge or push.

Deliver: per-unit files, verification, risks, blockers, review verdict, and parent integration decision.
