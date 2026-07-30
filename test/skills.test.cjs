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
  workflow: ["architecture", "commit", "debug", "decision-map", "design", "implement", "parallel-work", "plan", "prototype", "research", "survey", "verify"],
  maintenance: ["project-memory", "session-close", "skill-audit", "write-skill"],
  domain: ["herdr", "python-tooling", "rust", "teach", "ui-design"],
};

function skillFiles() {
  return Object.keys(EXPECTED).flatMap((group) =>
    fs.readdirSync(path.join(skillsDir, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(skillsDir, group, entry.name, "SKILL.md")),
  );
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
  assert.equal(skillFiles().length, 21);
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

test("only artifact-heavy or workspace skills require explicit invocation", () => {
  const explicit = skillFiles().flatMap((file) => {
    const text = fs.readFileSync(file, "utf8");
    return /\ndisable-model-invocation:\s*true\s*(?:\n|$)/.test(text)
      ? [path.basename(path.dirname(file))]
      : [];
  }).sort();
  assert.deepEqual(explicit, ["decision-map", "plan", "teach"]);
});

test("retired lifecycle names are absent from skill instructions", () => {
  const stale = /\b(workflow-gate|wayfinder|to-spec|to-tickets|absorb-upstream)\b/;
  for (const file of skillFiles()) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), stale, path.relative(root, file));
  }
});
