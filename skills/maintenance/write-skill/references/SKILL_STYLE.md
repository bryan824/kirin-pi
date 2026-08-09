# Skill Style

The formal guide for writing, revising, and cleaning skills in this pack. The
`write-skill` SKILL.md is the lean trigger; this is the reasoning behind it.

## What a skill is for

A skill is a prompt fragment injected into a capable model the moment it becomes
relevant. The reader already knows how to code, debug, test, and reason — so a
skill does **not** teach the task. It earns its tokens by carrying only what the
model would not already do:

- **Stance** — the posture to take for this class of work.
- **Failure modes** — the specific ways a capable model still slips here.
- **Local standards & tools** — what "good" means here; your conventions,
  commands, and memory model.
- **Seams** — where this skill ends and the next begins.

Everything the model would do anyway is noise. Cutting it is what makes a skill
token-cheap, accurately triggered, and roomy enough to reason in. Those are the
same move, not a trade-off: removing the obvious is what frees the model to
think.

## Two stages, two jobs

Skills load progressively. Write each stage for its own job.

- **`name` + `description`** — always in context; a *trigger*, not a summary.
  Its only job is to help the model decide "is this relevant right now?"
- **Body** — loaded on trigger; a *behavior prior* that reshapes how the model
  approaches the task.

Heavy or shared material — long checklists, schemas, scripts, examples — lives
in `references/`, read only when needed. Pay tokens when relevant, not before.
Within a file, co-locate: keep a concept's definition, rules, and caveats under one
heading rather than scattered, so reading one part brings its neighbors with it.

A description is one instance of a **context pointer** — a reference held in
context that names out-of-context material and encodes the condition for reaching
it. A `references/` link and an `AGENTS.md` line naming a doc are the same object,
so the same rules bind them: the pointer's *wording*, not its target, decides
whether the agent reaches the material, which makes a must-have target behind a
vague pointer a variance bug. Sharpen the wording first and inline the material
only when sharpening fails. Front-load the triggering word, keep one trigger per
branch — synonyms renaming a single branch are one branch written twice — and cut
identity the body already carries.

Every pointer spends one of two budgets. **Context load** is what always-loaded
material costs the model — a description, an `AGENTS.md` line — paid every turn
whether or not it fires. **Cognitive load** is what it costs the human: which
documents exist and when to reach for each, with the human as the index. Only the
first is worth minimizing outright; cognitive load is the price of human agency,
so spend it where human judgment matters and remove it where it does not.

## Description: situation first

Lead with the situation, then what the skill does, then the few discriminating
nouns.

- Good: `A check fails or behavior is wrong and the cause isn't obvious —
  reproduce, isolate the root cause, fix narrowly, and prove it.`
- Avoid noun piles (`reproduce, isolate, regression, contract, runtime…`) — they
  fire on the wrong turns.
- Avoid generic verbs alone: improve, help, analyze, optimize, manage.
- No two skills share a description.

## Body: the skeleton

Three beats, applied consistently. Consistency comes from the shared beats and a
shared vocabulary — not from identical headers. Let structure emerge from
content.

```
Stance         1–2 lines: the mindset + the default it counters.
Principles     3–6 imperatives; only the non-obvious; ordered only if order is the point.
Carry-forward  one line: what a good result contains + the seam to the next skill.
```

- **Open by resetting the stance, not by listing steps.** One sharp line of
  posture beats six numbered steps and survives the messy real case.
- **Principles, not procedure.** The model sequences fine on its own. Number
  steps only when getting the order wrong is the failure ("reproduce *before*
  patching") — then state the order as the point.
- **Outcomes, not output forms.** Name what a good result contains and let the
  model shape it. Use a rigid output schema only when something downstream parses
  it — then say so, and explain why. Two properties make a done-condition a lever:
  **clarity**, so the model can tell done from not-done, and **demand**, how much
  the bound requires. Demand drives the legwork inside the step and binds flat
  reference as readily as a sequence — "every rule applied" is a bar, "every
  modified file accounted for" is a bar, "produce a change list" is not.
- **Match the form to the failure.** How you write a line depends on how the model
  fails here. Wrong-*shaped* output (bloated, buried, restated) wants a positive
  recipe — name what the output is, in order. An omission wants a structural slot in
  a template. Context-dependent behavior wants a conditional on an observable
  predicate. A prohibition ("don't X") is the weakest tool for *shaping* — under a
  competing incentive the model negotiates with it, and naming the banned behavior
  drags it into context where it becomes *more* available rather than less. Prompt
  the positive target so the banned behavior goes unspoken; reserve `Resist:` for
  real discipline slips, and add no nuance clause ("don't X unless Y" reopens it;
  make the exception its own conditional).
- **Every line passes "would it do this anyway?"** If yes, cut it. The test is
  model-relative — settle a dispute by running the skill against a no-guidance
  control: if the control doesn't show the failure there's nothing to fix, and
  outputs that converge across a few reps mean the wording binds (five readings of
  one line mean it doesn't). It also grades whether a leading word earns its
  repetitions.
- **Absorbing or compressing a skill runs that test in reverse.** Every *cut*
  must pass "would it do this anyway?" too. A non-obvious instruction the model
  wouldn't reach alone — make quiz answers the same length so formatting leaks
  no tell; cite every claim — gets folded into a principle, never dropped. The
  failure mode of absorption is not only bloat (restated competence); it is
  quietly losing the one line that was the point. References load on demand, so
  trimming them buys almost no budget — spend compression on the body and leave
  the references whole.

## Leading words

A **leading word** (Leitwort) is a compact concept already in the model's
pretraining — *tracer bullets*, *fog of war*, *seam*, *deletion test* — that the
agent thinks with while running the skill. Repeated as a token (not respelled into a
sentence each time), it accumulates a distributed definition and anchors a whole
region of behavior in the fewest tokens, by recruiting priors the model already
holds.

It serves predictability twice. In the body it anchors *execution* — the agent
reaches for the same behavior every time the word appears. In the description it
anchors *invocation* — word the trigger with the words you'd actually type when you
want the skill, and it fires more reliably. Coin your own only when none fits: a
made-up word recruits no priors, so you pay in definition tokens what a pretrained
one gives free. Hunt for restatements a single leading word would retire — "fast,
deterministic, low-overhead" → a *tight* loop; "a signal you believe in" → the loop
goes *red*.

## Don't repeat across skills

Repetition between skills is a smell — the shared idea wants to be factored out.

- The project-memory protocol lives once in `references/PROJECT_MEMORY.md`. A
  skill adds only its one-line delta — which canonical `docs/` (committed
  substrate) or `context/` (gitignored record) path it updates. Writes adopt
  memory on first use; no skill names a fallback tree.
- The inline/subagent norm is the default (inline; the parent owns decisions).
  State it in a skill only where it carries real signal — "a good
  independent-review candidate," "a subagent returns evidence, not decisions."
  Otherwise omit it.
- The **environment** is a source of truth too — `package.json` scripts, config
  files, the directory layout, `--help` output — so a document restating it is a
  **cache**, earning its load only when the lookup is expensive. Cache what the
  model cannot find by looking: the unwritten convention, the reason behind a
  choice, the gotcha no config confesses. Leave one-command lookups to the
  environment, where they cannot go stale.

Those bullets factor shared *knowledge* into a reference. Shared *behavior* — the
same process run step by step in several skills — factors the other way: into a
skill the hosts call as a **subroutine**, a seam that *resumes* rather than the
usual terminal seam (`verify` → `commit`). The called skill stays the single
source of that behavior; each host adds only the delta around the call. Hold it to
a higher bar than a reference, since a subroutine skill carries its own description
and mindset:

- **Two or more genuine hosts** running the *same* process — not merely asking
  questions near each other. A host that *inverts* the posture (a thesis-first
  skill is no host for an interview-first subroutine) does not count.
- **A real process, not a line.** A few lines of shared posture stay a reference,
  or one owner the others name; promoting them to a skill is the skill-per-noun
  smell.
- **Portable on both ends:** the called skill is model-invoked like any other —
  composition rides the situation-first description and `RESOLVER.md`, never
  harness-only frontmatter.

## One skill = one mindset

Don't create a skill per task noun. Prefer revising an existing skill over adding
one. Before adding a genuinely new one, shape what's actually missing in
`brainstorming`/`design` — a new skill claims a whole mindset is absent, not that
one turn went badly. If two skills share most of their body, merge them or factor
the overlap into one and cross-link.

Split only when the cut earns it, by one of two: by *invocation* (a distinct
trigger the skill should fire on its own) or by *sequence* (a run of steps so long
the steps ahead tempt rushing the one in front). Each cut costs — another
always-loaded description, or one more skill to remember.

Put behavior in the right layer:

- **Skill** — reasoning and posture for a class of work.
- **Extension / hook** — tooling around state: commands, UI, gates, lifecycle,
  concurrency, compaction. The state itself is usually just files; reach for one
  shared extension, not one per skill.
- **Harness / project memory** — settings and durable project truth.

## Invocation: Pi-first, then portable

Pi is the primary harness, so kirin's frontmatter is **Pi's standard**: the Agent
Skills standard plus `disable-model-invocation` (`test/skills.test.cjs` enforces
exactly this set). Claude Code and Cursor honor that key too; Codex isn't a target,
and other non-standard keys stay rejected (including Claude-only `argument-hint`).
A skill therefore **can** mark itself user-only — `disable-model-invocation: true`,
covered below. Default to model-invoked, though, and control blast radius with the
two levers short of user-only:

- **A tight situation-first description** — the primary guard, so the model
  fires the skill only when the situation truly matches. Most skills need
  nothing more.
- **A body gate** for heavyweight, stateful, or side-effecting skills — confirm
  before the first irreversible write. `commit` (won't push without an explicit
  go-ahead) is the model-invoked type case; `teach` does both — user-invoked *and*
  gated, so even `/skill:teach` confirms before scaffolding a workspace.

User-only works because both targets honor the flag natively: Pi hides the skill
from the system prompt entirely (name and description), Claude Code drops the
description and keeps the name. The human then reaches it by `/skill:name` or
`/name`, and `RESOLVER.md` is the router that remembers it exists. Reserve it for
skills that should *never* autofire — side-effecting, expensive, or purely
hand-driven — not as a budget dodge: the description is *how* the model knows when
to fire a skill, so hiding it trades context for the skill's own reachability. The
budget self-manages anyway — Claude Code fits descriptions into ~1% of the window
and drops the least-used first (`/doctor` shows it; `skillOverrides: name-only`
frees budget in config without touching invocation). Weight still earns pruning,
but the on/off switch is for entry control, not budget.

Know the gate's limit: it stops a bad *write*, not a bad *entry* — the skill is
auto-discovered and the model enters the mode before it reads the gate. When a
wrong *entry* is itself the harm, `disable-model-invocation` is the real lock, now
portable across both targets; reach for it then (noting Claude Code has had bugs
blocking even explicit `/name` invocation).

The state a stateful skill persists is just files it reads and writes — the
durable artifact is that file tree, not a per-skill runtime. Reach for an extension or a `session_start` hook only for the
tooling around those files: a model-callable tool, a TUI, auto-setup or
lifecycle, concurrency — and usually one shared extension, never one per skill.

## Failure modes

Named diagnostics for what goes wrong in a skill — the shared vocabulary
`skill-audit` points at:

- **Premature completion** — ending a step before it's done, attention slipping to
  *being done*, pulled by the later steps still visible ahead. Sharpen the
  completion criterion first (cheap, local); only split to hide later steps if the
  bound is irreducibly fuzzy *and* you observe the rush. Hiding works only across a
  real context boundary — a hand-off or a subagent dispatch — since an inline call
  leaves those steps in context and clears nothing.
- **Sediment** — stale layers that settle because adding feels safe and removing
  risky. The default fate of any skill without a pruning discipline.
- **Sprawl** — simply too long, even when every line is live and unique. Cure with
  the reference/disclosure ladder and by splitting.
- **Duplication** — the same meaning in two places; costs maintenance and inflates
  the meaning's prominence past its real rank. The accidental inverse of a leading
  word, which repeats a *token* on purpose, never the meaning.
- **No-op** — a line the model already obeys by default, so you pay load to say
  nothing. A weak leading word (*be thorough*) is a no-op; the fix is a stronger
  word (*relentless*), not a different technique.

## Cleanup

Verification is part of writing, not only auditing: after a new or revised skill,
confirm its trigger fires on the intended turns and overlaps no sibling's
description — a skill that never fires is dead weight, and `skill-audit` is the
cheapest check. Suggest first; edit or delete only when asked. When auditing,
check:

- loaded roots and package metadata
- duplicate names or near-identical bodies/descriptions
- long descriptions and cross-skill boilerplate
- unused or untriggerable skills
- whether the behavior belongs in an extension, the harness, or project memory

Keep priority: project policy > package skill > personal duplicate > archive.
Preserve trigger nouns when compressing descriptions.
