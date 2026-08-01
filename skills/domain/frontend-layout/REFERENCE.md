# Layout edge cases

Use the project's existing styling system; these are behavior-level CSS
patterns, not a new styling layer.

## Shrinkable lanes

A flex or grid child can preserve its min-content width and force siblings out
of view. Give the child that contains variable content a zero inline minimum
(`min-inline-size: 0`); for equal grid tracks, use `minmax(0, 1fr)` rather than
an unconstrained fractional track. Then choose the text's wrap or truncation
policy with `frontend-typography`—removing the minimum alone only moves the
failure.

## Stable edge chrome

A fixed or sticky action region needs padding that includes the relevant safe
area inset. Keep its content in normal logical insets, and add the platform
inset to the edge padding so a gesture area cannot cover the action. Ensure
scrollable content has enough end padding to reach its final item above that
region.

## Direction and order are separate

Logical insets and `text-align: start` mirror geometry, but they do not repair a
visual reorder that disagrees with DOM order. Keep focus and reading order in
source order; use layout only to place it. Put direction on the smallest content
boundary that changes direction, not on isolated physical offsets.

## Hidden overflow must communicate

A clipped row, scroller, or collapsed section needs an affordance: a disclosure
control, a deliberate partial next item, or an equivalent established cue. Do
not use clipping merely to make a crowded first view appear complete.
