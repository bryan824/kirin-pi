const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "agents");
const EXPECTED = [
  "claim-verifier.md",
  "codebase-analyzer.md",
  "delegate.md",
  "oracle.md",
  "precedent-locator.md",
  "researcher.md",
  "reviewer.md",
  "scout.md",
  "worker.md",
];
const RETIRED_FIELDS = ["display_name", "isolated", "max_turns", "isolation", "output_transcript", "turnBudget"];

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

test("agent fleet is the approved Nico override surface", () => {
  assert.deepEqual(fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort(), EXPECTED);
});

test("agents retain role tiers while reviewer inherits the selected model", () => {
  for (const file of EXPECTED) {
    const { fields, text } = preset(file);
    const name = path.basename(file, ".md");
    assert.equal(fields.name, name, file);
    assert.ok(fields.description, file);
    assert.ok(["replace", "append"].includes(fields.systemPromptMode), file);
    for (const retired of RETIRED_FIELDS) assert.equal(fields[retired], undefined, `${file}: ${retired}`);
    assert.doesNotMatch(text, /ext:pi-web-access|skills:\s*false|extensions:\s*(?:false|pi-web-access)/);
  }

  assert.equal(preset("scout.md").fields.model, "openai-codex/gpt-5.6-luna");
  for (const name of ["codebase-analyzer.md", "precedent-locator.md", "researcher.md"]) {
    assert.equal(preset(name).fields.model, "openai-codex/gpt-5.6-terra", name);
  }
  for (const name of ["claim-verifier.md", "oracle.md", "worker.md", "delegate.md"]) {
    assert.equal(preset(name).fields.model, "openai-codex/gpt-6-astra", name);
  }

  assert.equal(preset("reviewer.md").fields.model, undefined, "reviewer must not pin an aging model");
  assert.equal(preset("scout.md").fields.thinking, "low");
  assert.equal(preset("reviewer.md").fields.thinking, "xhigh");
  for (const name of ["codebase-analyzer.md", "precedent-locator.md"]) {
    assert.equal(preset(name).fields.thinking, "medium", name);
  }
  for (const name of ["claim-verifier.md", "oracle.md", "worker.md", "delegate.md", "researcher.md"]) {
    assert.equal(preset(name).fields.thinking, "high", name);
  }
});

test("README model table matches the agent defaults", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const section = readme.split("### Subagent presets\n")[1].split("\n## ")[0];
  const rows = new Map([...section.matchAll(/^\| `([^`]+)` \| ([^|]+) \|/gm)]
    .map(([, name, cell]) => [name, cell.trim()]));
  for (const file of EXPECTED) {
    const { fields } = preset(file);
    const cell = rows.get(fields.name);
    assert.ok(cell, file);
    assert.ok(cell.endsWith(` / ${fields.thinking}`), `${file}: thinking`);
    if (fields.model) assert.ok(cell.includes(`\`${fields.model.split("/").at(-1)}\``), `${file}: model`);
    else assert.match(cell, /\binherit(?:s|ed)?\b/i, `${file}: inherited model`);
  }
});

test("presets retain native context/tool differences while delegating shared discipline", () => {
  const tools = {
    "claim-verifier.md": "read, grep, find, ls, bash",
    "codebase-analyzer.md": "read, grep, find, ls",
    "delegate.md": "read, grep, find, ls, bash, edit, write, contact_supervisor",
    "oracle.md": "read, grep, find, ls, bash, contact_supervisor",
    "precedent-locator.md": "read, grep, find, ls, bash",
    "researcher.md": "read, web_search, source_check, fetch_content, get_search_content",
    "reviewer.md": "read, grep, find, ls, bash, contact_supervisor",
    "scout.md": "read, grep, find, ls, bash",
    "worker.md": "read, grep, find, ls, bash, edit, write, contact_supervisor",
  };
  for (const file of EXPECTED) {
    const { fields } = preset(file);
    assert.equal(fields.tools, tools[file], file);
    assert.equal(fields.inheritProjectContext, "true", file);
    assert.equal(fields.inheritSkills, "false", file);
    assert.equal(fields.systemPromptMode, file === "delegate.md" ? "append" : "replace", file);
    const context = file === "reviewer.md" ? "fresh" : ["delegate.md", "oracle.md", "worker.md"].includes(file) ? "fork" : undefined;
    assert.equal(fields.defaultContext, context, file);
  }
  assert.equal(preset("oracle.md").fields.aliases, "advisor");
  assert.equal(preset("worker.md").fields.aliases, "developer, coder, implementer, develop");
  assert.doesNotMatch(preset("reviewer.md").text, /APPROVE|REQUEST_CHANGES|NEEDS_HUMAN_DECISION/);
  assert.match(preset("reviewer.md").text, /Use `verify` as the owner/);
  assert.match(preset("worker.md").text, /Use `implement` for delivery discipline/);
  assert.match(preset("precedent-locator.md").text, /Never fetch/);
  assert.match(preset("claim-verifier.md").text, /preserving order and IDs/);
});

test("read-only roles are narrow and workers can escalate", () => {
  for (const name of ["scout.md", "claim-verifier.md", "codebase-analyzer.md", "precedent-locator.md", "reviewer.md", "oracle.md"]) {
    const { fields } = preset(name);
    assert.doesNotMatch(fields.tools, /write|edit/, name);
    assert.equal(fields.acceptanceRole, "read-only", name);
    assert.equal(fields.completionGuard, "false", name);
  }

  const researcher = preset("researcher.md").fields;
  assert.equal(researcher.acceptanceRole, "read-only");
  for (const tool of ["web_search", "source_check", "fetch_content", "get_search_content"]) {
    assert.match(researcher.tools, new RegExp(`\\b${tool}\\b`));
  }
  assert.equal(researcher.extensions, undefined);

  for (const name of ["worker.md", "delegate.md"]) {
    const { fields, text } = preset(name);
    assert.equal(fields.acceptanceRole, "writer", name);
    assert.match(fields.tools, /contact_supervisor/, name);
    assert.match(text, /contact_supervisor/, name);
  }
  assert.equal(preset("delegate.md").fields.systemPromptMode, "append");
  assert.equal(preset("worker.md").fields.skills, "implement");
  assert.equal(preset("reviewer.md").fields.skills, "verify");
});
