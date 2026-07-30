import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  compactDescription,
  discoverRoots,
  parseFrontmatter,
  parsePiSkillUsage,
} from "./skill-cleaner.ts";

test("limits root discovery to explicitly supplied roots", (context) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-cleaner-roots-"));
  context.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const harnessRoots = [
    path.join(temp, ".agents/skills"),
    path.join(temp, ".claude/skills"),
    path.join(temp, ".pi/agent/skills"),
  ];
  const isolatedRoot = path.join(temp, "isolated/skills");
  for (const root of [...harnessRoots, isolatedRoot]) fs.mkdirSync(root, { recursive: true });

  assert.deepEqual(discoverRoots(temp, [isolatedRoot], true), [isolatedRoot]);
  const full = discoverRoots(temp, [isolatedRoot], false);
  for (const root of [...harnessRoots, isolatedRoot]) assert.ok(full.includes(root), root);
});

test("derives model-visibility from disable-model-invocation frontmatter", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-cleaner-"));
  const visible = path.join(dir, "visible.md");
  const hidden = path.join(dir, "hidden.md");
  fs.writeFileSync(visible, "---\nname: visible\ndescription: A model-invoked discipline.\n---\nbody\n");
  fs.writeFileSync(
    hidden,
    "---\nname: hidden\ndescription: A user-only orchestrator.\ndisable-model-invocation: true\n---\nbody\n",
  );
  assert.equal(parseFrontmatter(visible)?.disableModelInvocation, false);
  assert.equal(parseFrontmatter(hidden)?.disableModelInvocation, true);
  assert.equal(parseFrontmatter(hidden)?.name, "hidden");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("counts Pi/Claude skill-usage signals from session text", () => {
  const text = [
    `{"role":"user","content":[{"type":"text","text":"run /skill:design then /skill:verify"}]}`,
    // skill loaded into context — escaped quotes, as it appears inside session JSON
    `...<skill name=\\"design\\" location=\\"/Users/me/.agents/skills/design/SKILL.md\\">...`,
    `{"name":"read","input":{"file_path":"/Users/me/.agents/skills/verify/SKILL.md"}}`,
    `{"name":"bash","input":{"command":"cat skills/design/SKILL.md"}}`,
  ].join("\n");
  const usage = parsePiSkillUsage(text);
  assert.equal(usage.get("design")?.command, 1);
  assert.equal(usage.get("design")?.load, 1);
  // the cat command plus the <skill location="...design/SKILL.md"> path both count
  assert.ok((usage.get("design")?.fileRead ?? 0) >= 1);
  assert.equal(usage.get("verify")?.command, 1);
  assert.equal(usage.get("verify")?.fileRead, 1);
  assert.equal(usage.has("name"), false);
});

test("compacts prose into a readable trigger phrase", () => {
  const compact = compactDescription(
    "Use this skill when the user wants to inspect calendars, compare availability, review conflicts, and schedule a meeting with timezone-aware details.",
    90,
  );
  assert.equal(
    compact,
    "inspect calendars, compare availability, review conflicts, and schedule a meeting with...",
  );
  assert.ok(compact.length <= 90);
});
