import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { formatSyncReport, syncBundledAgents } = require("../agent-sync.cjs") as {
  formatSyncReport: (result: SyncResult) => string;
  syncBundledAgents: (options: SyncOptions) => SyncResult;
};

type SyncOptions = {
  sourceDir: string;
  targetDir: string;
  apply?: boolean;
};

type SyncResult = {
  added: string[];
  updated: string[];
  unchanged: string[];
  removed: string[];
  pendingUpdate: string[];
  pendingRemove: string[];
  errors: Array<{ file?: string; op: string; message: string }>;
};

type UI = { notify: (message: string, severity: "info" | "warning" | "error") => void };

const extensionDir = dirname(fileURLToPath(import.meta.url));
const bundledAgentsDir = join(extensionDir, "..", "agents");

function targetAgentsDir(): string {
  return join(getAgentDir(), "agents");
}

function runSync(apply: boolean): SyncResult {
  return syncBundledAgents({
    sourceDir: bundledAgentsDir,
    targetDir: targetAgentsDir(),
    apply,
  });
}

function notifyStartup(ui: UI, result: SyncResult): void {
  if (result.added.length > 0) {
    ui.notify(`Copied ${result.added.length} kirin agent(s) to ~/.pi/agent/agents/`, "info");
  }

  const healed: string[] = [];
  if (result.updated.length > 0) healed.push(`${result.updated.length} updated`);
  if (result.removed.length > 0) healed.push(`${result.removed.length} removed`);
  if (healed.length > 0) {
    ui.notify(`Synced kirin bundled agent(s): ${healed.join(", ")}.`, "info");
  }

  const drift: string[] = [];
  if (result.pendingUpdate.length > 0) drift.push(`${result.pendingUpdate.length} outdated or user-edited`);
  if (result.pendingRemove.length > 0) drift.push(`${result.pendingRemove.length} stale but user-edited`);
  if (drift.length > 0) {
    ui.notify(`Kirin bundled agents need attention: ${drift.join(", ")}. Run /kirin-update-agents to force sync.`, "warning");
  }

  if (result.errors.length > 0) {
    ui.notify(`Kirin agent sync reported ${result.errors.length} error(s). Run /kirin-update-agents for details.`, "warning");
  }
}

export default function (pi: ExtensionAPI) {
  let startupSyncDone = false;

  pi.on("session_start", async (_event, ctx) => {
    if (startupSyncDone) return;
    startupSyncDone = true;

    const result = runSync(false);
    if (ctx.hasUI) notifyStartup(ctx.ui, result);
  });

  pi.registerCommand("kirin-update-agents", {
    description:
      "Sync kirin-pi bundled agents into ~/.pi/agent/agents/: add new, update changed, and remove stale managed files.",
    handler: async (_args, ctx) => {
      const result = runSync(true);
      if (!ctx.hasUI) return;
      const severity = result.errors.length > 0 ? "warning" : "info";
      ctx.ui.notify(formatSyncReport(result), severity);
    },
  });
}
