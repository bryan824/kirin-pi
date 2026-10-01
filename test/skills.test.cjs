const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const skillsDir = path.join(root, "skills");
const ALLOWED_FIELDS = new Set([
  "name", "description", "license", "compatibility", "metadata",
  "allowed-tools", "disable-model-invocation",
]);
const EXPECTED = {
  workflow: ["architecture", "commit", "debug", "design", "implement", "plan", "prototype", "research", "survey", "verify"],
  maintenance: ["agents-md", "project-memory", "session-close", "skill-audit", "write-skill"],
  domain: ["apple-interface", "chatgpt-export", "frontend-accessibility", "frontend-color", "frontend-design", "frontend-layout", "frontend-motion", "frontend-polish", "frontend-typography", "frontend-writing", "herdr", "python-tooling", "rust", "teach"],
};

function skillFiles() {
  return Object.keys(EXPECTED).flatMap((group) =>
    fs.readdirSync(path.join(skillsDir, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(skillsDir, group, entry.name, "SKILL.md")),
  );
}

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith(".md") ? [file] : [];
  });
}

function fields(block) {
  return Object.fromEntries(block.split("\n").flatMap((line) => {
    const match = line.match(/^([A-Za-z][\w-]*):(.*)$/);
    return match ? [[match[1], match[2].trim()]] : [];
  }));
}

test("skill fleet is the approved grouped surface", () => {
  for (const [group, names] of Object.entries(EXPECTED)) {
    const actual = fs.readdirSync(path.join(skillsDir, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.deepEqual(actual, names.slice().sort(), group);
  }
  assert.equal(skillFiles().length, 29);
});

test("README documents the exact approved skill fleet", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  for (const [group, names] of Object.entries(EXPECTED)) {
    const heading = `${group[0].toUpperCase()}${group.slice(1)} skills`;
    const section = readme.match(new RegExp(`### ${heading}\\n\\n\\| Skill \\| Purpose \\|\\n\\|---\\|---\\|\\n((?:\\|.*\\n)+)`));
    assert.ok(section, heading);
    const actual = [...section[1].matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]).sort();
    assert.deepEqual(actual, names.slice().sort(), group);
  }
});

test("skills use Pi-compatible frontmatter and directory-matched names", () => {
  for (const file of skillFiles()) {
    assert.equal(fs.existsSync(file), true, file);
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatter, `${rel}: missing frontmatter`);
    const parsed = fields(frontmatter[1]);
    assert.equal(parsed.name, path.basename(path.dirname(file)), rel);
    assert.match(parsed.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, rel);
    assert.ok(parsed.description, `${rel}: missing description`);
    assert.ok(parsed.description.replace(/^["']|["']$/g, "").length <= 1024, rel);
    for (const key of Object.keys(parsed)) assert.ok(ALLOWED_FIELDS.has(key), `${rel}: ${key}`);
  }
});

test("skill reference Markdown relative links resolve", () => {
  const dirs = [
    ...EXPECTED.domain
      .filter((name) => name.startsWith("frontend-") || name === "apple-interface")
      .map((name) => path.join(skillsDir, "domain", name)),
    ...["design", "plan", "implement", "verify", "prototype"].map((name) => path.join(skillsDir, "workflow", name)),
    ...EXPECTED.maintenance.map((name) => path.join(skillsDir, "maintenance", name)),
  ];
  for (const file of dirs.flatMap(markdownFiles)) {
    for (const match of fs.readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1].split("#", 1)[0];
      if (!href || /^[a-z][a-z\d+.-]*:/i.test(href)) continue;
      const target = path.resolve(path.dirname(file), decodeURI(href));
      assert.equal(fs.existsSync(target), true, `${path.relative(root, file)}: ${href}`);
    }
  }
});

test("only approved side-effecting or workspace skills require explicit invocation", () => {
  const explicit = skillFiles().flatMap((file) => {
    const text = fs.readFileSync(file, "utf8");
    return /\ndisable-model-invocation:\s*true\s*(?:\n|$)/.test(text)
      ? [path.basename(path.dirname(file))]
      : [];
  }).sort();
  assert.deepEqual(explicit, ["agents-md", "teach"]);
});

test("agents-md stays user-triggered and owns only AGENTS.md", () => {
  const text = fs.readFileSync(path.join(skillsDir, "maintenance", "agents-md", "SKILL.md"), "utf8");
  assert.match(text, /disable-model-invocation:\s*true/);
  assert.match(text, /description: "When the user explicitly asks/);
  assert.match(text, /smallest useful always-loaded map/);
  const inspect = text.indexOf("Inspect the path type and content of `AGENTS.md`");
  const approve = text.indexOf("Present the proposed keep, move, and remove set and get approval");
  assert.ok(inspect >= 0 && inspect < approve);
  assert.match(text, /never write through a symlink/);
  assert.match(text, /untracked, ignored, staged, or unstaged regular file/);
  assert.match(text, /adjacent `<name>\.bak`/);
  assert.doesNotMatch(text, /CLAUDE\.md|@AGENTS\.md/);
  assert.match(text, /Other instruction files are outside this skill's write scope/);
  assert.match(text, /purpose, stable ownership boundaries/);
  assert.match(text, /Each pointer says when to read its target and what it answers/);
  assert.match(text, /growing, maintaining, updating, and fixing/);
  assert.match(text, /not the author's harness layout/);
  assert.match(text, /No mandatory glossary, tracker, memory tree or sibling skill installation/);
  assert.match(text, /existing but irrelevant target is a broken pointer/);
});

test("upstream review is gated inside the existing audit skill", () => {
  const auditDir = path.join(skillsDir, "maintenance", "skill-audit");
  const audit = fs.readFileSync(path.join(auditDir, "SKILL.md"), "utf8");
  assert.match(audit, /\[Upstream review\]\(references\/UPSTREAM_REVIEW\.md\)/);
  assert.match(audit, /Ordinary audits stay local/);
  const upstream = fs.readFileSync(path.join(auditDir, "references", "UPSTREAM_REVIEW.md"), "utf8");
  assert.match(upstream, /approval before any harness or ledger edit/);
  assert.match(upstream, /never execute fetched code/i);
  assert.doesNotMatch(upstream, /https?:\/\//);
});

test("retired workflow names are absent from skill instructions", () => {
  const stale = /\b(workflow-gate|wayfinder|to-spec|to-tickets|absorb-upstream|parallel-work|decision-map)\b/;
  for (const file of skillFiles()) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), stale, path.relative(root, file));
  }
});

test("static authority and evidence contracts replace ceremony, not safety", () => {
  // Source assertions catch accidental wording/surface loss, not model compliance.
  const { WORKFLOW } = require("../setup.cjs");
  const skill = (group, name) => fs.readFileSync(path.join(skillsDir, group, name, "SKILL.md"), "utf8");
  const design = skill("workflow", "design"), verify = skill("workflow", "verify"), commit = skill("workflow", "commit");
  assert.match(WORKFLOW, /clear bounded request can supply intent/);
  assert.match(WORKFLOW, /complete candidate/);
  assert.match(WORKFLOW, /Write limits include scratch probes and cleanup/);
  assert.match(WORKFLOW, /ask before crossing them/);
  assert.match(WORKFLOW, /Commit or publish only with explicit authority/);
  assert.doesNotMatch(WORKFLOW, /design ->|passed dirty candidate goes/);
  assert.match(design, /Approval is contextual/);
  assert.doesNotMatch(design, /70%|3–5 variations|next three questions/);
  assert.match(design, /references\/DECISIONS\.md/);
  assert.equal(fs.existsSync(path.join(skillsDir, "workflow", "decision-map")), false);
  assert.match(verify, /VERDICT: PASS \| PASS_WITH_RISKS \| FAIL/);
  assert.match(verify, /unrun required check/);
  assert.match(verify, /user-approved deferral/);
  assert.match(verify, /Read-only forbids creating or changing files, including temporary probes/);
  assert.match(verify, /Cleanup also needs authority/);
  assert.match(verify, /report blocked checks or ask permission/);
  assert.match(verify.replace(/\s+/g, " "), /missing evidence from impossibility/);
  assert.match(verify.replace(/\s+/g, " "), /Trace test imports and actual approval/);
  assert.match(verify.replace(/\s+/g, " "), /proposed shared fix through its callers/);
  assert.match(verify.replace(/\s+/g, " "), /concrete failing input or violated requirement/);
  const debug = skill("workflow", "debug").replace(/\s+/g, " ");
  assert.match(debug, /Probes and cleanup need write authority/);
  assert.match(debug, /Tool acceptance does not expand/);
  assert.doesNotMatch(debug, /remove the temporary instrumentation you own/);
  assert.match(skill("workflow", "survey"), /Stay read-only, including current docs/);
  assert.match(commit, /handoff is evidence, not commit authority/);
  assert.match(commit, /same complete candidate/);
  for (const name of ["project-memory", "skill-audit"]) {
    const text = skill("maintenance", name);
    assert.match(text, /SKILL_DIR/);
    assert.doesNotMatch(text, /bun skills\/maintenance\//);
  }
  assert.match(skill("maintenance", "session-close"), /When nothing would be lost, write nothing/);
});

test("memory and authoring guidance preserve knowledge without a new framework", () => {
  // Text contracts, not proof of consuming-agent adherence.
  const text = (relative) => fs.readFileSync(path.join(skillsDir, relative), "utf8").replace(/\s+/g, " ");
  const design = text("workflow/design/SKILL.md");
  assert.match(design, /writing is authorized/);
  assert.match(design, /explicit no-s, ordering\/numeric requirements/);
  assert.match(design, /glossary is not a spec/);
  const memory = text("maintenance/project-memory/PROJECT_MEMORY.md");
  assert.match(memory, /active record as they settle, within write authority/);
  assert.match(memory, /Distinguish rejection from temporary deferral/);
  assert.match(memory, /Do not turn assumptions into standing instructions/);
  const close = text("maintenance/session-close/SKILL.md");
  assert.match(close, /Native resume\/fork\/compaction/);
  assert.match(close, /recipient can reach the paths/);
  const audit = text("maintenance/skill-audit/SKILL.md");
  assert.match(audit, /missing, unwired or broken check/);
  assert.match(audit, /do not install hooks/);
  assert.match(text("maintenance/write-skill/references/SKILL_STYLE.md"), /mechanically detectable failure/);
});

test("domain and prototype payloads distinguish review coverage, verification, and authority", () => {
  const text = (relative) => fs.readFileSync(path.join(skillsDir, relative), "utf8").replace(/\s+/g, " ");
  const review = text("domain/frontend-design/references/REVIEW.md");
  assert.match(review, /uninspected discipline or state \*\*Not reviewed\*\*/);
  assert.match(review, /check that was not run[\s\S]*\*\*Not verified\*\*/);
  assert.match(review, /A review request changes no source/);
  const motion = text("domain/frontend-motion/references/REFERENCE.md");
  assert.match(motion, /native interaction/);
  assert.match(motion, /live presentation value/);
  assert.match(motion, /Otherwise report focused/);
  assert.match(motion, /Measure before optimizing/);
  const apple = text("domain/apple-interface/REFERENCE.md");
  assert.match(apple, /when installed/);
  assert.match(apple, /explicitly Apple direction/);
  assert.match(apple, /reduced-motion alternative/);
  const prototype = text("workflow/prototype/SKILL.md");
  const logic = text("workflow/prototype/LOGIC.md"), ui = text("workflow/prototype/UI.md");
  assert.match(prototype, /question and recipient/);
  assert.match(prototype, /cleanup authority/);
  assert.match(logic, /smallest runnable check/);
  assert.match(logic, /isolated approved data/);
  assert.match(ui, /full-size named variant/);
  assert.match(ui, /reproducible selection/);
  assert.match(ui, /reduced motion/);
  assert.match(ui, /The human chooses/);
  for (const body of [prototype, logic, ui]) assert.doesNotMatch(body, /skip tests|Don't add tests|Make \*\*three\*\*|no more than five/);
});

test("Herdr guidance retains authority and evidence boundaries without duplicating CLI tutorials", () => {
  // Prompt preservation only; live model and CLI behavior require separate checks.
  const text = fs.readFileSync(path.join(skillsDir, "domain/herdr/SKILL.md"), "utf8").replace(/\s+/g, " ");
  for (const boundary of [
    /user explicitly mentions Herdr/, /HERDR_ENV/, /not inspect or control.*outside Herdr/,
    /installed CLI.*authority/, /bare `herdr`/, /mutating nested command/,
    /current working directory/, /--no-focus/, /available shell pane/,
    /new workspace-qualified pane ID/, /inherited caller context/,
    /\[a-z\]\[a-z0-9_-\]\{0,31\}/, /already working/,
    /alternate screen/, /artifact.*write authority/, /raw terminals.*not agents/,
    /transport error.*not.*stale/, /`all`.*`any`/,
    /Canceling or timing out a wait does not stop/,
    /server stop.*explicitly intends/,
  ]) assert.match(text, boundary);
  assert.doesNotMatch(text, /do not request file output in the initial prompt/);
});

test("portable parallel policy remains in owning workflow contracts", () => {
  const setup = fs.readFileSync(path.join(root, "setup.cjs"), "utf8");
  const plan = fs.readFileSync(path.join(skillsDir, "workflow", "plan", "SKILL.md"), "utf8");
  const implement = fs.readFileSync(path.join(skillsDir, "workflow", "implement", "SKILL.md"), "utf8");
  const verify = fs.readFileSync(path.join(skillsDir, "workflow", "verify", "SKILL.md"), "utf8");

  assert.match(setup, /Parallelize only ready file-disjoint work/);
  assert.match(setup, /governed delegation protocol; no silent fallback or unchanged blocked retry/);
  assert.match(plan, /ready file-disjoint units[\s\S]*active\n  orchestration runtime/);
  assert.match(implement, /writable files are walls/);
  assert.match(implement.replace(/\s+/g, " "), /direct requests and delegated packets, including temporary probes and cleanup/);
  assert.match(plan.replace(/\s+/g, " "), /thin end-to-end slice across a risky boundary/);
  assert.match(plan.replace(/\s+/g, " "), /name its observable check/);
  assert.match(plan.replace(/\s+/g, " "), /explain the blocking dependency/);
  assert.match(plan.replace(/\s+/g, " "), /Return the outline in the response unless/);
  assert.match(plan.replace(/\s+/g, " "), /input document is not an implicit overwrite target/);
  assert.match(plan.replace(/\s+/g, " "), /not permission to repurpose unrelated APIs/);
  assert.match(plan.replace(/\s+/g, " "), /green baseline is not acceptance for new behavior/);
  assert.match(plan.replace(/\s+/g, " "), /moving its work to direct execution needs explicit authorization/);
  assert.match(plan.replace(/\s+/g, " "), /Proposed contract defaults remain proposals until approved/);
  assert.match(verify, /including later hunks|including evidence or fixes added|including evidence[\s\S]*added/);
  assert.match(verify, /Spec[\s\S]*Standards/);
});
