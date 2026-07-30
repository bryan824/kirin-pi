# Visual Companion Guide

Browser-based visual companion for showing mockups, diagrams, and options
during design.

## When to Use

Decide per-question, not per-session. The test: **would the user understand
this better by seeing it than reading it?**

**Use the browser** when the content itself is visual:

- **UI mockups** — wireframes, layouts, navigation structures, component designs
- **Architecture diagrams** — system components, data flow, relationship maps
- **Side-by-side visual comparisons** — comparing layouts, color schemes, design directions
- **Design polish** — look and feel, spacing, visual hierarchy
- **Spatial relationships** — state machines, flowcharts, entity relationships

**Use the terminal** when the content is text or tabular:

- **Requirements and scope questions** — "what does X mean?", "which features are in scope?"
- **Conceptual A/B/C choices** — picking between approaches described in words
- **Tradeoff lists** — pros/cons, comparison tables
- **Technical decisions** — API design, data modeling, architectural approach
- **Clarifying questions** — anything where the answer is words, not a visual preference

A question *about* a UI topic is not automatically a visual question. "What kind
of wizard do you want?" is conceptual — terminal. "Which of these wizard layouts
feels right?" is visual — browser.

## How It Works

The server watches a directory for HTML files and serves the newest one to the
browser. You write HTML content to `screen_dir`, the user sees it in their
browser and can click to select options. Selections are recorded to
`state_dir/events` that you read on your next turn.

**Content fragments vs full documents:** If your HTML starts with `<!DOCTYPE` or
`<html`, the server serves it as-is (just injects the helper script). Otherwise,
the server wraps your content in the frame template — header, CSS theme,
selection indicator, and interactive infrastructure. **Write content fragments by
default.** Only write full documents when you need complete control over the page.

## Starting a Session

```bash
scripts/start-server.sh --project-dir /path/to/project

# Returns: {"type":"server-started","port":52341,"url":"http://localhost:52341",
#           "screen_dir":"/path/to/project/.design/companion/12345-1706000000/content",
#           "state_dir":"/path/to/project/.design/companion/12345-1706000000/state"}
```

Save `screen_dir` and `state_dir` from the response. Tell user to open the URL.

**Finding connection info:** The server writes startup JSON to
`$STATE_DIR/server-info`. When using `--project-dir`, check
`<project>/.design/companion/` for the session directory.

**Note:** Pass the project root as `--project-dir` so mockups persist in
`.design/companion/` and survive server restarts. Without it, files go to `/tmp`
and get cleaned up. Remind the user to add `.design/` to `.gitignore` if needed.

**Claude Code (macOS / Linux):**
```bash
scripts/start-server.sh --project-dir /path/to/project
```

**Claude Code (Windows):**
```bash
# Windows auto-detects foreground mode. Use run_in_background: true on Bash tool.
scripts/start-server.sh --project-dir /path/to/project
```

**Other environments:** The server must keep running across conversation turns.
If your environment reaps detached processes, use `--foreground` and launch with
your platform's background mechanism.

For remote/containerized setups:
```bash
scripts/start-server.sh --project-dir /path/to/project --host 0.0.0.0 --url-host localhost
```

## The Loop

1. **Check server is alive**, then **write HTML** to a new file in `screen_dir`:
   - Before each write, check `$STATE_DIR/server-info` exists. If missing (or
     `server-stopped` exists), restart with `start-server.sh`. Server auto-exits
     after 30 minutes of inactivity.
   - Use semantic filenames: `platform.html`, `visual-style.html`, `layout.html`
   - **Never reuse filenames** — each screen gets a fresh file
   - Use Write tool — **never use cat/heredoc**
   - Server automatically serves the newest file

2. **Tell user what to expect and end your turn:**
   - Remind them of the URL (every step)
   - Brief text summary of what's on screen
   - "Take a look and let me know what you think."

3. **On your next turn** — after user responds:
   - Read `$STATE_DIR/events` if it exists — user's browser interactions as JSON lines
   - Merge with terminal text for the full picture
   - Terminal message is primary; events provide structured interaction data

4. **Iterate or advance** — if feedback changes current screen, write a new file
   (e.g., `layout-v2.html`). Only advance when current step is validated.

5. **Unload when returning to terminal** — push a waiting screen:
   ```html
   <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
     <p class="subtitle">Continuing in terminal...</p>
   </div>
   ```

6. Repeat until done.

## Writing Content Fragments

Write just the content. The server wraps it in the frame template automatically.

**Minimal example:**

```html
<h2>Which layout works better?</h2>
<p class="subtitle">Consider readability and visual hierarchy</p>

<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Single Column</h3>
      <p>Clean, focused reading experience</p>
    </div>
  </div>
  <div class="option" data-choice="b" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content">
      <h3>Two Column</h3>
      <p>Sidebar navigation with main content</p>
    </div>
  </div>
</div>
```

No `<html>`, CSS, or `<script>` tags needed.

## CSS Classes Available

### Options (A/B/C choices)
```html
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Title</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

**Multi-select:** Add `data-multiselect` to the container.
```html
<div class="options" data-multiselect>
  <!-- users can select/deselect multiple -->
</div>
```

### Cards (visual designs)
```html
<div class="cards">
  <div class="card" data-choice="design1" onclick="toggleSelect(this)">
    <div class="card-image"><!-- mockup content --></div>
    <div class="card-body">
      <h3>Name</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

### Mockup container
```html
<div class="mockup">
  <div class="mockup-header">Preview: Dashboard Layout</div>
  <div class="mockup-body"><!-- your mockup HTML --></div>
</div>
```

### Split view (side-by-side)
```html
<div class="split">
  <div class="mockup"><!-- left --></div>
  <div class="mockup"><!-- right --></div>
</div>
```

### Pros/Cons
```html
<div class="pros-cons">
  <div class="pros"><h4>Pros</h4><ul><li>Benefit</li></ul></div>
  <div class="cons"><h4>Cons</h4><ul><li>Drawback</li></ul></div>
</div>
```

### Mock elements (wireframe building blocks)
```html
<div class="mock-nav">Logo | Home | About | Contact</div>
<div style="display: flex;">
  <div class="mock-sidebar">Navigation</div>
  <div class="mock-content">Main content area</div>
</div>
<button class="mock-button">Action Button</button>
<input class="mock-input" placeholder="Input field">
<div class="placeholder">Placeholder area</div>
```

### Typography
- `h2` — page title
- `h3` — section heading
- `.subtitle` — secondary text below title
- `.section` — content block with bottom margin
- `.label` — small uppercase label text

## Browser Events Format

```jsonl
{"type":"click","choice":"a","text":"Option A - Simple Layout","timestamp":1706000101}
{"type":"click","choice":"c","text":"Option C - Complex Grid","timestamp":1706000108}
```

The full event stream shows exploration path — last `choice` is typically the
final selection, but click patterns can reveal hesitation worth asking about.

If `$STATE_DIR/events` doesn't exist, user didn't interact — use terminal text only.

## Design Tips

- **Scale fidelity to the question** — wireframes for layout, polish for polish
- **Explain the question on each page** — not just "Pick one"
- **Iterate before advancing** — write a new version if feedback changes screen
- **2-4 options max** per screen
- **Use real content when it matters** — placeholder content obscures design issues
- **Keep mockups simple** — layout and structure, not pixel-perfect

## File Naming

- Semantic names: `platform.html`, `visual-style.html`, `layout.html`
- Never reuse — each screen is a new file
- Iterations: `layout-v2.html`, `layout-v3.html`
- Server serves newest by modification time

## Cleaning Up

```bash
scripts/stop-server.sh $SESSION_DIR
```

Persistent sessions (with `--project-dir`) keep mockup files for reference.
Only `/tmp` sessions are deleted on stop.

## Reference

- Frame template (CSS reference): `scripts/frame-template.html`
- Helper script (client-side): `scripts/helper.js`
