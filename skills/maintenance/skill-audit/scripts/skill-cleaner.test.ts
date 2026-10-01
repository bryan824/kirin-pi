import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  compactDescription,
  discoverRoots,
  discoverSkills,
  parseFrontmatter,
  parsePiSkillUsage,
  scanUsage,
  walkRecentFiles,
  skillBudget,
  tokenCost,
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

const jsonl = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).join("\n");
const piRead = (id: string, file: string) => ({ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id, name: "read", arguments: { path: file } }] } });
const piResult = (id: string, isError = false) => ({ type: "message", message: { role: "toolResult", toolCallId: id, isError, content: [{ type: "text", text: "result" }] } });

test("distinguishes structured commands, envelopes, read requests/results and mere mentions", () => {
  const envelope = '<skill name="design" location="/skills/design/SKILL.md">body</skill>';
  const text = jsonl([
    { role: "developer", content: '/skills/design/SKILL.md; /skill:verify; ' + envelope },
    { role: "user", content: 'Explain /skill:verify and "skills/verify/SKILL.md"; example: ' + envelope },
    { role: "assistant", content: [{ type: "text", text: envelope }] },
    { role: "user", content: [{ type: "text", text: "/skill:design task" }] },
    { role: "user", content: envelope },
    { role: "user", content: envelope },
    { type: "session", cwd: "/repo" },
    piRead("verify-pi", "skills/workflow/verify/SKILL.md"), piResult("verify-pi"),
    piRead("failed", "skills/workflow/design/SKILL.md"), piResult("failed", true),
    piRead("missing-result", "skills/workflow/verify/SKILL.md"),
    { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "verify-claude", name: "Read", input: { file_path: "C:\\repo\\skills\\workflow\\verify\\SKILL.md" } }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "verify-claude", content: "body" }] } },
    { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "skill", name: "Skill", input: { skill: "plugin:research" } }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "skill", is_error: false, content: "loaded" }] } },
    { role: "user", content: "<command-message>commit</command-message>\n<command-name>/commit</command-name>" },
    { name: "read", input: { file_path: "/skills/fake/SKILL.md" } },
    { role: "assistant", content: [{ type: "toolCall", id: "bash", name: "bash", arguments: { command: 'echo "skills/fake/SKILL.md"' } }] },
    piResult("unpaired"), null,
  ]) + '\nnot JSON, even with <skill name="fake" location="/skills/fake/SKILL.md">body</skill>';
  const records = { parsed: 0, malformed: 0, messages: 0, unsupported: 0, unclassifiedToolCalls: 0, unmatchedResults: 0 };
  const usage = parsePiSkillUsage(text, records);
  assert.equal(usage.get("design")?.command, 1);
  assert.equal(usage.get("design")?.load, 2);
  assert.equal(usage.get("design")?.readRequest, 1);
  assert.equal(usage.get("design")?.fileRead, 0);
  assert.equal(usage.get("verify")?.command, 0);
  assert.equal(usage.get("verify")?.readRequest, 3);
  assert.equal(usage.get("verify")?.fileRead, 2);
  assert.equal(usage.get("research")?.skillResult, 1);
  assert.equal(usage.get("research")?.load, 0);
  assert.equal(usage.get("commit")?.command, 1);
  assert.equal(usage.has("fake"), false);
  assert.equal(records.malformed, 1);
  assert.ok(records.unsupported >= 3);
  assert.equal(records.unclassifiedToolCalls, 1);
  assert.equal(records.unmatchedResults, 1);
});

function fixture(context: { after: (callback: () => void) => void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-cleaner-evidence-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function writeSkill(root: string, directory: string, name = directory, body = "body\n", extra = "") {
  const file = path.join(root, directory, "SKILL.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: A focused skill.\n${extra}---\n${body}`);
  return file;
}
const script = fileURLToPath(new URL("skill-cleaner.ts", import.meta.url));
function cli(root: string, args: string[]) {
  return spawnSync(process.execPath, ["--no-install", script, ...args], {
    cwd: root, env: { ...process.env, HOME: path.join(root, "home"), XDG_CONFIG_HOME: path.join(root, "home/.config") }, encoding: "utf8",
  });
}

test("uses native YAML for folded/chomped and quoted scalars without comment-induced hiding", (context) => {
  const root = fixture(context), file = path.join(root, "SKILL.md");
  for (const scalar of [">-", "|+", ">2-"]) {
    fs.writeFileSync(file, `---\nname: 'yaml'\ndescription: ${scalar}\n  Use # literal text:\n  with another line.\ndisable-model-invocation: false # true hides it\n---\nKeep  spacing.\n`);
    assert.equal(parseFrontmatter(file)?.description, "Use # literal text: with another line.");
    assert.equal(parseFrontmatter(file)?.disableModelInvocation, false);
    assert.equal(parseFrontmatter(file)?.body, "Keep  spacing.\n");
  }
  fs.writeFileSync(file, '---\nname: "quoted"\ndescription: "Use \\"quotes\\" # literally: yes"\n---\nbody');
  assert.equal(parseFrontmatter(file)?.description, 'Use "quotes" # literally: yes');
  fs.writeFileSync(file, '---\nname: invalid\ndescription: [not, text]\n---\nbody');
  assert.throws(() => parseFrontmatter(file), /description must be text/);
  fs.writeFileSync(file, '---\nname: invalid\ndisable-model-invocation: "true"\n---\nbody');
  assert.throws(() => parseFrontmatter(file), /must be a boolean/);
});

test("inventories symlinked skill files and diagnoses invalid entries without normalizing away drift", (context) => {
  const root = fixture(context), first = writeSkill(root, "first", "same", "Do the thing.\n");
  const second = writeSkill(root, "second", "same", "Do the thing!\n");
  const target = path.join(root, "body.md"), linked = path.join(root, "linked/SKILL.md");
  fs.writeFileSync(target, '---\nname: linked\ndescription: Linked body.\n---\nbody');
  fs.mkdirSync(path.dirname(linked)); fs.symlinkSync(target, linked);
  fs.symlinkSync(root, path.join(root, "cycle"));
  fs.mkdirSync(path.join(root, "broken")); fs.symlinkSync("absent.md", path.join(root, "broken/SKILL.md"));
  writeSkill(root, "bad", "bad", "body", "disable-model-invocation: [true]\n");
  const issues: { path: string; reason: string }[] = [];
  const skills = discoverSkills([root], issues);
  assert.equal(skills.length, 3);
  assert.equal(skills.find((skill) => skill.name === "linked")?.realPath, fs.realpathSync(target));
  const a = skills.find((skill) => skill.path === first)!, b = skills.find((skill) => skill.path === second)!;
  assert.equal(a.bodyKey, b.bodyKey);
  assert.notEqual(a.bodyHash, b.bodyHash);
  assert.ok(skills.every((skill) => skill.enabled === null));
  assert.ok(issues.some((issue) => issue.reason === "alias-or-cycle"));
  assert.ok(issues.some((issue) => issue.reason === "ENOENT"));
  assert.ok(issues.some((issue) => /must be a boolean/.test(issue.reason)));
});

test("finds fresh nested logs under old parents without following new log symlink scopes", (context) => {
  const root = fixture(context), parent = path.join(root, "old/nested");
  fs.mkdirSync(parent, { recursive: true });
  const fresh = path.join(parent, "fresh.jsonl"), old = path.join(parent, "old.jsonl");
  fs.writeFileSync(fresh, "{}\n"); fs.writeFileSync(old, "{}\n");
  const ancient = new Date("2000-01-01");
  fs.utimesSync(old, ancient, ancient); fs.utimesSync(parent, ancient, ancient); fs.utimesSync(path.dirname(parent), ancient, ancient);
  fs.symlinkSync(parent, path.join(root, "other-scope"));
  const issues: { path: string; reason: string }[] = [];
  assert.deepEqual(walkRecentFiles(root, Date.now() - 60_000, issues), [fresh]);
  assert.ok(issues.some((issue) => issue.reason === "symlink-not-followed"));
  const limited: { path: string; reason: string }[] = [];
  assert.deepEqual(walkRecentFiles(root, 0, limited, 0), []);
  assert.ok(limited.some((issue) => issue.reason === "depth-limit"));
});

test("reports actual read/skip/error bytes and separates reference reads from bodies", (context) => {
  const root = fixture(context), file = writeSkill(root, "entry", "declared");
  const skills = discoverSkills([root]);
  const log = path.join(root, "events.jsonl");
  fs.writeFileSync(log, jsonl([
    { type: "session", cwd: root },
    piRead("body", "entry/SKILL.md"), piResult("body"),
    piRead("ref", "entry/references/DETAIL.md"), piResult("ref"),
    piRead("bad-ref", "entry/OTHER.md"), piResult("bad-ref", true),
  ]) + "\ninvalid JSON\n");
  const large = path.join(root, "large.jsonl");
  fs.writeFileSync(large, ""); fs.truncateSync(large, 151 * 1024 * 1024);
  const missing = path.join(root, "missing.jsonl"), size = fs.statSync(log).size;
  const zero = scanUsage(skills, [log], 0);
  assert.equal(zero.eligibleFiles, 1); assert.equal(zero.scannedFiles.length, 0); assert.equal(zero.bytesRead, 0);
  assert.deepEqual(zero.skippedFiles, [{ path: log, reason: "byte-limit" }]);
  const limited = scanUsage(skills, [log], size - 1);
  assert.equal(limited.scannedFiles.length, 0); assert.equal(limited.skippedFiles.length, 1);
  const scan = scanUsage(skills, [large, log, missing, root], size);
  assert.equal(scan.eligibleFiles, 4); assert.deepEqual(scan.scannedFiles, [log]); assert.equal(scan.bytesRead, size);
  assert.deepEqual(scan.skippedFiles, [{ path: large, reason: "oversized" }]);
  assert.equal(scan.errorFiles.length, 2); assert.equal(scan.records.malformed, 1);
  assert.equal(scan.usage.get("declared")?.fileRead, 1);
  assert.equal(scan.usage.get("declared")?.referenceRequest, 2);
  assert.equal(scan.usage.get("declared")?.referenceRead, 1);
  assert.equal(fs.readFileSync(file, "utf8").endsWith("body\n"), true);
});

test("bounds growing files and accounts for bytes read before an I/O failure", (context) => {
  const root = fixture(context), file = path.join(root, "live.jsonl"), original = jsonl([{ role: "user", content: "/skill:design" }]);
  fs.writeFileSync(file, original);
  const read = fs.readSync;
  try {
    fs.readSync = ((fd: number, buffer: Buffer, offset: number, length: number, position: number | null) => {
      const count = read(fd, buffer, offset, length, position);
      fs.appendFileSync(file, "more data than was budgeted");
      return count;
    }) as typeof fs.readSync;
    const changed = scanUsage([], [file], Buffer.byteLength(original));
    assert.equal(changed.bytesRead, Buffer.byteLength(original));
    assert.equal(changed.scannedFiles.length, 0);
    assert.deepEqual(changed.skippedFiles, [{ path: file, reason: "changed-during-read" }]);
    fs.writeFileSync(file, original);
    let calls = 0;
    fs.readSync = ((fd: number, buffer: Buffer, offset: number, length: number, position: number | null) => {
      if (calls++) throw Object.assign(new Error("fixture I/O failure"), { code: "EIO" });
      return read(fd, buffer, offset, Math.min(4, length), position);
    }) as typeof fs.readSync;
    const failed = scanUsage([], [file], 1024);
    assert.equal(failed.bytesRead, 4);
    assert.equal(failed.scannedFiles.length, 0);
    assert.deepEqual(failed.errorFiles, [{ path: file, reason: "EIO" }]);
  } finally { fs.readSync = read; }
});

test("uses the requested token ratio consistently and leaves actual context unknown", (context) => {
  const root = fixture(context); writeSkill(root, "unicode", "unicode", "Body 界😀\n");
  const skills = discoverSkills([root]);
  const four = skillBudget(skills, 4), eight = skillBudget(skills, 8);
  const line = `- unicode: A focused skill. (file: ${skills[0]!.path})\n`;
  assert.equal(four.unbudgetedFullTokens, Math.ceil([...line].length / 4));
  assert.equal(eight.unbudgetedFullTokens, Math.ceil([...line].length / 8));
  assert.ok(eight.minimumTokens < four.minimumTokens);
  assert.equal(tokenCost("界😀ab", 4), 1);
  assert.equal(four.contextTokens, null); assert.equal(four.budgetTokens, null);
  const scenario = skillBudget(skills, 8, 100_000, 2);
  assert.equal(scenario.budgetTokens, 2000);
  assert.equal(scenario.remainingBudgetTokens, 2000 - eight.unbudgetedFullTokens);
});

test("CLI preserves explicit scope, exposes skipped evidence, and does not invent enabled/native budgets", (context) => {
  const root = fixture(context), source = path.join(root, "chosen");
  const file = writeSkill(source, "visible");
  writeSkill(source, "hidden", "hidden", "body", "disable-model-invocation: true\n");
  writeSkill(path.join(root, "home/.agents/skills"), "unselected");
  writeSkill(path.join(root, ".claude/skills"), "project-claude");
  const logs = path.join(root, "logs"); fs.mkdirSync(logs);
  fs.writeFileSync(path.join(logs, "fixture.jsonl"), jsonl([piRead("id", file), piResult("id")]));
  const before = fs.readFileSync(file);
  const args = ["--root", source, "--root-only", "--budget-root", source, "--log-root", logs, "--max-log-mb", "0"];
  const result = cli(root, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.modelVisible, ["visible"]); assert.deepEqual(report.userInvoked, ["hidden"]);
  assert.equal(report.logScan.eligibleFiles, 1); assert.equal(report.logScan.scannedFiles.length, 0);
  assert.equal(report.logScan.skippedFiles.length, 1); assert.equal(report.logScan.errorFiles.length, 0);
  assert.equal(report.logScan.bytesRead, 0); assert.equal(report.skills[0].enabled, null);
  assert.equal(report.budget.contextSource, "unknown"); assert.match(report.effectiveSelection, /unknown/);
  assert.equal(report.budget.budgetedTokens, undefined); assert.match(report.payloadEvidence.references, /not measured/);
  const eight = cli(root, [...args, "--json", "--chars-per-token", "8"]);
  assert.equal(eight.status, 0, eight.stderr);
  assert.ok(JSON.parse(eight.stdout).budget.unbudgetedFullTokens < report.budget.unbudgetedFullTokens);
  const text = cli(root, args); assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /log_files_scanned: 0/); assert.match(text.stdout, /do not infer unused skills/);
  assert.doesNotMatch(text.stdout, /full_tokens_pi_loads_all|budgeted_tokens_claude_1pct/);
  const defaults = cli(root, ["--no-logs", "--json"]);
  assert.equal(defaults.status, 0, defaults.stderr);
  assert.ok(!JSON.parse(defaults.stdout).skills.some((skill: any) => skill.name === "project-claude"), "default roots must not expand without approval");
  const explicit = cli(root, ["--no-logs", "--root-only", "--root", path.join(root, ".claude/skills"), "--json"]);
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.deepEqual(JSON.parse(explicit.stdout).modelVisible, ["project-claude"]);
  assert.deepEqual(fs.readFileSync(file), before);
  const invalid = cli(root, ["--chars-per-token", "0"]); assert.equal(invalid.status, 2); assert.match(invalid.stderr, /positive/);
  assert.equal(cli(root, ["--root-only"]).status, 2);
  assert.equal(cli(root, ["--root-only", "--root", ""]).status, 2);
  assert.equal(cli(root, ["--log-root", ""]).status, 2);
  const help = cli(root, ["--help"]); assert.equal(help.status, 0); assert.match(help.stdout, /^Usage:/); assert.doesNotMatch(help.stdout, /Skill Cleaner Report/);
});

test("drift output does not mislabel matching copies in a mixed group", (context) => {
  const root = fixture(context), source = path.join(root, "source"), same = path.join(root, "same"), different = path.join(root, "different");
  writeSkill(source, "example"); const matching = writeSkill(same, "example");
  const changed = writeSkill(different, "example", "example", "Changed body.\n");
  const output = cli(root, ["--root-only", "--root", source, "--root", same, "--root", different, "--budget-root", source, "--no-logs"]);
  assert.equal(output.status, 0, output.stderr);
  assert.ok(output.stdout.includes(`differs: ${changed}`));
  assert.ok(!output.stdout.includes(`differs: ${matching}`));
});

test("capped candidate lists disclose omitted counts", (context) => {
  const root = fixture(context), source = path.join(root, "skills"), logs = path.join(root, "logs");
  for (let i = 0; i < 85; i++) {
    const file = writeSkill(source, `example-${i}`);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("A focused skill.", "A deliberately long candidate description. ".repeat(4)));
  }
  fs.mkdirSync(logs);
  fs.writeFileSync(path.join(logs, "fixture.jsonl"), jsonl([{ role: "user", content: "Unrelated fixture message." }]));
  const output = cli(root, ["--root", source, "--root-only", "--log-root", logs]);
  assert.equal(output.status, 0, output.stderr);
  assert.match(output.stdout, /55 further description candidates/);
  assert.match(output.stdout, /5 further names with no observed use/);
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
