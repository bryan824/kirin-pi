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
  workflow: ["architecture", "commit", "debug", "decision-map", "design", "implement", "plan", "prototype", "research", "survey", "verify"],
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
    path.join(skillsDir, "workflow", "prototype"),
    path.join(skillsDir, "maintenance", "skill-audit"),
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
  assert.deepEqual(explicit, ["agents-md", "decision-map", "plan", "teach"]);
});

test("agents-md stays user-triggered and preserves its canonical file contract", () => {
  const text = fs.readFileSync(path.join(skillsDir, "maintenance", "agents-md", "SKILL.md"), "utf8");
  assert.match(text, /disable-model-invocation:\s*true/);
  assert.match(text, /description: "When the user explicitly asks/);
  assert.match(text, /smallest useful always-loaded map/);
  const inspect = text.indexOf("Inspect the path type and content of both `AGENTS.md` and `CLAUDE.md`");
  const approve = text.indexOf("Present the proposed keep, move, and remove set and get approval");
  assert.ok(inspect >= 0 && inspect < approve);
  assert.match(text, /never write through either symlink/);
  assert.match(text, /untracked, ignored, staged, or unstaged regular file/);
  assert.match(text, /adjacent `<name>\.bak`/);
  assert.match(text, /Move useful unique `CLAUDE\.md` guidance/);
  assert.match(text, /exactly `@AGENTS\.md` and a trailing newline/);
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
  const stale = /\b(workflow-gate|wayfinder|to-spec|to-tickets|absorb-upstream|parallel-work)\b/;
  for (const file of skillFiles()) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), stale, path.relative(root, file));
  }
});

test("portable parallel policy remains in owning workflow contracts", () => {
  const setup = fs.readFileSync(path.join(root, "setup.cjs"), "utf8");
  const plan = fs.readFileSync(path.join(skillsDir, "workflow", "plan", "SKILL.md"), "utf8");
  const implement = fs.readFileSync(path.join(skillsDir, "workflow", "implement", "SKILL.md"), "utf8");
  const verify = fs.readFileSync(path.join(skillsDir, "workflow", "verify", "SKILL.md"), "utf8");

  assert.match(setup, /Parallelize only ready file-disjoint plan units/);
  assert.match(setup, /Do not relaunch a blocked worker unchanged/);
  assert.match(plan, /active orchestration runtime for ready file-disjoint units/);
  assert.match(implement, /edit only its writable files, treat forbidden files/);
  assert.match(verify, /independently review each completed unit before integrating it/);
});
