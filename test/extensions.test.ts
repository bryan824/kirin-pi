import { expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const extensions = path.join(root, "extensions");
const coreStub = {
  isToolCallEventType: (name: string, event: { toolName: string }) => event.toolName === name,
};
const entrypoints = [
  "guardrails.ts",
  "session-breakdown.ts",
].map((relative) => path.join(extensions, relative));

test("only approved extension entrypoints ship and compile with Pi peers external", () => {
  expect(readdirSync(extensions).sort()).toEqual(entrypoints.map((file) => path.basename(file)).sort());
  const outdir = mkdtempSync(path.join(os.tmpdir(), "kirin-extensions-"));
  const result = Bun.spawnSync([
    "bun", "build", ...entrypoints,
    "--outdir", outdir,
    "--target", "bun",
    "--external", "@earendil-works/*",
  ], { cwd: root, stderr: "pipe", stdout: "pipe" });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
});

test("extensions declare their Pi minimum and use current lifecycle seams", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  expect(pkg.peerDependencies).toEqual({
    "@earendil-works/pi-coding-agent": ">=0.87.1",
    "@earendil-works/pi-tui": ">=0.87.1",
  });
  expect(pkg.peerDependenciesMeta).toEqual({
    "@earendil-works/pi-coding-agent": { optional: true },
    "@earendil-works/pi-tui": { optional: true },
  });
  expect(readFileSync(path.join(extensions, "guardrails.ts"), "utf8")).toContain('pi.on("tool_call"');
  expect(readFileSync(path.join(extensions, "session-breakdown.ts"), "utf8")).toContain("SessionManager.listAll");
});

test("Pi guard adapters use the same command policy", async () => {
  mock.module("@earendil-works/pi-coding-agent", () => coreStub);
  const { default: register } = await import("../extensions/guardrails.ts");
  const handlers = new Map<string, Function>();
  register({ on: (name: string, handler: Function) => handlers.set(name, handler) } as any);
  const blocked = 'git -C repo add -A';
  const allowed = 'git commit -m "document --no-verify behavior"';
  expect(handlers.get("tool_call")!({ toolName: "bash", input: { command: blocked } })).toMatchObject({ block: true });
  expect(handlers.get("tool_call")!({ toolName: "bash", input: { command: "exec -a git git add -A" } })).toMatchObject({ block: true });
  expect(handlers.get("tool_call")!({ toolName: "bash", input: { command: allowed } })).toBeUndefined();
  expect(handlers.get("tool_call")!({ toolName: "read", input: { path: blocked } })).toBeUndefined();
  expect(handlers.get("user_bash")!({ command: blocked })).toMatchObject({ result: { exitCode: 1 } });
  expect(handlers.get("user_bash")!({ command: allowed })).toBeUndefined();
});

test("session breakdown counts standalone usage without changing message totals, discovery, summaries or DST", () => {
  // Real local parser/renderer + installed width primitives, synthetic files only.
  const script = `
import { mock, setSystemTime } from "bun:test";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
const peer = createRequire(realpathSync(Bun.which("pi")));
const tuiPeer = peer("@earendil-works/pi-tui");
mock.module("@earendil-works/pi-tui", () => tuiPeer);
const now = new Date(process.env.FIXTURE_NOW);
setSystemTime(now);
const started = new Date(now); started.setDate(started.getDate() - 2); started.setHours(1, 30, 0, 0);
const dir = mkdtempSync(path.join(os.tmpdir(), "kirin-breakdown-"));
const file = path.join(dir, "fixture.jsonl");
const model = "模型🧑🏽‍💻é";
const includeUsage = process.env.FIXTURE_USAGE === "1";
const contents = [
  { type: "session", timestamp: started.toISOString(), cwd: "/fixture/项目/é" },
  { type: "model_change", provider: "fixture", modelId: model },
  { type: "message", message: { role: "user", content: "fixture" } },
  ...(includeUsage ? [
    { type: "usage", kind: "cache_warm", provider: "fixture", model: "warm", usage: { totalTokens: 999, cost: { total: 0.25 } } },
    { type: "usage", kind: "future-operation", provider: "other-provider", model: "other", usage: { totalTokens: 101, cost: { total: 0.5 } } },
  ] : []),
  { type: "message", message: { role: "assistant", usage: { totalTokens: 100, cost: { total: 2 } } } },
  { type: "compaction", usage: { total_tokens: 20, cost: { total: "0.25" } } },
  { type: "branch_summary", usage: { input_tokens: 12, output_tokens: 18, cost: 0.5 } },
].map(JSON.stringify).join("\\n") + "\\n{malformed fixture\\n";
writeFileSync(file, contents);
let discoveries = 0, canceled = false;
class Loader {
  controller = new AbortController(); signal = this.controller.signal;
  loader = { setMessage() {} }; onAbort;
  abort() { this.controller.abort(); this.onAbort(); }
}
mock.module("@earendil-works/pi-coding-agent", () => ({ BorderedLoader: Loader, SessionManager: {
  async listAll(onProgress) { discoveries++; onProgress(2);
    if (canceled) { await new Promise(resolve => setImmediate(resolve)); return []; }
    return [
    { path: file, created: started },
    { path: path.join(dir, "old-must-not-be-read.jsonl"), created: new Date("2020-01-01") },
  ]; }
} }));
try {
  const { default: register } = await import(${JSON.stringify(path.join(extensions, "session-breakdown.ts"))});
  let handler, component;
  const sent = [], notifications = [], frames = [];
  register({ registerCommand(_name, command) { handler = command.handler; }, sendMessage(...args) { sent.push(args); } });
  await handler("", { mode: "rpc", hasUI: true, ui: { custom() { throw new Error("Headless UI opened"); } } });
  const ui = {
    notify(...args) { notifications.push(args); },
    custom(factory) { return new Promise(resolve => {
      const widget = factory({ requestRender() {} }, {}, {}, resolve);
      if (widget instanceof Loader) {
        if (canceled) queueMicrotask(() => widget.abort());
      } else {
        component = widget;
        for (const range of ["1", "2", "3"]) {
          widget.handleInput(range);
          for (let metric = 0; metric < 3; metric++) {
            for (let view = 0; view < 4; view++) {
              for (const width of [1, 2, 4, 8, 20, 40, 80, 120, 240]) {
                const lines = widget.render(width);
                if (lines.some(line => tuiPeer.visibleWidth(line) > width)) throw new Error("render overflow");
                frames.push([range, metric, view, width, lines]);
              }
              widget.handleInput("j");
            }
            widget.handleInput("t");
          }
        }
        widget.handleInput("q");
      }
    }); },
  };
  await handler("", { mode: "tui", ui });
  const data = component.data;
  const byModel = (value, metric) => Object.fromEntries([...value.by.model].filter(([, t]) => t[metric] > 0).map(([key, t]) => [key, t[metric]]));
  const ranges = [...data.ranges.entries()].map(([count, value]) => ({
    count, days: value.days.length, unique: new Set(value.days.map(day => day.dayKeyLocal)).size,
    midnight: value.days.every(day => day.date.getHours() === 0),
    hours: [...new Set(value.days.slice(1).map((day, i) => (day.date - value.days[i].date) / 3600000))].sort(),
    ...value.total,
    modelTokens: byModel(value, "tokens"), modelCost: byModel(value, "cost"),
    modelMessages: byModel(value, "messages"), modelSessions: byModel(value, "sessions"),
  }));
  canceled = true;
  await handler("", { mode: "tui", ui });
  await new Promise(resolve => setImmediate(resolve));
  console.log(JSON.stringify({ discoveries, sent, notifications, ranges,
    frames: frames.length, unicode: JSON.stringify(frames).includes(model),
    ansi: frames.some(frame => frame[4].some(line => line.includes("\\x1b["))),
    renderHash: createHash("sha256").update(JSON.stringify(frames)).digest("hex"),
    summary: component.render(240).join("\\n"),
    unchanged: readFileSync(file, "utf8") === contents,
  }));
} finally { rmSync(dir, { recursive: true, force: true }); }
`;
  const home = mkdtempSync(path.join(os.tmpdir(), "kirin-breakdown-home-"));
  try {
    for (const includeUsage of [false, true]) for (const [date, hours] of [["2026-03-10T16:00:00Z", [23, 24]], ["2026-11-03T17:00:00Z", [24, 25]]] as const) {
      const result = Bun.spawnSync([process.execPath, "--no-install", "-e", script], { cwd: home, env: {
        ...process.env, HOME: home, XDG_CONFIG_HOME: home, PI_CODING_AGENT_DIR: path.join(home, "pi"),
        TZ: "America/New_York", FIXTURE_NOW: date, FIXTURE_USAGE: includeUsage ? "1" : "0",
      }, stdout: "pipe", stderr: "pipe" });
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      const value = JSON.parse(result.stdout.toString());
      expect(value.discoveries).toBe(3);
      expect(value.sent).toHaveLength(1);
      expect(value.sent[0][0].content).toContain("Session breakdown (non-interactive)");
      expect(value.sent[0][1]).toEqual({ triggerTurn: false });
      expect(value.notifications).toEqual([["Cancelled", "info"]]);
      expect(value.frames).toBe(324);
      expect(value.unicode).toBe(true);
      expect(value.ansi).toBe(true);
      expect(value.unchanged).toBe(true);
      expect(value.summary).toContain(includeUsage ? "$3.50" : "$2.75");
      if (!includeUsage) expect(value.renderHash).toBe("06cf22a6eb22fd1f3d2160d3602890ba912c7e44b19be368bd0a4d94ea01ed32");
      for (const range of value.ranges) {
        expect(range.days).toBe(range.count);
        expect(range.unique).toBe(range.count);
        expect(range.midnight).toBe(true);
        expect(range.hours).toEqual(hours);
        expect(range).toMatchObject({ sessions: 1, messages: 2, tokens: includeUsage ? 1250 : 150, cost: includeUsage ? 3.5 : 2.75 });
        expect(range.modelMessages).toEqual({ "fixture/模型🧑🏽‍💻é": 2 });
        expect(range.modelTokens).toEqual({ "fixture/模型🧑🏽‍💻é": 150,
          ...(includeUsage ? { "fixture/warm": 999, "other-provider/other": 101 } : {}),
        });
        expect(range.modelCost).toEqual({ "fixture/模型🧑🏽‍💻é": 2.75,
          ...(includeUsage ? { "fixture/warm": 0.25, "other-provider/other": 0.5 } : {}),
        });
        expect(range.modelSessions).toEqual({ "fixture/模型🧑🏽‍💻é": 1,
          ...(includeUsage ? { "fixture/warm": 1, "other-provider/other": 1 } : {}),
        });
      }
      console.log(`session-breakdown fixture ${date}, standalone usage=${includeUsage}: ${value.frames} frames, SHA256 ${value.renderHash}`);
    }
  } finally { rmSync(home, { recursive: true, force: true }); }
});
