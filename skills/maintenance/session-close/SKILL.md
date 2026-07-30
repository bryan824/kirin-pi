---
name: session-close
description: "When ending a session or switching agents — leave only the resume context and durable lessons that would otherwise be lost."
---

# Session Close

Close cleanly, without turning the session into a diary.

Create a handoff only when work must resume elsewhere. Write `context/sessions/<date>-<slug>.md` with:

- goal and current approved plan/unit
- decisions and contracts
- completed work and changed files
- verification commands and results
- blockers, risks, and exact next step

Re-verify referenced files and commits when resuming; a handoff is evidence, not truth.

Create a reflection only when this session exposed a recurring correction, surprise, or reusable win not already captured by code, tests, or docs. Write `.pi/reflections/<date>-<slug>.md` with what happened, root cause, and smallest proposed durable fix. Do not apply that fix here.

Project facts belong in current docs. Tactical fixes belong in code or tasks. Secrets are redacted. If neither handoff nor reflection is earned, write nothing and say so.

Deliver: created paths or explicit no-record verdict, plus the next action if work continues.
