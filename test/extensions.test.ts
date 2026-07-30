import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const extensions = path.join(root, "harness", "extensions");
const entrypoints = [
  "agent-sync.ts",
  "chatgpt-export.ts",
  "guardrails.ts",
  "herdr/index.ts",
  "opencode-cli.ts",
  "session-breakdown.ts",
].map((relative) => path.join(extensions, relative));

test("all extension entrypoints compile with Pi peers external", () => {
  const outdir = mkdtempSync(path.join(os.tmpdir(), "kirin-extensions-"));
  const result = Bun.spawnSync([
    "bun", "build", ...entrypoints,
    "--outdir", outdir,
    "--target", "bun",
    "--external", "@earendil-works/*",
    "--external", "typebox",
  ], { cwd: root, stderr: "pipe", stdout: "pipe" });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
});

test("extensions use current Pi lifecycle seams", () => {
  expect(readFileSync(path.join(extensions, "guardrails.ts"), "utf8")).toContain('pi.on("tool_call"');
  expect(readFileSync(path.join(extensions, "opencode-cli.ts"), "utf8")).toContain("refreshModels");
  expect(readFileSync(path.join(extensions, "session-breakdown.ts"), "utf8")).toContain("SessionManager.listAll");
});

test("Herdr keeps official state support intact and layers its tool on top", () => {
  const state = readFileSync(path.join(extensions, "herdr", "agent-state.ts"), "utf8");
  const integration = readFileSync(path.join(extensions, "herdr", "index.ts"), "utf8");
  const skill = readFileSync(path.join(root, "skills", "domain", "herdr", "SKILL.md"), "utf8");

  expect(state).toContain("HERDR_INTEGRATION_VERSION=7");
  expect(state).toContain('pi.on("agent_settled"');
  expect(state).toContain('method: "pane.report_agent_session"');
  expect(state).toContain("sendRequestAttempt(request, 500)");
  expect(state).toContain("sendRequestAttempt(request, 1500)");
  expect(integration).toContain("setupHerdrAgentState(pi)");
  expect(integration).toContain("https://github.com/herdrdev/herdr/blob/master/src/integration/assets/pi/herdr-agent-state.ts");
  expect(integration).toContain("https://github.com/herdrdev/herdr/blob/master/skills/herdr/SKILL.md");
  expect(skill).toContain("## Pi integration");
  expect(skill).toContain("herdr agent prompt");
});
