/**
 * OpenCode CLI provider for Pi.
 *
 * Registers provider `opencode-cli` and routes turns through the local
 * `opencode` binary. Model discovery uses `opencode models opencode` when
 * available, with env overrides and a bundled free-model fallback.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  calculateCost,
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type ImageContent,
  type Message,
  type Model,
  type SimpleStreamOptions,
  type TextContent,
  type Tool,
  type ToolCall,
} from "@earendil-works/pi-ai";

const PROVIDER_ID = "opencode-cli";
const PROVIDER_NAME = "OpenCode CLI";
const API_ID = "opencode-cli-runner";
const AGENT_ID = "pi-bridge";
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 16_384;
const DISCOVERY_TIMEOUT_MS = 8_000;
const STDERR_LIMIT = 20_000;
const OVERFLOW_PATTERN =
  /(context(?: length| window)?|prompt is too long|too many tokens|max(?:imum)?[^\n]*context)/i;

const DEFAULT_MODELS = [
  "opencode/deepseek-v4-flash-free",
  "opencode/mimo-v2.5-free",
  "opencode/nemotron-3-super-free",
  "opencode/big-pickle",
];

type ToolCallSpec = {
  name: string;
  arguments: Record<string, unknown>;
};

let registeredModels: string[] = [];
let lastDiscoveryAt: number | undefined;
let lastDiscoveryNote: string | undefined;

function opencodeBin(): string {
  return (
    process.env.OPENCODE_BIN?.trim() ||
    process.env.OPENCODE_PI_BIN?.trim() ||
    "opencode"
  );
}

function configuredModels(): string[] | undefined {
  const raw =
    process.env.OPENCODE_MODELS?.trim() ||
    process.env.OPENCODE_PI_MODELS?.trim();
  if (!raw) return undefined;
  return raw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((model) => (model.includes("/") ? model : `opencode/${model}`));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isBundledFreeModel(model: string): boolean {
  return /(^opencode\/.*-free$)|(^opencode\/big-pickle$)/.test(model);
}

function modelDisplayName(model: string): string {
  const [, id = model] = model.split(/\/(.*)/s);
  return `OpenCode ${id}`;
}

function contextWindowFor(model: string): number {
  return model.includes("big-pickle") ? 200_000 : DEFAULT_CONTEXT_WINDOW;
}

function maxTokensFor(model: string): number {
  return model.includes("big-pickle") ? 32_000 : DEFAULT_MAX_TOKENS;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function contentToText(
  content: string | (TextContent | ImageContent)[],
): string {
  if (typeof content === "string") return content;
  return content
    .map((item) => {
      if (item.type === "text") return item.text;
      return `[image omitted: ${item.mimeType}, ${item.data.length} base64 chars]`;
    })
    .join("\n");
}

function serializeMessage(message: Message): string {
  if (message.role === "user") {
    return `USER:\n${contentToText(message.content)}`;
  }

  if (message.role === "toolResult") {
    return [
      `PI TOOL RESULT (${message.toolName}, id=${message.toolCallId}, isError=${message.isError}):`,
      contentToText(message.content),
    ].join("\n");
  }

  const parts = message.content.map(
    (part: TextContent | ToolCall | { type: "thinking"; thinking: string }) => {
      if (part.type === "text") return part.text;
      if (part.type === "thinking") {
        return `<thinking>${part.thinking}</thinking>`;
      }
      return `<pi_tool_call>${safeJson({ name: part.name, arguments: part.arguments })}</pi_tool_call>`;
    },
  );
  return `ASSISTANT:\n${parts.join("\n")}`;
}

function serializeTools(tools?: Tool[]): string {
  if (!tools || tools.length === 0) {
    return "No Pi tools are available for this turn.";
  }
  return safeJson(
    tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  );
}

function buildPrompt(context: Context): string {
  const sections: string[] = [];
  sections.push(`# Pi/OpenCode bridge instructions

You are the model backend for Pi Coding Agent through the OpenCode CLI.
OpenCode's own tools are unavailable. Do not try to use OpenCode tools.

If you need Pi to run a tool, output only one or more tool-call blocks and no prose:
<pi_tool_call>{"name":"tool_name","arguments":{}}</pi_tool_call>

Rules for Pi tool calls:
- Use only tools listed in the \"Available Pi tools\" section.
- The JSON inside <pi_tool_call> must be valid JSON with \"name\" and \"arguments\" fields.
- Do not wrap tool calls in Markdown fences.
- If you can answer without a tool, answer normally in plain text.
- After Pi returns tool results, continue from the transcript and either answer or request another Pi tool call.`);

  if (context.systemPrompt?.trim()) {
    sections.push(`# Pi system prompt\n\n${context.systemPrompt}`);
  }

  sections.push(`# Available Pi tools\n\n${serializeTools(context.tools)}`);

  if (context.messages.length > 0) {
    sections.push(
      `# Conversation transcript\n\n${context.messages.map(serializeMessage).join("\n\n---\n\n")}`,
    );
  } else {
    sections.push("# Conversation transcript\n\n(no prior messages)");
  }

  sections.push("Now produce the next assistant message for Pi.");
  return sections.join("\n\n---\n\n");
}

function parseToolCalls(text: string): ToolCallSpec[] {
  const tagged = [...text.matchAll(/<pi_tool_call>([\s\S]*?)<\/pi_tool_call>/g)];
  if (tagged.length > 0) {
    return tagged.flatMap((match) => parseToolCallJson(match[1] ?? ""));
  }

  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return parseToolCallJson(stripped);
}

function parseToolCallJson(raw: string): ToolCallSpec[] {
  let value: unknown;
  try {
    value = JSON.parse(raw.trim());
  } catch {
    return [];
  }

  const candidates = Array.isArray(value)
    ? value
    : Array.isArray((value as { tool_calls?: unknown[] })?.tool_calls)
      ? ((value as { tool_calls: unknown[] }).tool_calls ?? [])
      : [value];

  const calls: ToolCallSpec[] = [];
  for (const candidate of candidates) {
    const record = candidate as {
      name?: unknown;
      tool?: unknown;
      arguments?: unknown;
      args?: unknown;
      input?: unknown;
    };
    const name =
      typeof record.name === "string"
        ? record.name
        : typeof record.tool === "string"
          ? record.tool
          : undefined;
    const args = record.arguments ?? record.args ?? record.input ?? {};
    if (!name || typeof args !== "object" || args === null || Array.isArray(args)) {
      continue;
    }
    calls.push({ name, arguments: args as Record<string, unknown> });
  }
  return calls;
}

function emptyUsage(): AssistantMessage["usage"] {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function fillEstimatedUsage(
  model: Model<Api>,
  output: AssistantMessage,
  prompt: string,
  reply: string,
): void {
  if (output.usage.totalTokens > 0) return;
  output.usage.input = estimateTokens(prompt);
  output.usage.output = estimateTokens(reply);
  output.usage.totalTokens = output.usage.input + output.usage.output;
  calculateCost(model, output.usage);
}

function runCapture(
  args: string[],
  input?: string,
  timeoutMs = DISCOVERY_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(opencodeBin(), args, {
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      env: { ...process.env, OPENCODE_DISABLE_UPDATE_CHECK: "1" },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`opencode timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-STDERR_LIMIT);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    if (input !== undefined) {
      child.stdin?.end(input);
    }
  });
}

async function discoverModels(): Promise<{
  models: string[];
  at: number;
  note?: string;
}> {
  const configured = configuredModels();
  if (configured?.length) {
    return {
      models: unique(configured),
      at: Date.now(),
      note: "using OPENCODE_MODELS override",
    };
  }

  try {
    const result = await runCapture(["models", "opencode"]);
    if (result.code !== 0) {
      throw new Error(
        result.stderr.trim() ||
          `opencode models exited with code ${result.code}`,
      );
    }

    const discovered = unique(
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("opencode/"))
        .filter(isBundledFreeModel),
    );

    return {
      models: discovered.length > 0 ? discovered : DEFAULT_MODELS,
      at: Date.now(),
      note:
        discovered.length > 0
          ? undefined
          : "discovery returned no free models; using bundled fallback",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      models: DEFAULT_MODELS,
      at: Date.now(),
      note: `model discovery fallback: ${message}`,
    };
  }
}

function providerModels(models: string[]) {
  return models.map((model) => ({
    id: model,
    name: `${modelDisplayName(model)} (OpenCode CLI)`,
    reasoning: false,
    input: ["text"] as const,
    contextWindow: contextWindowFor(model),
    maxTokens: maxTokensFor(model),
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));
}

async function refreshModels() {
  const { models, at, note } = await discoverModels();
  registeredModels = models;
  lastDiscoveryAt = at;
  lastDiscoveryNote = note;
  return providerModels(models);
}

async function createTempAgentDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "opencode-pi-"));
  const agentsDir = join(dir, ".opencode", "agents");
  await mkdir(agentsDir, { recursive: true });
  await writeFile(
    join(agentsDir, `${AGENT_ID}.md`),
    `---
description: Text-only Pi bridge agent. OpenCode tools are denied; Pi tool calls are emitted as text markers.
mode: primary
permission:
  read: deny
  edit: deny
  glob: deny
  grep: deny
  list: deny
  bash: deny
  task: deny
  external_directory: deny
  todowrite: deny
  webfetch: deny
  websearch: deny
  lsp: deny
  skill: deny
  question: deny
  doom_loop: deny
---
You are the OpenCode side of a Pi Coding Agent bridge. OpenCode tools are disabled. Reply in plain text, or emit <pi_tool_call>{"name":"...","arguments":{...}}</pi_tool_call> exactly when the prompt asks you to request a Pi tool.
`,
    "utf8",
  );
  return dir;
}

function streamOpenCode(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: emptyUsage(),
      stopReason: "pending",
      timestamp: Date.now(),
    };

    let tempDir: string | undefined;
    let accumulatedText = "";
    let stderr = "";
    let stdoutRemainder = "";
    let nativeToolUse: string | undefined;
    const prompt = buildPrompt(context);

    try {
      stream.push({ type: "start", partial: output });
      tempDir = await createTempAgentDir();

      const child = spawn(
        opencodeBin(),
        [
          "run",
          "--pure",
          "-m",
          model.id,
          "--agent",
          AGENT_ID,
          "--format",
          "json",
          "--dir",
          tempDir,
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, OPENCODE_DISABLE_UPDATE_CHECK: "1" },
        },
      );

      const abort = () => child.kill("SIGTERM");
      options?.signal?.addEventListener("abort", abort, { once: true });

      child.stdin?.end(prompt);
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");

      const handleLine = (line: string) => {
        if (!line.trim()) return;

        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          stderr = (stderr + `\n${line}`).slice(-STDERR_LIMIT);
          return;
        }

        if (event.type === "text" && typeof event.part?.text === "string") {
          accumulatedText += event.part.text;
          return;
        }

        if (event.type === "step_finish" && event.part?.tokens) {
          const tokens = event.part.tokens;
          output.usage.input = Number(tokens.input ?? 0);
          output.usage.output =
            Number(tokens.output ?? 0) + Number(tokens.reasoning ?? 0);
          output.usage.cacheRead = Number(tokens.cache?.read ?? 0);
          output.usage.cacheWrite = Number(tokens.cache?.write ?? 0);
          output.usage.totalTokens = Number(
            tokens.total ??
              output.usage.input +
                output.usage.output +
                output.usage.cacheRead +
                output.usage.cacheWrite,
          );
          calculateCost(model, output.usage);
          return;
        }

        if (event.type === "tool_use") {
          nativeToolUse = event.part?.tool ? String(event.part.tool) : "unknown";
          return;
        }

        if (event.type === "error") {
          stderr = (stderr + `\n${safeJson(event)}`).slice(-STDERR_LIMIT);
        }
      };

      child.stdout?.on("data", (chunk: string) => {
        stdoutRemainder += chunk;
        const lines = stdoutRemainder.split(/\r?\n/);
        stdoutRemainder = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      });

      child.stderr?.on("data", (chunk: string) => {
        stderr = (stderr + chunk).slice(-STDERR_LIMIT);
      });

      const code = await new Promise<number | null>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", resolve);
      });
      options?.signal?.removeEventListener("abort", abort);

      if (stdoutRemainder.trim()) {
        handleLine(stdoutRemainder);
      }

      if (options?.signal?.aborted) {
        throw new Error("Request was aborted");
      }
      if (code !== 0) {
        throw new Error(stderr.trim() || `opencode exited with code ${code}`);
      }
      if (nativeToolUse) {
        throw new Error(
          `OpenCode attempted to use its own tool (${nativeToolUse}). Use Pi tool-call markers instead.`,
        );
      }

      const toolCalls = parseToolCalls(accumulatedText);
      fillEstimatedUsage(model, output, prompt, accumulatedText);

      if (toolCalls.length > 0) {
        output.stopReason = "toolUse";
        for (const call of toolCalls) {
          const toolCall: ToolCall = {
            type: "toolCall",
            id: `opencode_${randomUUID()}`,
            name: call.name,
            arguments: call.arguments,
          };
          const contentIndex = output.content.length;
          output.content.push(toolCall);
          stream.push({ type: "toolcall_start", contentIndex, partial: output });
          stream.push({
            type: "toolcall_delta",
            contentIndex,
            delta: safeJson(toolCall.arguments),
            partial: output,
          });
          stream.push({
            type: "toolcall_end",
            contentIndex,
            toolCall,
            partial: output,
          });
        }
        stream.push({ type: "done", reason: "toolUse", message: output });
        stream.end();
        return;
      }

      output.stopReason = "stop";
      const contentIndex = output.content.length;
      output.content.push({ type: "text", text: accumulatedText });
      stream.push({ type: "text_start", contentIndex, partial: output });
      if (accumulatedText) {
        stream.push({
          type: "text_delta",
          contentIndex,
          delta: accumulatedText,
          partial: output,
        });
      }
      stream.push({
        type: "text_end",
        contentIndex,
        content: accumulatedText,
        partial: output,
      });
      stream.push({ type: "done", reason: "stop", message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  })();

  return stream;
}

function statusText(): string {
  const lines = [
    `Provider: ${PROVIDER_ID}`,
    `Binary: ${opencodeBin()}`,
    `Registered models: ${registeredModels.length}`,
    `Last refresh: ${lastDiscoveryAt ? new Date(lastDiscoveryAt).toLocaleString() : "never"}`,
  ];

  if (lastDiscoveryNote) {
    lines.push(`Note: ${lastDiscoveryNote}`);
  }

  lines.push("");
  lines.push(...registeredModels.map((model) => `- ${model}`));
  lines.push("");
  lines.push(
    "Overrides: OPENCODE_BIN / OPENCODE_MODELS (compat: OPENCODE_PI_BIN / OPENCODE_PI_MODELS)",
  );
  lines.push(
    `Smoke test: pi -p --provider ${PROVIDER_ID} --model ${registeredModels[0] ?? DEFAULT_MODELS[0]} \"Reply with exactly OK\"`,
  );

  return lines.join("\n");
}

function modelsText(): string {
  if (registeredModels.length === 0) {
    return "No OpenCode models are currently registered.";
  }
  return registeredModels
    .map((model) => `${PROVIDER_ID}/${model}`)
    .join("\n");
}

export default async function opencodeCliExtension(pi: ExtensionAPI) {
  const models = await refreshModels();
  pi.registerProvider(PROVIDER_ID, {
    name: PROVIDER_NAME,
    baseUrl: "cli:opencode",
    apiKey: "opencode-cli-local",
    api: API_ID,
    models,
    refreshModels,
    streamSimple: streamOpenCode,
  });

  pi.registerCommand("opencode", {
    description: "Inspect or refresh the OpenCode CLI bridge",
    handler: async (args, ctx) => {
      const subcommand = String(args ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0]
        ?.toLowerCase() ?? "status";

      if (subcommand === "status") {
        ctx.ui.notify(statusText(), "info");
        return;
      }

      if (subcommand === "models") {
        ctx.ui.notify(modelsText(), "info");
        return;
      }

      if (subcommand === "refresh" || subcommand === "update") {
        await ctx.modelRegistry.refresh();
        ctx.ui.notify(statusText(), "info");
        return;
      }

      if (subcommand === "help") {
        ctx.ui.notify(
          "Usage: /opencode [status|models|refresh|help]\nSelect provider opencode-cli in /model after loading the extension.",
          "info",
        );
        return;
      }

      ctx.ui.notify(
        `Unknown /opencode subcommand: ${subcommand}. Try /opencode help`,
        "warning",
      );
    },
  });

  pi.on("message_end", async (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "error") return;
    if (
      message.provider !== PROVIDER_ID &&
      ctx.model?.provider !== PROVIDER_ID
    ) {
      return;
    }

    const errorMessage = message.errorMessage ?? "";
    if (errorMessage.includes("context_length_exceeded")) return;
    if (!OVERFLOW_PATTERN.test(errorMessage)) return;

    return {
      message: {
        ...message,
        errorMessage: `context_length_exceeded: ${errorMessage}`,
      },
    };
  });
}
