# Decisions

Current decisions that the code does not show. Each entry gives the reason and
what would reopen it. Revise or remove an entry when it is superseded; this is not
a log.

## Memory rules live in the always-loaded charter

The paths for working notes, handoffs and decisions are stated in the charter in
`setup.cjs`, not in each skill. The charter is the only text every project loads.
When only one skill named a path, the other note-writing skills had none, and
their notes went to the one file that was named, the handoff.

Reopen if: the charter grows past what an agent reads reliably.

## Memory paths are fixed in every project

Working notes go in `context/<effort>.md`, the handoff in `context/handoff.md` and
promoted decisions in `docs/decisions.md`. A repository's own convention does not
change these paths, because the harness must behave the same in every project.
Existing records elsewhere stay valid and are not migrated.

Reopen if: a project already uses a root `context/` directory or `docs/decisions.md`
for something else.

## The handoff stays in the repository and only links

The handoff is a git-ignored file in the repository, not a file in the operating
system temp directory. A later session, or an agent on another host, must find it
at a known path, and temp directories are cleared. The handoff links to the working
notes and holds a decision only when no other record holds it.

Reopen if: every supported host gains a shared store that survives a session.

## `project-memory` and `session-close` install globally

Both skills are in the global set. The charter tells every project to write notes
and handoffs under an ignored `context/`, and these two skills supply the ignore
rule and the handoff checks.

Reopen if: setup can supply the ignore rule without a skill.

## No glossary, numbered decision records or issue-tracker setup

One decisions file and one effort record cover the need. A separate glossary file,
one numbered file per decision, a directory of rejected requests and a tracker
setup step are excluded as a framework that each project would have to adopt.

Reopen if: a project needs the history of one decision, or naming ambiguity
affects a contract.
