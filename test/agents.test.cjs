const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "harness", "agents");
const EXPECTED = [
  "explore.md",
  "claim-verifier.md",
  "codebase-analyzer.md",
  "precedent-locator.md",
  "reviewer.md",
  "web-researcher.md",
  "worker.md",
];

function preset(name) {
  const text = fs.readFileSync(path.join(dir, name), "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, `${name}: missing frontmatter`);
  const fields = Object.fromEntries(match[1].split("\n").flatMap((line) => {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    return m ? [[m[1], m[2].replace(/^"|"$/g, "")]] : [];
  }));
  return { fields, text };
}

test("agent fleet is the approved lean reset", () => {
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort(), EXPECTED.slice().sort());
});

test("agents use GPT-5.6 tiers by role", () => {
  assert.equal(preset("explore.md").fields.model, "openai-codex/gpt-5.6-luna");
  for (const name of ["codebase-analyzer.md", "precedent-locator.md", "web-researcher.md", "worker.md"]) {
    assert.equal(preset(name).fields.model, "openai-codex/gpt-5.6-terra", name);
  }
  assert.equal(preset("claim-verifier.md").fields.model, "openai-codex/gpt-5.6-sol");
  assert.equal(preset("reviewer.md").fields.model, "openai-codex/gpt-5.6-sol");
});

test("repo analysts are hermetic and bounded", () => {
  for (const name of ["explore.md", "claim-verifier.md", "codebase-analyzer.md", "precedent-locator.md"]) {
    const { fields } = preset(name);
    assert.equal(fields.isolated, "true", name);
    assert.ok(Number(fields.max_turns) > 0 && Number(fields.max_turns) <= 20, name);
    assert.doesNotMatch(fields.tools, /write|edit/, name);
  }
});

test("worker, reviewer, and web researcher use native isolation controls", () => {
  const worker = preset("worker.md").fields;
  assert.equal(worker.isolation, "worktree");
  assert.equal(worker.extensions, "false");
  assert.equal(worker.skills, "implement");
  assert.equal(worker.output_transcript, "true");

  const reviewer = preset("reviewer.md").fields;
  assert.equal(reviewer.extensions, "false");
  assert.equal(reviewer.skills, "verify");
  assert.equal(reviewer.output_transcript, "true");
  assert.doesNotMatch(reviewer.tools, /write|edit/);

  const web = preset("web-researcher.md").fields;
  assert.equal(web.extensions, "[pi-web-access]");
  assert.equal(web.skills, "false");
  assert.match(web.tools, /ext:pi-web-access\/source_check/);
  assert.doesNotMatch(web.tools, /bash|write|edit/);
});
