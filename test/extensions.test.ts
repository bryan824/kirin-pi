import { expect, mock, test } from "bun:test";
import { linkSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const extensions = path.join(root, "extensions");
const coreStub = {
  isToolCallEventType: (name: string, event: { toolName: string }) => event.toolName === name,
  DEFAULT_MAX_BYTES: 50_000, DEFAULT_MAX_LINES: 2_000, formatSize: String,
  withFileMutationQueue: (_file: string, run: () => unknown) => run(),
  truncateHead: (content: string) => ({ content, truncated: false }),
  truncateTail: (content: string) => ({ content, truncated: false }),
};
const entrypoints = [
  "chatgpt-export.ts",
  "guardrails.ts",
  "herdr/index.ts",
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

test("extensions declare their Pi minimum and use current lifecycle seams", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  for (const peer of ["pi-ai", "pi-coding-agent", "pi-tui"]) {
    expect(pkg.peerDependencies[`@earendil-works/${peer}`]).toBe(">=0.87.1");
    expect(pkg.peerDependenciesMeta[`@earendil-works/${peer}`].optional).toBe(true);
  }
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

function resolvePeer(name: string) {
  // Resolve import-only peers too, locally or from the installed Pi. No install.
  try { return fileURLToPath(import.meta.resolve(name)); }
  catch {
    const pi = Bun.which("pi");
    if (!pi) throw new Error(`These runtime tests need ${name} or Pi on PATH.`);
    return fileURLToPath(import.meta.resolve(name, pathToFileURL(realpathSync(pi)).href));
  }
}

function requirePeer(name: string) {
  return createRequire(import.meta.url)(resolvePeer(name));
}

test("ChatGPT adapter shares input-alias protection and preserves full output artifacts", async () => {
  const typebox = requirePeer("typebox");
  mock.module("typebox", () => typebox);
  mock.module("@earendil-works/pi-ai", () => ({ StringEnum: (values: string[]) => ({ type: "string", enum: values }) }));
  const queued: string[] = [];
  let truncated = false;
  mock.module("@earendil-works/pi-coding-agent", () => ({
    ...coreStub,
    withFileMutationQueue: (file: string, run: () => unknown) => { queued.push(file); return run(); },
    truncateHead: (content: string) => ({ content: truncated ? content.slice(0, 5) : content, truncated,
      outputLines: 1, totalLines: 2, outputBytes: 5, totalBytes: content.length }),
  }));
  const { default: extension } = await import("../extensions/chatgpt-export.ts");
  const { parseChatGptExportHtml, renderExport } = await import("../chatgpt-export.ts");
  const dir = mkdtempSync(path.join(os.tmpdir(), "kirin-export-tool-"));
  const oldTmp = process.env.TMPDIR;
  try {
    process.env.TMPDIR = dir; // Automatic artifacts stay inside this fixture too.
    const input = path.join(dir, "chat.html");
    const html = '<article data-message-author-role="assistant"><pre><code>    a  b &lt;tag&gt;\n</code></pre></article>';
    writeFileSync(input, html);
    symlinkSync(input, path.join(dir, "link.html"));
    linkSync(input, path.join(dir, "hard.html"));
    let tool: any;
    extension({ registerTool: (value: any) => { tool = value; } } as any);
    const run = (outputPath?: string) => tool.execute("fixture", { path: "@chat.html", format: "json", outputPath }, undefined, undefined, { cwd: dir });
    for (const target of [input, "link.html", "hard.html"]) {
      await expect(run(target)).rejects.toThrow(/input/);
      expect(readFileSync(input, "utf8")).toBe(html);
    }
    const explicit = await run("@out/result.json");
    const expected = renderExport(parseChatGptExportHtml(html, input), "json");
    expect(readFileSync(explicit.details.outputPath, "utf8")).toBe(expected);
    expect(queued).toContain(path.join(dir, "out/result.json"));
    truncated = true;
    const automatic = await run();
    expect(path.dirname(automatic.details.outputPath).startsWith(dir + path.sep)).toBe(true);
    expect(readFileSync(automatic.details.outputPath, "utf8")).toBe(expected);
    expect(automatic.content[0].text).toContain("Full output saved to:");
    expect(automatic.details.truncation.truncated).toBe(true);
    expect(readFileSync(input, "utf8")).toBe(html);
  } finally {
    if (oldTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = oldTmp;
    rmSync(dir, { recursive: true, force: true });
  }
});

async function herdrFixture(checkActivation = false) {
  const TypeBox = requirePeer("typebox");
  mock.module("typebox", () => TypeBox);
  mock.module("@earendil-works/pi-coding-agent", () => coreStub);
  mock.module("@earendil-works/pi-ai", () => ({ StringEnum: (values: string[]) => ({ type: "string", enum: values }) }));
  mock.module("@earendil-works/pi-tui", () => ({ Text: class { setText() {} } }));
  const keys = ["HERDR_ENV", "HERDR_PANE_ID", "HERDR_SOCKET_PATH"];
  const saved = keys.map((key) => process.env[key]);
  process.env.HERDR_ENV = "1"; process.env.HERDR_PANE_ID = "w1:p1";
  delete process.env.HERDR_SOCKET_PATH; // Never connect to the real session.
  try {
    const { default: register } = await import("../extensions/herdr/index.ts");
    const own = { pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1", agent: "pi", agent_status: "idle" };
    const remote = { ...own, pane_id: "w2:p1", workspace_id: "w2", tab_id: "w2:t1" };
    const raw = { ...own, pane_id: "w1:p2", agent: undefined, agent_status: "unknown" };
    const panes = new Map<string, any>([own, remote, raw].map((pane) => [pane.pane_id, pane]));
    const failures = new Map<string, any>(), calls: string[][] = [], signals: (AbortSignal | undefined)[] = [];
    const handlers = new Map<string, Function>();
    let tool: any;
    const pi = { events: { on() {} }, on: (event: string, handler: Function) => handlers.set(event, handler),
      registerTool: (value: any) => { tool = value; },
      exec: async (_bin: string, args: string[], options: any) => {
        calls.push(args); signals.push(options?.signal);
        let result: any = {};
        if (args[0] === "pane" && args[1] === "get") {
          if (failures.has(args[2])) return failures.get(args[2]);
          const pane = panes.get(args[2]);
          if (!pane) return { code: 1, stdout: "", stderr: JSON.stringify({ error: { code: "pane_not_found", message: "fixture pane is absent" } }) };
          result = { pane };
        } else if (args[0] === "workspace" && args[1] === "create") {
          result = { workspace: { workspace_id: "w2", label: "fixture" }, root_pane: remote };
        } else if (args[0] === "tab" && args[1] === "create") {
          result = { tab: { workspace_id: "w2", tab_id: "w2:t1", label: "fixture" }, root_pane: remote };
        } else if (args[0] === "pane" && args[1] === "list") result = { panes: [...panes.values()].filter((pane) => pane.workspace_id === args[3]) };
        else if (args[0] === "pane" && args[1] === "read") return { code: 0, stdout: "fixture output", stderr: "" };
        else if (args[0] === "pane" && args[1] === "wait-output") result = { matched_line: "ready", read: { text: "ready" } };
        else if (args[0] === "pane" && args[1] === "split") result = { pane: remote };
        else if (args[0] === "tab" && args[1] === "focus") result = { tab: { tab_id: args[2], label: "fixture" } };
        else if (!(args[0] === "pane" && ["run", "send-text", "send-keys", "close"].includes(args[1]))) throw new Error(`Unexpected inert command: ${args.join(" ")}`);
        return { code: 0, stdout: JSON.stringify({ result }), stderr: "" };
      },
    };
    if (checkActivation) for (const value of [undefined, "0", "true"]) {
      if (value === undefined) delete process.env.HERDR_ENV; else process.env.HERDR_ENV = value;
      register(pi as any);
      expect(tool, `HERDR_ENV=${value}`).toBeUndefined();
    }
    process.env.HERDR_ENV = "1"; register(pi as any);
    return { panes, failures, calls, signals, handlers,
      run: (params: any, signal?: AbortSignal) => tool.execute("inert", params, signal, undefined, {}),
    };
  } finally {
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  }
}

test("Herdr requires exact managed-environment activation", async () => {
  await herdrFixture(true);
});

test("Herdr preserves explicit and created cross-workspace targets, focus, cwd and raw watch syntax", async () => {
  const f = await herdrFixture();
  await f.run({ action: "workspace_create", pane: "server", cwd: "/fixture", label: "fixture" });
  expect(f.calls.at(-1)).toEqual(["workspace", "create", "--cwd", "/fixture", "--label", "fixture", "--no-focus"]);
  const run = await f.run({ action: "run", pane: "server", command: "fixture; never executed" });
  expect(run.details.workspaceId).toBe("w2");
  expect(f.calls).toContainEqual(["pane", "run", "w2:p1", "fixture; never executed"]);
  await f.run({ action: "read", pane: "w2:p1", raw: true });
  expect(f.calls.at(-1)).toEqual(["pane", "read", "w2:p1", "--source", "recent", "--lines", "20", "--raw"]);
  await f.run({ action: "watch", pane: "server", match: "ready.*", regex: true, raw: true, source: "recent-unwrapped", lines: 30, timeout: 100 });
  expect(f.calls.at(-1)).toEqual(["pane", "wait-output", "w2:p1", "--regex", "ready.*", "--source", "recent-unwrapped", "--lines", "30", "--timeout", "100", "--raw"]);
  await f.run({ action: "watch", pane: "server", match: "ready" });
  expect(f.calls.at(-1)).toEqual(["pane", "wait-output", "w2:p1", "--match", "ready"]);
  await f.run({ action: "tab_create", workspace: "w2", pane: "tests", cwd: "/fixture", focus: true });
  expect(f.calls.at(-1)).toEqual(["tab", "create", "--workspace", "w2", "--cwd", "/fixture"]);
  await f.run({ action: "pane_split", pane: "tests", newPane: "split", direction: "down", cwd: "/fixture" });
  expect(f.calls.at(-1)).toEqual(["pane", "split", "w2:p1", "--direction", "down", "--cwd", "/fixture", "--no-focus"]);
  await f.run({ action: "pane_split" });
  expect(f.calls.at(-1)).toEqual(["pane", "split", "w1:p1", "--direction", "right", "--no-focus"]);
  await f.run({ action: "send", pane: "server", text: "inert", keys: "C-c Enter" });
  expect(f.calls.slice(-2)).toEqual([["pane", "send-text", "w2:p1", "inert"], ["pane", "send-keys", "w2:p1", "C-c", "Enter"]]);
  await expect(f.run({ action: "stop", pane: "w1:p1" })).rejects.toThrow("Refusing to close the pane pi is running in");
  expect(f.calls.some((args) => args[1] === "close")).toBe(false);
  await f.run({ action: "focus", pane: "server" });
  expect(f.calls.at(-1)).toEqual(["tab", "focus", "w2:t1"]);
});

test("Herdr preserves aliases on transport/malformed errors and removes only confirmed missing targets", async () => {
  const f = await herdrFixture();
  await f.run({ action: "workspace_create", pane: "server" });
  for (const failure of [
    { code: 1, stderr: "fixture socket unavailable", stdout: "" },
    { code: 0, stderr: "", stdout: "not JSON" },
    { code: 0, stderr: "", stdout: JSON.stringify({ result: {} }) },
  ]) {
    f.failures.set("w2:p1", failure);
    await expect(f.run({ action: "read", pane: "server" })).rejects.toThrow();
    const listed = await f.run({ action: "list" });
    expect(listed.details.aliases.server).toEqual({ paneId: "w2:p1", workspaceId: "w2" });
    expect(f.calls.some((args) => args[0] === "pane" && args[1] === "get" && args[2] === "server")).toBe(false);
  }
  f.failures.clear();
  const success = await f.run({ action: "read", pane: "server" });
  f.handlers.get("session_tree")!({}, { sessionManager: { getBranch: () => [{ type: "message", message: { role: "toolResult", toolName: "herdr", details: success.details } }] } });
  expect((await f.run({ action: "read", pane: "server" })).details.aliases.server.paneId).toBe("w2:p1");
  f.panes.delete("w2:p1");
  await expect(f.run({ action: "read", pane: "server" })).rejects.toThrow("no longer points to a live pane and was removed");
  expect((await f.run({ action: "list" })).details.aliases.server).toBeUndefined();
});

test("Herdr waits require an agent and preserve aggregate modes, unknown, timeouts and cancellation", async () => {
  const f = await herdrFixture();
  await expect(f.run({ action: "wait_agent", pane: "w1:p2", status: "unknown", timeout: 0 })).rejects.toThrow("no recognized coding agent");
  f.panes.get("w2:p1").agent_status = "unknown";
  const unknown = await f.run({ action: "wait_agent", pane: "w2:p1", status: "unknown", timeout: 0 });
  expect(unknown.details.snapshot[0].agent).toBe("pi");
  f.panes.get("w2:p1").agent_status = "working";
  const params = { action: "wait_agent", panes: ["w1:p1", "w2:p1"], statuses: ["idle", "done"], timeout: 0 };
  expect((await f.run({ ...params, mode: "any" })).details.snapshot).toHaveLength(2);
  await expect(f.run({ ...params, mode: "all" })).rejects.toThrow("Timed out");
  f.panes.get("w2:p1").agent_status = "done";
  expect((await f.run({ ...params, mode: "all" })).details.mode).toBe("all");
  const pre = new AbortController(); pre.abort();
  f.calls.length = 0;
  await expect(f.run(params, pre.signal)).rejects.toThrow(/canceled|Aborted/);
  expect(f.calls).toHaveLength(0);
  f.panes.get("w2:p1").agent_status = "working";
  const late = new AbortController();
  const timer = setTimeout(() => late.abort(), 10);
  try { await expect(f.run({ ...params, mode: "all", timeout: 1000 }, late.signal)).rejects.toThrow(/canceled|Aborted/); }
  finally { clearTimeout(timer); }
  expect(f.signals).toContain(late.signal);
});

test("Herdr state reporting is TUI-only and retains identity, blocked, reload and settled state", () => {
  // Isolated built-in socket mock: no Herdr executable, socket or model is touched.
  const script = [
    'import net from "node:net"; import { EventEmitter } from "node:events";',
    'const requests = []; net.createConnection = () => { const s = new EventEmitter(); s.destroy = () => {}; s.write = (line) => { requests.push(JSON.parse(line)); queueMicrotask(() => s.emit("data", "{}")); }; queueMicrotask(() => s.emit("connect")); return s; };',
    `const { default: register } = await import(${JSON.stringify(path.join(extensions, "herdr", "agent-state.ts"))});`,
    'const handlers = new Map(), events = new Map(); register({ on: (n,h) => handlers.set(n,h), events: { on: (n,h) => events.set(n,h) } });',
    'let idle = true; const ctx = { hasUI: true, mode: "rpc", isIdle: () => idle, sessionManager: { getSessionFile: () => "/fixture/session.jsonl", getSessionId: () => "fixture-id" } };',
    'const flush = () => new Promise(resolve => setImmediate(resolve));',
    'for (const mode of ["rpc", "json", "print", undefined]) { ctx.mode = mode; await handlers.get("session_start")({ reason: "startup" }, ctx); await flush(); }',
    'const headless = requests.splice(0); ctx.mode = "tui"; await handlers.get("session_start")({ reason: "startup" }, ctx); await flush();',
    'idle = false; handlers.get("agent_start")({}, ctx); await flush(); events.get("herdr:blocked")({ active: true, label: "fixture approval" }); await flush();',
    'events.get("herdr:blocked")({ active: false }); await flush(); handlers.get("agent_settled")({}, ctx); await flush();',
    'idle = true; handlers.get("agent_settled")({}, ctx); await flush(); idle = false; await handlers.get("session_start")({ reason: "reload" }, ctx); await flush();',
    'console.log(JSON.stringify({ headless, requests }));',
  ].join("\n");
  const result = Bun.spawnSync([process.execPath, "--no-install", "-e", script], { cwd: root, env: {
    ...process.env, HERDR_ENV: "1", HERDR_PANE_ID: "fixture-pane", HERDR_SOCKET_PATH: "/fixture/not-a-socket",
  }, stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const { headless, requests } = JSON.parse(result.stdout.toString());
  expect(headless).toEqual([]);
  expect(requests.filter((item: any) => item.method === "pane.report_agent").map((item: any) => item.params.state)).toEqual(["idle", "working", "blocked", "working", "idle", "working"]);
  expect(requests.every((item: any) => item.params.pane_id === "fixture-pane" && item.params.agent === "pi" && item.params.agent_session_path === "/fixture/session.jsonl")).toBe(true);
  expect(requests.map((item: any) => item.params.seq)).toEqual([...requests.map((item: any) => item.params.seq)].sort((a, b) => a - b));
  expect(requests.at(-2).params.session_start_source).toBe("reload");
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

test("Herdr keeps official state support intact and layers its tool on top", () => {
  const state = readFileSync(path.join(extensions, "herdr", "agent-state.ts"), "utf8");
  const integration = readFileSync(path.join(extensions, "herdr", "index.ts"), "utf8");
  const skill = readFileSync(path.join(root, "skills", "domain", "herdr", "SKILL.md"), "utf8");

  expect(state).toContain("HERDR_INTEGRATION_VERSION=8");
  expect(state).toContain('pi.on("agent_settled"');
  expect(state).toContain('method: "pane.report_agent_session"');
  expect(state).toContain("sendRequestAttempt(request, 500)");
  expect(state).toContain("sendRequestAttempt(request, 1500)");
  expect(integration).toContain("setupHerdrAgentState(pi)");
  expect(integration).toContain("{ additionalProperties: false })");
  expect(integration).not.toContain("constrainedSampling:");
  expect(integration).toContain("docs/UPSTREAM_LEDGER.md");
  expect(state).toContain("Modified for kirin-pi");
  expect(skill).toContain("## Pi integration");
  expect(skill).toContain("herdr agent prompt");
});
