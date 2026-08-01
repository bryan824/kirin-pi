import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  limitMessages,
  parseChatGptExportHtml,
  renderMarkdown,
} from "../chatgpt-export.ts";

const HTML = `<!doctype html>
<title>Saved &amp; useful</title>
<!-- url: https://chatgpt.com/c/example -->
<!-- saved date: 2026-08-01 -->
<article data-message-author-role="user" data-message-id="u1">
  <div class="whitespace-pre-wrap">Hello &amp; goodbye</div>
</article>
<article data-message-author-role="assistant" data-message-id="a1" data-message-model-slug="gpt-test">
  <div class="markdown prose"><p><strong>Answer</strong></p><pre><code>const x = 1;</code></pre></div>
</article>`;

test("shared parser preserves ChatGPT metadata and Markdown", () => {
  const parsed = parseChatGptExportHtml(HTML, "/tmp/chat.html");
  expect(parsed.title).toBe("Saved & useful");
  expect(parsed.sourceUrl).toBe("https://chatgpt.com/c/example");
  expect(parsed.savedDate).toBe("2026-08-01");
  expect(parsed.messages).toEqual([
    { role: "user", id: "u1", model: undefined, text: "Hello & goodbye" },
    { role: "assistant", id: "a1", model: "gpt-test", text: "**Answer**\n\n\n```\nconst x = 1;\n```" },
  ]);
  expect(renderMarkdown(parsed)).toContain("## 2. Assistant (gpt-test)");
  expect(limitMessages(parsed, 1).messages).toEqual([parsed.messages[1]]);
});

test("CLI emits JSON and writes explicit output", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kirin-chatgpt-export-"));
  const input = path.join(dir, "chat.html");
  const output = path.join(dir, "chat.json");
  writeFileSync(input, HTML);

  const result = Bun.spawnSync([
    "bun", path.resolve(import.meta.dir, "..", "chatgpt-export.ts"), input,
    "--format", "json", "--max-messages", "1", "--output", output,
  ], { stderr: "pipe", stdout: "pipe" });

  expect(result.exitCode, result.stderr.toString()).toBe(0);
  expect(result.stdout.toString()).toContain(`Saved ${output}`);
  const parsed = JSON.parse(readFileSync(output, "utf8"));
  expect(parsed.messages).toHaveLength(1);
  expect(parsed.messages[0].role).toBe("assistant");
});
