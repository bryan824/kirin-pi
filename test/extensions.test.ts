import { expect, mock, test } from "bun:test";
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

test("OpenCode bridge parses tool calls despite native closing tokens", async () => {
  mock.module("@earendil-works/pi-ai", () => ({
    calculateCost: () => undefined,
    createAssistantMessageEventStream: () => undefined,
  }));
  const { parseToolCalls } = await import(path.join(extensions, "opencode-cli.ts"));
  const body = '{"name":"bash","arguments":{"command":"ls"}}';
  const names = (text: string) => parseToolCalls(text).map((call) => call.name);

  expect(names(`<pi_tool_call>${body}</pi_tool_call>`)).toEqual(["bash"]);
  expect(names(`<pi_tool_call>${body}</｜｜DSML｜｜_tool_call>`)).toEqual(["bash"]);
  expect(names(`sure, checking\n<pi_tool_call>${body}</pi_tool_call>`)).toEqual(["bash"]);
  expect(
    names(`<pi_tool_call>${body}</pi_tool_call>\n<pi_tool_call>${body}</pi_tool_call>`),
  ).toEqual(["bash", "bash"]);
  expect(names('```json\n{"name":"bash","arguments":{}}\n```')).toEqual(["bash"]);
});

test("OpenCode bridge repairs unescaped quotes in tool-call JSON", async () => {
  mock.module("@earendil-works/pi-ai", () => ({
    calculateCost: () => undefined,
    createAssistantMessageEventStream: () => undefined,
  }));
  const { parseToolCalls } = await import(path.join(extensions, "opencode-cli.ts"));

  const broken = `<pi_tool_call>{
  "name": "bash",
  "arguments": {
    "command": "grep -rn "Agent types:\\\\|Explore" /tmp/docs | head -30"
  }
}</｜｜DSML｜｜_tool_call>`;
  expect(parseToolCalls(broken)).toEqual([
    {
      name: "bash",
      arguments: { command: 'grep -rn "Agent types:\\|Explore" /tmp/docs | head -30' },
    },
  ]);

  // Valid JSON must survive the repair path untouched.
  expect(
    parseToolCalls('<pi_tool_call>{"name":"bash","arguments":{"command":"echo \\"hi\\", ok"}}</pi_tool_call>'),
  ).toEqual([{ name: "bash", arguments: { command: 'echo "hi", ok' } }]);

  // Still no calls when there is no tool-call JSON at all.
  expect(parseToolCalls("plain answer, no tool needed")).toEqual([]);
});

test("OpenCode bridge rejects replies Pi cannot act on", async () => {
  mock.module("@earendil-works/pi-ai", () => ({
    calculateCost: () => undefined,
    createAssistantMessageEventStream: () => undefined,
  }));
  const { rejectionReason } = await import(path.join(extensions, "opencode-cli.ts"));
  const call = { name: "bash", arguments: {} };

  expect(rejectionReason("all done", [])).toBeUndefined();
  expect(rejectionReason("<pi_tool_call>{...}", [call])).toBeUndefined();
  expect(rejectionReason("<pi_tool_call>{bad json}", [])).toContain("not valid JSON");
  expect(rejectionReason("fine", [call], "read")).toContain("read");
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
  expect(integration).toContain("{ additionalProperties: false })");
  expect(integration).not.toContain("constrainedSampling:");
  expect(integration).toContain("https://github.com/herdrdev/herdr/blob/master/src/integration/assets/pi/herdr-agent-state.ts");
  expect(integration).toContain("https://github.com/herdrdev/herdr/blob/master/skills/herdr/SKILL.md");
  expect(skill).toContain("## Pi integration");
  expect(skill).toContain("herdr agent prompt");
});
