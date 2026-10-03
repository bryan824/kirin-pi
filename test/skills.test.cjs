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
  workflow: ["architecture", "commit", "debug", "design", "implement", "plan", "prototype", "research", "survey", "verify", "wait-what"],
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
  assert.equal(skillFiles().length, 30);
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

test("only approved user-invoked skills disable automatic selection", () => {
  const explicit = skillFiles().flatMap((file) => {
    const text = fs.readFileSync(file, "utf8");
    return /\ndisable-model-invocation:\s*true\s*(?:\n|$)/.test(text)
      ? [path.basename(path.dirname(file))]
      : [];
  }).sort();
  assert.deepEqual(explicit, ["agents-md", "teach", "wait-what"]);
});

// Structural contracts and a few safety boundaries. Exact prose is deliberately
// not pinned: wording should stay free to get plainer. None of this proves that a
// model follows the guidance.
const read = (relative) => fs.readFileSync(path.join(skillsDir, relative), "utf8");

test("agents-md stays user-triggered and owns only AGENTS.md", () => {
  const text = read("maintenance/agents-md/SKILL.md");
  assert.match(text, /disable-model-invocation:\s*true/);
  assert.match(text, /never write through a symlink/);
  assert.match(text, /\.bak/);
  assert.doesNotMatch(text, /CLAUDE\.md|@AGENTS\.md/);
});

test("upstream review is gated inside the existing audit skill", () => {
  assert.match(read("maintenance/skill-audit/SKILL.md"), /\[Upstream review\]\(references\/UPSTREAM_REVIEW\.md\)/);
  const upstream = read("maintenance/skill-audit/references/UPSTREAM_REVIEW.md");
  assert.match(upstream, /approval before any harness or ledger edit/);
  assert.doesNotMatch(upstream, /https?:\/\//);
});

test("whole-harness review and repeatable probes stay within the existing audit", () => {
  const audit = read("maintenance/skill-audit/SKILL.md");
  const harness = read("maintenance/skill-audit/references/HARNESS_REVIEW.md");
  const upstream = read("maintenance/skill-audit/references/UPSTREAM_REVIEW.md");
  for (const file of ["HARNESS_REVIEW.md", "BEHAVIOR_PROBES.md"]) {
    assert.ok(audit.includes(`](references/${file})`), file);
  }
  for (const text of [harness, upstream]) assert.ok(text.includes("](BEHAVIOR_PROBES.md)"));
  const probes = read("maintenance/skill-audit/references/BEHAVIOR_PROBES.md");
  assert.match(harness, /latest stable \*\*Pi and Claude Code\*\*/);
  const cases = [...probes.matchAll(/^\| ([MUVTW]\d+) —/gm)].map((match) => match[1]);
  assert.deepEqual(cases, ["M1", "M2", "M3", "M4", "U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "T1", "W1", "V1"]);
});

test("wait-what stays a small user-invoked conversation repair", () => {
  const text = read("workflow/wait-what/SKILL.md");
  assert.match(text, /no files, learning workspace or teaching mode unless requested/);
  assert.doesNotMatch(text, /\]\([^)]+\.md\)/, "no required sibling or glossary dependency");
});

test("teach defaults to chat and gates persistent course output", () => {
  const text = read("domain/teach/SKILL.md");
  assert.match(text, /Default to teaching in chat, without files or workspace setup/);
  assert.match(text, /permission to save a course before scaffolding/);
  for (const file of ["MISSION-FORMAT.md", "RESOURCES-FORMAT.md", "LEARNING-RECORD-FORMAT.md", "GLOSSARY-FORMAT.md"]) {
    assert.ok(text.includes(`](${file})`), file);
  }
});

test("retired workflow names are absent from skill instructions", () => {
  const stale = /\b(workflow-gate|wayfinder|to-spec|to-tickets|absorb-upstream|parallel-work|decision-map)\b/;
  for (const file of skillFiles()) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), stale, path.relative(root, file));
  }
});

test("charter and skills keep the authority and verdict contracts", () => {
  const { WORKFLOW } = require("../setup.cjs");
  for (const rule of [
    /Commit or publish only with explicit authority/,
    /Change only files you are authorized to touch/,
    /in parallel only when it is ready and file-disjoint/,
    /failed delegated task stays failed/,
    /self-review that says so/,
    /explanatory files.*explicit approval/,
  ]) assert.match(WORKFLOW, rule);
  assert.match(read("workflow/verify/SKILL.md"), /VERDICT: PASS \| PASS_WITH_RISKS \| FAIL/);
  assert.match(read("workflow/design/SKILL.md"), /references\/DECISIONS\.md/);
  for (const name of ["maintenance/project-memory", "maintenance/skill-audit"]) {
    const text = read(`${name}/SKILL.md`);
    assert.match(text, /SKILL_DIR/, name);
    assert.doesNotMatch(text, /bun skills\/maintenance\//, name);
  }
});

test("only commit, implement and verify restate commit authority", () => {
  // The always-loaded charter owns it; other skills must not repeat it.
  for (const name of ["architecture", "debug", "design", "plan", "prototype", "research", "survey"]) {
    assert.doesNotMatch(read(`workflow/${name}/SKILL.md`), /\b(?:commits?|publish|deploy(?:ment)?)\b|\bpublication(?! date)/i, name);
  }
});

test("Herdr guidance keeps its activation and destructive-command boundaries", () => {
  const text = read("domain/herdr/SKILL.md").replace(/\s+/g, " ");
  for (const boundary of [/user explicitly mentions Herdr/, /HERDR_ENV/, /bare `herdr`/, /server stop.*explicitly intends/]) {
    assert.match(text, boundary);
  }
});

test("handoffs use one shared, ignored repository path", () => {
  const { WORKFLOW } = require("../setup.cjs");
  const close = read("maintenance/session-close/SKILL.md");
  for (const text of [WORKFLOW, close]) assert.match(text, /context\/handoff\.md/);
  assert.match(close, /git check-ignore/);
  assert.match(close, /agent-private/i);
});
