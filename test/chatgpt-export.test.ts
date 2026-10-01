import { expect, test } from "bun:test";
import { linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  limitMessages,
  parseChatGptExportHtml,
  renderMarkdown,
  renderExport,
  runCli,
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

test("code survives prose cleanup, entity decoding and Markdown fencing", () => {
  const code = 'if flag:\n    print("a  b")\n\n\n\nconst html = "<section>&lt;keep&gt;</section>";\n// data-message-author-role="user" is code, not another message\n// ``` and a nonbreaking\u00a0space  \n';
  const encoded = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<article data-note=" data-message-author-role='fake'" data-message-id="before-role" data-message-author-role="assistant"><div class="markdown prose"><p>Before</p><pre><code>${encoded}</code></pre><p>After <code>&lt;b&gt;a  b&lt;/b&gt;</code></p><pre>    plain pre\n</pre></div></article>`;
  const parsed = parseChatGptExportHtml(html, "/fixture");
  expect(parsed.messageCount).toBe(1);
  expect(parsed.messages[0].id).toBe("before-role");
  expect(parsed.messages[0].text).toContain(`\`\`\`\`\n${code}\`\`\`\``);
  expect(parsed.messages[0].text).toContain("`<b>a  b</b>`");
  expect(parsed.messages[0].text).toContain("```\n    plain pre\n```");
  for (const [content, expected] of [["<code>   </code>", "`   `"], ["<code>`</code>", "`` ` ``"], ["A<code></code>B", "AB"]]) {
    expect(parseChatGptExportHtml(`<article data-message-author-role="user">${content}</article>`, "/fixture").messages[0].text).toBe(expected);
  }
  expect(JSON.parse(renderExport(parsed, "json")).messages[0].text).toBe(parsed.messages[0].text);
  expect(parseChatGptExportHtml('<article data-message-author-role="user">&#99999999;</article>', "/fixture").messages[0].text).toBe("&#99999999;");
});

test("CLI rejects every input alias before overwriting data", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kirin-export-alias-"));
  try {
    const input = path.join(dir, "chat.html");
    writeFileSync(input, HTML);
    symlinkSync(input, path.join(dir, "link.html"));
    linkSync(input, path.join(dir, "hard.html"));
    symlinkSync(dir, path.join(dir, "via-dir"));
    for (const output of [input, path.join(dir, "link.html"), path.join(dir, "hard.html"), path.join(dir, "via-dir/chat.html")]) {
      await expect(runCli([input, "--output", output], dir)).rejects.toThrow(/input/);
      expect(readFileSync(input, "utf8")).toBe(HTML);
      expect(readFileSync(output, "utf8")).toBe(HTML);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI emits JSON and writes explicit output", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kirin-chatgpt-export-"));
  const input = path.join(dir, "chat.html");
  const output = path.join(dir, "chat.json");
  writeFileSync(input, HTML);
  writeFileSync(output, "stale output".repeat(1_000));

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
