# UI Prototype

Use this branch for one **visual question about one component or surface**. If the
question is about state or business rules, use [LOGIC.md](LOGIC.md) instead.

A UI prototype is disposable evidence, not a production shortcut. Do not edit a
production route during exploration: preserve the logic/UI boundary and keep all
mutations stubbed.

## Build the comparison

1. State the visual question and list the directions before coding. Make **three**
   variants by default; use no more than five. Each gets a descriptive name and a
   distinct decision axis (for example, density, hierarchy, interaction model, or
   personality). Colour or copy changes alone are not directions.
2. Recon the host's tokens, component conventions, and surrounding context. Every
   direction should use realistic product-shaped content and the project's tokens.
   An isolated harness may render real read-only components and data; it must not
   make real mutations.
3. Use the host's existing isolated preview seam—a route, story, playground,
   preview target, dev-only screen, or equivalent—without modifying a production
   flow. If none exists and the artifact is browser-compatible, create one
   standalone HTML file; otherwise create the smallest native preview target. Add
   no dependencies or production runtime wiring. Keep one command to run it.
4. Default to one full-size variant at a time in realistic context; never shrink
   the work into thumbnails. Use side-by-side comparison only when every variant
   remains at its real operating size and direct spatial comparison is the
   question. Provide accessible controls appropriate to the host, including
   keyboard and pointer input where supported. Persist the selected named direction
   through the host's reproducible state (`?variant=` on the web). Switch instantly;
   offer replay only when an animation or interaction makes it useful.

Keep the selector visibly separate from the work being judged. On every switch,
surface the current named direction and enough relevant context to judge it.

## Verify and decide

Run the harness and visit every direction. Confirm its intended interactions work
and the host diagnostics are clean (including the browser console on web). Then
present the preview target or file, its run command and controls, plus an honest
comparison:

| Direction | Decision axis | When it wins | Cost |
| --- | --- | --- | --- |
| Descriptive name | What it changes | Where it is the better choice | What it gives up |

The user chooses; do not infer a winner. Record the question, observed evidence,
and human decision in the repository's prototype/decision record convention (or
`context/prototypes/<date>-<slug>.md` when none exists) before the decision map
advances.

After selection, promote **only** the chosen direction using production standards
and the host's conventions. Delete the harness and losing directions; do not leave
prototype code behind. If no direction is selected, keep the work throwaway and do
not promote it.

## Avoid

- Multiple questions or components in one run.
- Variants that share the same structural answer.
- Empty, invented context when read-only project context is available.
- Persistent prototype UI, real mutations, or a production-route experiment.
