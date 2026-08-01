# Rendered-color edge cases

- A nominally compliant text token can fail after a translucent surface, scrim,
  disabled state, or image is composited beneath it. Sample or calculate the
  final pixels for each state, including hover and selection.
- Gradients and photography have no single background value. Check the least
  favorable intended crop or add a stable backing surface; a favorable mock is
  not evidence.
- Wide-gamut colors can clip differently by display and browser. Review the
  baseline gamut first, then confirm that an enhancement does not change a
  status, action, or focus color's apparent role.
- Dark surfaces often need more than reversed lightness: muted borders can
  vanish and saturated accents can advance too strongly. Compare hierarchy in
  context, then remeasure the rendered pair.
