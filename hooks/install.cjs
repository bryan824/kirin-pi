#!/usr/bin/env bun
// Wire kirin-pi's prek hooks. Idempotent; `--ensure` never installs tools.
//
//   bun hooks/install.cjs            verbose: ensure prek, then `prek install`
//   bun hooks/install.cjs --ensure   quiet auto-heal (SessionStart): no surprise installs
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ensure = process.argv.includes("--ensure");
const log = ensure ? () => {} : (m) => console.log(m);
const root = process.cwd();

function has(cmd) {
  return spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;
}
function wired() {
  const f = path.join(root, ".git", "hooks", "pre-commit");
  return fs.existsSync(f) && fs.readFileSync(f, "utf8").includes("prek");
}

if (!fs.existsSync(path.join(root, ".git"))) {
  if (!ensure) console.error("Not a git repository.");
  process.exit(ensure ? 0 : 1);
}
const hasConfig =
  fs.existsSync(path.join(root, "prek.toml")) ||
  fs.existsSync(path.join(root, ".pre-commit-config.yaml"));
if (!hasConfig) {
  if (!ensure) console.error("No prek.toml in this repo — nothing to wire.");
  process.exit(ensure ? 0 : 1);
}
if (wired()) {
  log("git hooks already wired (prek).");
  process.exit(0);
}

if (!has("prek")) {
  if (ensure) {
    console.error("kirin: git hooks not wired — run `bun run hooks:install` to install prek and wire them.");
    process.exit(0); // never block a session
  }
  log("Installing prek via uv…");
  if (spawnSync("uv", ["tool", "install", "prek"], { stdio: "inherit" }).status !== 0) {
    console.error("Could not install prek automatically. Install `prek` and rerun.");
    process.exit(1);
  }
}

const r = spawnSync("prek", ["install"], { stdio: ensure ? "ignore" : "inherit" });
if (r.status !== 0) {
  if (!ensure) console.error("`prek install` failed.");
  process.exit(ensure ? 0 : 1);
}
log("Wired git hooks with prek.");
