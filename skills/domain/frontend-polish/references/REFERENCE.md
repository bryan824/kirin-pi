# Detail-work edge cases

- Test a nested control in every state, not only at rest: focus rings, selected
  borders, and pressed surfaces can break concentric corners or erase a needed
  structural boundary.
- An asymmetric glyph can be mathematically centered yet look shifted. Compare
  it beside its label and neighboring icons before changing layout-wide spacing.
- A shadow can obscure a structural divider on dense or dark surfaces. Preserve
  the divider when it carries grouping or state; do not replace it with a more
  dramatic shadow.
