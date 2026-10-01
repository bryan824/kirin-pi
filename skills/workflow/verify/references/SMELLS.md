# Smell Baseline

These are contextual leads for the Standards axis, not automatic refactor orders.
Repository rules and a demonstrated causal problem outrank generic taste. Supply
this reference or its reachable path to an independent reviewer when needed.
Do not turn a possible smell into a required fix without explaining the impact.

- **Mysterious Name:** a name hides behavior or meaning. Clarify it; check whether
  the underlying concept is confused before merely renaming.
- **Duplicated Code:** repeated policy can drift. Consolidate a shared concept,
  not code that only happens to look alike.
- **Feature Envy:** behavior depends heavily on another owner's internals.
  Consider moving it or improving the interface when that restores locality.
- **Data Clumps:** values repeatedly travel under the same invariants. A cohesive
  type may help; an extra wrapper without a real concept does not.
- **Primitive Obsession:** unvalidated primitives obscure a consequential domain
  rule. Put validation and meaning at the owning boundary.
- **Repeated Switches:** recurring dispatch can scatter policy. A shared map or
  polymorphism may help; neither is inherently better than a clear switch.
- **Shotgun Surgery:** one behavior change forces unrelated-looking edits.
  Gather the policy where it can change coherently.
- **Divergent Change:** unrelated reasons to edit one module suggest mixed owners.
  Split only when the new boundary reduces coupling rather than moving it.
- **Speculative Generality:** unused variation, hooks or abstractions serve no
  current contract. Remove them while preserving required behavior.
- **Message Chains:** callers navigate details they should not know. Hide the
  policy behind an interface that actually reduces their knowledge burden.
- **Middle Man:** a layer adds no leverage, protection or test seam. Remove it;
  a single adapter with a real boundary can still earn its keep.
- **Refused Bequest:** implementations discard inherited obligations. Reconsider
  the abstraction or use composition rather than forcing a false relationship.

Prefer deletion, existing code and native features when they preserve the
contract. Never simplify away validation, data protection, accessibility,
authority checks or required evidence to satisfy a smell heuristic.
