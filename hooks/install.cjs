#!/usr/bin/env bun
// Explicit installation; --ensure is a read-only, non-blocking startup check.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

function git(cwd, args, missing = false) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 3_000, env: { ...process.env, LC_ALL: "C" } });
  if (!result.error && missing && result.status === 1) return "";
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.trim() || "Git query failed.");
  return result.stdout.replace(/\r?\n$/, "");
}

function entry(file) {
  try { return fs.lstatSync(file); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}

function executable(command, cwd) {
  const candidates = path.isAbsolute(command) || command.includes(path.sep)
    ? [path.resolve(cwd, command)] : (process.env.PATH ?? "").split(path.delimiter).map((dir) => path.resolve(cwd, dir, command));
  return candidates.some((file) => {
    try { fs.accessSync(file, fs.constants.X_OK); return fs.statSync(file).isFile(); }
    catch { return false; }
  });
}

// Recognize direct native hk wiring without running hk or evaluating project config.
// Other launchers need owner review; presence is not proof the configured checks pass.
const HK_COMMAND = 'test "${HK:-1}" = "0" || hk run pre-commit --from-hook';
const HK_BODY = '#!/bin/sh\ntest "${HK:-1}" = "0" || exec hk run pre-commit --from-hook "$@"\n';

function wired(file, cwd) {
  if (!executable("hk", cwd)) return false;
  if (entry(file)) {
    return executable(file, cwd) && fs.readFileSync(file, "utf8") === HK_BODY;
  }
  const command = git(cwd, ["config", "--get-all", "hook.hk-pre-commit.command"], true);
  return command === HK_COMMAND && git(cwd, ["hook", "list", "-z", "pre-commit"], true).split("\0").includes("hk-pre-commit");
}

function futurePath(file) {
  try { return fs.realpathSync(file); }
  catch (error) {
    if (error.code !== "ENOENT" || entry(file)) throw error;
    return path.join(futurePath(path.dirname(file)), path.basename(file));
  }
}

function main() {
  let ensure = false;
  try {
    const { values } = parseArgs({ options: { ensure: { type: "boolean" }, help: { type: "boolean", short: "h" } } });
    if (values.help) { console.log("Usage: bun hooks/install.cjs [--ensure]\n--ensure reports only; no arguments wires the installed hk tool locally."); return 0; }
    ensure = Boolean(values.ensure);
    let root;
    try { root = git(process.cwd(), ["rev-parse", "--show-toplevel"]); }
    catch (error) { if (ensure && /not a git repository|must be run in a work tree/.test(error.message)) return 0; throw error; }
    if (!["hk.pkl", "hk.local.pkl", ".config/hk.pkl", ".config/hk.local.pkl"].some((name) => fs.existsSync(path.join(root, name)))) {
      if (ensure) return 0;
      throw new Error("No hk.pkl at the Git root — nothing to wire.");
    }
    const hook = git(root, ["rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit"]);
    if (wired(hook, root)) { if (!ensure) console.log("Recognized native hk pre-commit wiring."); return 0; }
    if (ensure) {
      console.error(`kirin: git hooks not wired or unverified at ${hook}. Review existing hooks; run \`bun run hooks:install\` explicitly to install missing hooks.`);
      return 0;
    }
    if (entry(hook)) throw new Error(`Existing pre-commit hook is unverified or not executable; preserved at ${hook}. Review it manually before installation.`);
    // Native installation removes prior hk entries and shims before writing new ones.
    // Do not let that cleanup take ownership of custom/disabled configuration or siblings.
    if (git(root, ["config", "--name-only", "--get-regexp", "^hook\\.hk-"], true)) {
      throw new Error("Existing hk Git configuration is unverified; preserved for owner review.");
    }
    const directory = path.dirname(hook);
    for (const name of entry(directory) ? fs.readdirSync(directory) : []) {
      const file = path.join(directory, name);
      if (!name.endsWith(".sample") || !entry(file).isFile() || fs.readFileSync(file, "utf8").includes("hk run")) {
        throw new Error(`Existing hook preserved at ${file}; review it before installation.`);
      }
    }
    const common = git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const config = git(root, ["rev-parse", "--path-format=absolute", "--git-path", "config"]);
    const owners = [root, common].map((dir) => fs.realpathSync(dir));
    for (const target of [directory, config]) {
      const destination = futurePath(target);
      if (!owners.some((dir) => destination === dir || destination.startsWith(dir + path.sep))) {
        throw new Error(`Refusing to modify an outside/shared hooksPath or Git config: ${target}. Configure it with its owner.`);
      }
    }
    if (!executable("hk", root)) throw new Error("hk is not available on PATH. Install it with your tool manager, then rerun; Kirin does not install tools.");
    const result = spawnSync("hk", ["install"], { cwd: root, stdio: "inherit", env: { ...process.env, HK_MISE: "0" } });
    if (result.error || result.status !== 0) throw new Error(result.error?.message || "hk install failed.");
    if (!wired(hook, root)) throw new Error("hk returned without recognized pre-commit wiring; review the result.");
    console.log("Wired native hk pre-commit hooks.");
    return 0;
  } catch (error) {
    console.error(`kirin: ${error.message}`);
    return ensure ? 0 : 1;
  }
}

if (require.main === module) process.exitCode = main();
