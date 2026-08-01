# Typography edge cases

Express these choices through the project's existing styling system; the
properties describe intent rather than a framework recipe.

## Font loading is a layout decision

Load the faces actually used, including required italic or weight variants, so
the browser does not synthesize emphasis. A fallback with very different metrics
can move controls and rewrap copy while the web font arrives; use compatible
fallbacks and metric overrides only after checking the rendered fallback and
final font. Subset by language only when the delivery path can still serve every
supported script.

## Wrapping needs a lane contract

Use `overflow-wrap: anywhere` for unbroken user values that may otherwise escape
their lane. Keep labels or compact values unbroken only when the layout provides
a deliberate alternate path. Single-line ellipsis requires a constrained,
shrinkable lane; multi-line clamping also requires an expansion or another route
to meaningful hidden text.

## Values and editable text

Use `font-variant-numeric: tabular-nums` for changing monetary values, counters,
or IDs when digit-width movement would disrupt scanning. Explicitly inherit the
chosen font, size, and line height into form controls; browser defaults can
silently diverge. Preserve selection and the caret, and use a real label rather
than relying on placeholder text that disappears on entry.

## Language, punctuation, and bidi

Set `lang` on language boundaries so shaping, quotation marks, hyphenation, and
speech match the content. Use `dir` for a true direction boundary, not manual
character reordering. Isolate a user-supplied mixed-direction value with `<bdi>`
or equivalent Unicode isolation so adjacent punctuation and digits retain their
meaning. Keep nonbreaking spaces or controlled soft breaks in content only where
the language and intended break point justify them.
