---
name: chatgpt-export
description: "When the user provides a saved ChatGPT or SingleFile HTML export and wants its conversation recovered as Markdown or JSON."
---

# ChatGPT export

Ask for the local HTML path when it was not supplied; never guess a private file location.

In Pi, prefer the `parse_chatgpt_export` tool. In Claude Code, run the installed native equivalent:

```bash
bun "$HOME/.claude/kirin/chatgpt-export.ts" <html-path> [--format markdown|json] [--max-messages N] [--output path]
```

Default to Markdown and the latest 100 messages. Use JSON only when message metadata matters, and `--output` only when the user requested a file or the result is too large for chat.
