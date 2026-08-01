#!/usr/bin/env bun
// Claude Code PreToolUse(Bash) hook. Reads the tool-call JSON on stdin;
// exit 2 blocks the call and feeds stderr to Claude.
const { getBlockedCommandMessage } = require("../guard-policy.cjs");

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (buf += c));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = (JSON.parse(buf).tool_input || {}).command || "";
  } catch {
    /* not JSON / no command — allow */
  }
  const msg = getBlockedCommandMessage(command);
  if (msg) {
    process.stderr.write(msg + "\n");
    process.exit(2);
  }
  process.exit(0);
});
