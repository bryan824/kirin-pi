# Smell Baseline

The Standards axis carries this baseline even when a repo documents no standards of
its own. Two rules bind it: a documented repo standard always wins and suppresses
the smell it endorses, and every entry is a labelled heuristic ("possible Feature
Envy") rather than a hard violation. Skip anything tooling already enforces.

When the Standards axis runs as an independent reviewer, paste this list into its
brief — it has no other access to it.

Each entry reads *what it is* → *how to fix*. Match against the candidate:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → Rename it; when no honest name comes, the design underneath is murky.
- **Duplicated Code** — the same logic shape in more than one hunk or file. → Extract the shape, call it from both.
- **Feature Envy** — a method reaching into another object's data more than its own. → Move the method onto the data it envies.
- **Data Clumps** — the same few fields or parameters travelling together, a type wanting to be born. → Bundle them into one type and pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept. → Give the concept its own small type.
- **Repeated Switches** — the same switch or if-cascade on the same type recurring across the change. → Replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forcing scattered edits across many files. → Gather what changes together into one module.
- **Divergent Change** — one module edited for several unrelated reasons. → Split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks for needs the spec doesn't have. → Delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → Hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly delegates onward. → Cut it; call the real target directly.
- **Refused Bequest** — a subclass or implementer ignoring or overriding most of what it inherits. → Drop the inheritance, use composition.
