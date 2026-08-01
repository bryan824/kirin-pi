# Motion mechanics

## Gate and continuity

Name the purpose before choosing an effect: feedback, state indication,
orientation, explanation, or a bridge across a jarring change. Then judge the
frequency and context. Motion that repeatedly delays a keyboard, navigation, or
task action is usually noise; rare explanatory or celebratory moments can earn
more presence.

An entering, exiting, or changing object should explain cause and destination.
Use the triggering control or changed edge as its transform origin when there is
one; keep reversible paths coherent. Modals without a spatial source may remain
centered. On interruption, start from the live presentation value, not a stale
logical target, so reversal does not jump.

## Choose and implement the mechanism

- Use a CSS transition for a known state change that should retarget cleanly.
  Declare only the properties that change; never use a broad transition.
- Use keyframes for a bounded, authored sequence that does not need continuous
  input or rapid reversal. Do not use them to simulate a direct manipulation.
- Use a gesture with a spring or equivalent live-value animator when input,
  velocity, momentum, or interruption determines the path. Preserve the current
  presentation value and velocity when the target changes.
- Define enter, exit, and intermediate state values together. A state change
  must remain understandable if it is reversed, repeated, or skipped.

Prefer compositor-friendly transforms and opacity when they express the needed
change. Measure before optimizing; avoid per-frame layout work and inherited
style updates that fan out through a subtree. Use a rendering hint only for an
observed problem and remove it when the motion no longer needs it.

## Direct manipulation

On pointer down, record the active pointer and the grab offset, then capture the
pointer so movement continues outside the element. Move from the live pointer
position without jumping to the element's center. Apply hysteresis before
claiming a direction or committing a drag, and release capture on completion or
cancellation.

Track recent positions and times. On release, use both distance and release
velocity to project an endpoint, select the appropriate target, and hand the
velocity into its settling motion. At a boundary, use progressive resistance
rather than a hard stop when the gesture should remain responsive.

## Reduced motion and review

Provide a reduced-motion equivalent that preserves understanding and completion:
remove or soften vestibular movement while retaining useful state feedback. Test
that the operation does not depend on an animation ending, and coordinate the
accessibility requirement with `frontend-accessibility`.

Review purpose, frequency, continuity, origin, exact transitioned properties,
interruptibility, gesture handoff, reduced-motion behavior, and frame cost.
Contribute evidence and findings through the
[shared review contract](../../frontend-design/references/REVIEW.md).

## Compact vocabulary

- **Presentation value**: the value currently visible, distinct from the target
  stored by application state.
- **Causal continuity**: motion that makes its trigger, path, and result legible.
- **Transform origin**: the anchor from which a scale or rotation appears to
  grow.
- **Transition**: a retargetable interpolation between declared state values.
- **Keyframe sequence**: authored stages for a bounded, non-interactive event.
- **Spring**: a settling motion that can carry live position and velocity.
- **Hysteresis**: a small intent threshold that prevents accidental gesture
  changes.
- **Projected endpoint**: a landing target chosen from release position and
  velocity, not position alone.
