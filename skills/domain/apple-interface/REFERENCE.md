# Apple-style interaction details

## Motion seam

Gesture state, pointer capture, intent thresholds, release velocity, target
projection, and spring behavior belong to
[frontend-motion](../frontend-motion/SKILL.md). For this style, bias those shared
mechanics toward immediate contact feedback, one-to-one manipulation, quiet
settling, and spatially coherent navigation; do not maintain separate formulas
or thresholds here.

## Give material a job

Translucency should separate a functional layer from moving content, not become
a blanket finish. Give heavier material to structural separation and lighter
material to a foreground action; do not stack light translucent surfaces, where
both hierarchy and legibility collapse. Let a modal dim and subordinate its
background; keep a parallel panel visually connected instead of treating it as
a modal by default.

When reduced transparency is preferred, make the layer more opaque or solid
rather than merely removing its blur. When increased contrast is preferred,
make boundaries and foreground/background separation explicit. Coordinate the
rendered contrast and preference behavior with
[frontend-color](../frontend-color/SKILL.md) and
[frontend-accessibility](../frontend-accessibility/SKILL.md).

## Let type belong to the platform

Start with the platform system type before introducing a custom face. Tune
tracking and leading by role and size instead of applying one value everywhere:
large display type usually needs a tighter relationship, while small reading
text needs room to remain distinct. Honor system and browser text scaling, and
let surrounding dimensions grow with it rather than protecting a fixed visual
size. [frontend-typography](../frontend-typography/SKILL.md) owns the type
system and [frontend-layout](../frontend-layout/SKILL.md) owns the resulting
space.
