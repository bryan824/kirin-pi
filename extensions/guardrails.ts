import {
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { getBlockedCommandMessage } = require("../guard-policy.cjs") as {
  getBlockedCommandMessage: (command: string) => string | null;
};
const installer = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "install.cjs");

export default function guardrails(pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx) => {
    if (event.reason === "reload") return;
    const warn = (message: string) => ctx.hasUI ? ctx.ui.notify(message, "warning") : console.error(message);
    try {
      const result = await pi.exec("bun", [installer, "--ensure"], { cwd: ctx.cwd, timeout: 5_000 });
      const message = result.stderr.trim() || (result.code !== 0 ? `kirin: hook check failed (${result.code}).` : "");
      if (message) warn(message);
    } catch (error) {
      warn(`kirin: hook check unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("bash", event)) return;
    const reason = getBlockedCommandMessage(event.input.command);
    if (reason) return { block: true, reason };
  });

  pi.on("user_bash", (event) => {
    const reason = getBlockedCommandMessage(event.command);
    if (!reason) return;
    return {
      result: {
        output: reason,
        exitCode: 1,
        cancelled: false,
        truncated: false,
      },
    };
  });
}
