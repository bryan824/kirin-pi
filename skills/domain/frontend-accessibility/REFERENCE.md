# Accessibility Edge Cases

Use these only when the ordinary native-first choice leaves a real ambiguity.
They are constraints to reason from, not a substitute for testing the supported
browser and assistive-technology combinations.

## Announcements and names

- Create a polite status region empty and present in the DOM before updating
  it. Replacing a region at the same time as its text can be announced
  inconsistently; reserve interrupting alerts for genuinely urgent changes.
- A visible control label should be contained in its accessible name. Extra
  context is fine, but a speech-command user should be able to say the words
  they see.

## Unavailable and transient UI

- Use native `disabled` when an unavailable native control should leave the tab
  order. Use `aria-disabled` only when discoverability or focusability is
  intentional, then prevent activation in every input path and explain the
  state.
- A modal is a context change, not just a layer: move focus into it, keep it
  from escaping while open, prevent interaction with the background, and return
  focus to the invoker unless the completed action supplies a more appropriate
  destination.

## Physical and motion constraints

- A 24 CSS-pixel target is a conformance floor in the relevant criterion, not a
  universal product target. Choose larger forgiving targets where the control,
  context, and device make reliable activation harder; do not let expanded hit
  areas collide.
- Under reduced motion, remove nonessential movement while preserving the same
  result and timing-independent controls. If code waits for an animation end
  event, ensure its reduced-motion path still completes when that event is
  absent or shortened.
- Verify zoom and narrow reflow with real content: text must remain readable,
  controls operable, and content reachable without a hidden horizontal escape
  route.
