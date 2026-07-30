# Learning Record Format

Learning records live in `learning-records/` and use sequential numbering:
`0001-slug.md`, `0002-slug.md`, and so on. Create the directory lazily — only
when the first record is written.

They are the teaching equivalent of ADRs: concise records of non-obvious
lessons, corrected misconceptions, stated prior knowledge, and mission shifts
that should steer future sessions.

## Template

```md
# {Short title of what was learned or established}

{1-3 sentences: what was learned (or what prior knowledge was established), and
why it matters for future sessions.}
```

That is usually enough. The value is recording that this is now known and why it
changes what to teach next.

## Optional additions

Only include these when they add genuine value:

- `Status` frontmatter (`active | superseded by LR-NNNN`) when a later record
  replaces an earlier understanding.
- **Evidence** for how the user demonstrated the understanding.
- **Implications** for what this unlocks or rules out next.

## Write a learning record when

1. The user demonstrated genuine understanding of something non-trivial.
2. The user disclosed prior knowledge that future sessions should not re-teach.
3. A misconception was corrected.
4. The mission shifted in response to learning.

## Do not write one for

- Material that was merely covered.
- Plain glossary definitions already captured in `GLOSSARY.md`.
- Session-by-session activity logs.
