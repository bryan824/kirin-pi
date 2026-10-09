import {
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getBlockedCommandMessage } = require("../guard-policy.cjs") as {
  getBlockedCommandMessage: (command: string) => string | null;
};

export default function guardrails(pi: ExtensionAPI) {
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
