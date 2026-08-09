---
name: design
description: "Before building, or when asked to grill or stress-test an idea — hypothesize the real intent, interview the decision frontier, and resolve goals, non-goals, contracts, and one explicitly approved direction; questions only an absent stakeholder can answer become a hand-off questionnaire."
---

# Design

Turn fuzzy intent into a boring, rebuildable design, and stop before code. What
people ask for and what they want differ; the cheapest moment to find the gap is
before anything exists.

Resist: writing code "to explore" before approval, asking what the repo already
answers, grilling the user on what only an absent stakeholder knows, comparing
options when the choice doesn't matter, batching questions that reframe each
other, accepting a sophistication-signaling answer, treating "sounds good" as
approval, big-bang slices that can't be reversed.

- Scale the ceremony to the decision. An unambiguous self-contained ask gets an
  answer, not an interview. This needs a live user: in CI, a scheduled or looped
  run, or any autonomous context, report the underspecification as a blocker
  instead of guessing through it.
- Open with a one-sentence hypothesis of what the user actually wants and an
  honest confidence number; below ~70% name what's missing, so they know what the
  interview has to close. Restate the ask as the problem it solves rather than the
  solution it names — "a dashboard" is often "a list".
- Classify every unknown as a discoverable fact, a decision, or knowledge held by
  someone not in the room. Facts come from the repo, docs, and git history; look
  them up, and dispatch a subagent rather than asking. Decisions are the user's,
  except reversible low-impact ones, which are yours to make rather than to ask
  about. When an absent stakeholder holds the answer, grill the send, not the
  subject — the user can always say who it goes to and what they need back — then
  draft the questionnaire they hand off — one document per recipient, every
  needed answer covered by a question: one idea per question, most important
  first because async may get only one pass, an answer stub under each, and
  partial answers or "I don't know" invited over silence. Either dispatch —
  subagent or questionnaire — is an unsettled prerequisite, not a blocker; only
  questions downstream of it wait.
- Work the decision tree in frontier rounds. The frontier is every decision whose
  prerequisites are settled; ask it in one numbered round, then recompute. A
  question that depends on another still open belongs to a later round. Cap the
  round at what the user can actually react to — highest leverage first, defer the
  rest; a round they skim is worse than two rounds. Ask alone only when an answer
  would *reframe* the other questions rather than merely unblock them.
- Attach your guess and the reasoning behind it to every question: reacting to a
  wrong guess is faster than answering cold, and it puts your assumptions where
  they can be corrected. Shape the round for delta replies — a short title per
  question, the recommendation on its own line, concrete options where the space
  is enumerable — so "all as recommended except Q3" is a complete answer. Guess
  sometimes in a direction you expect pushback on, so agreement stays informative.
- When the shape isn't obvious, diverge before converging: 3–5 variations through
  inversion, constraint removal, radical simplification, and the 10x version,
  grounded in what the repo actually has. Cluster to two or three genuinely
  different directions and weigh each on value (painkiller or vitamin),
  feasibility, and differentiation. Skip this whole move when the shape is
  already clear.
- Listen for want versus should-want. Best-practice talk, deference to "how it's
  usually done", and "modern", "scalable", or "robust" as goals are answers that
  sound thoughtful instead of true; ask what they would want if they didn't have to
  justify it to anyone. Run the same check against the code — when a claim
  contradicts what's there, surface it ("you said partial cancellation, but the code
  cancels whole orders — which is right?"). Be honest rather than supportive; a
  design partner is not a yes-machine.
- Pin measurable goals ("faster" → a number to hit) and non-goals *with their
  reasons* — focus is saying no to good ideas, and half of misalignment is silent
  disagreement about what isn't being built. Keep `docs/glossary.md` honest inline
  as terms resolve — read it when present, create it at the first resolved term,
  challenge overloaded or conflicting terms, and record each winner with the
  synonyms to avoid; project concepts only, free of implementation detail. Across
  bounded contexts, say which context owns a term and record cross-context
  relationships instead of flattening them. Force precision with invented concrete
  scenarios that probe the boundary between neighboring terms, not abstractions.
- Settle contracts, data models, error modes, and test seams before implementation.
  Name three kinds of assumption: what you are betting is true but haven't
  validated and how to test it, what would kill the design outright, and what you
  are deliberately ignoring and why that is fine for now. Deform the design to
  survive a load-bearing one.
- Shape work as vertical outcomes, each independently verifiable and reversible,
  riskiest proof first. Follow existing patterns, YAGNI ruthlessly, and leave
  unrelated refactoring alone. Expose likely file-ownership conflicts, but leave
  stable IDs and blocker edges to `plan`. Offer an ADR under `docs/decisions/` only
  when the decision is hard to reverse, surprising without context, and a real
  trade-off; write it as a paragraph naming what was decided and why, earning a
  section for rejected alternatives or consequences only where those must outlive
  the decision itself.

Route out when the question stops being yours: a structural target to
`architecture`, an external fact to `research`, and a decision route too large for
one session to `decision-map`. Send a question to `prototype` when the user would
understand it better by seeing than by reading — a question *about* UI is not
automatically visual ("what kind of wizard?" is conceptual; "which of these wizard
layouts feels right?" is visual). Invoked from a `decision-map` record, resolve only
that record's question, return the decision and its consequences, and stop; the map
owns the wider frontier.

The interview is done when the frontier is empty and you can predict the user's
reaction to the next three questions you would ask. If several rounds pass without
confidence rising, something foundational is missing — say so and step back rather
than grinding. Then summarize: outcome, who benefits, why now, measurable success,
non-goals and their reasons, resolved decisions, assumptions, contracts and test
seams, rejected alternatives, and any branch still open. An unexplored branch is
not agreement.

Approval is an explicit yes to the whole summary. "Whatever you think best" is
delegation — re-ask with two concrete options. "Sounds good" or "sure, let's go" is
ambiguous — ask what they would refine. Silence followed by "okay, let's start"
means they gave up on the interview rather than converged — ask what you missed.

Deliver: the approved design summary, contracts and test seams, assumptions with
their tests, any questionnaire still out with a stakeholder, and the exact next
route — one bounded outcome to `implement`, multi-context implementation to
`plan`. Do not write code, scaffold files, or produce parallel planning
artifacts; a stakeholder questionnaire is interview output, not scaffolding.
