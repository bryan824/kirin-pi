const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const { getBlockedGitMessage, getBlockedPythonToolMessage } = require(path.join(root, "guard-policy.cjs"));

test("guard blocks broad staging and hook bypass", () => {
  for (const cmd of [
    "git add -A",
    "git add .",
    "git add --all",
    "git add -A -- .",
    "cd sub && git add -A",
    "git commit --no-verify -m x",
    "git commit -n -m x",
  ]) assert.ok(getBlockedGitMessage(cmd), `should block: ${cmd}`);
});

test("guard allows exact staging and ordinary Git reads", () => {
  for (const cmd of [
    "git add src/lib.rs",
    "git add -p",
    "git add foo bar",
    "git commit -m 'fix: thing'",
    "git status",
    "git diff --cached",
  ]) assert.equal(getBlockedGitMessage(cmd), null, `should allow: ${cmd}`);
});

test("Git policy recognizes options and pathspecs, not strings inside operands", () => {
  for (const cmd of [
    'git -C repo add -A', 'git --work-tree=repo stage --all',
    'git add "."', "git add './'", 'git add -u', 'git add --update',
    'git add -vu', 'git add -Av src/file.ts',
    'env -u GIT_DIR git -C repo add .', '/usr/bin/git add -A',
    'X=1 command -- git add -A', 'exec -a wrapper git add .',
    'git -C repo commit --no-verify -m x', 'git commit -am x -n',
    'git -c core.hooksPath=/dev/null commit -m x',
    'git -ccore.hooksPath=/dev/null commit -m x',
    'git --config-env=core.hooksPath=HOOKS commit -m x',
    'git -c hook.hk-pre-commit.enabled=false commit -m x',
    'git -chook.hk-pre-commit.command=true commit -m x',
    'git --config-env=hook.hk-pre-commit.event=EVENT commit -m x',
    'HK=0 git commit -m x', 'env HK=0 git commit -m x',
    'HK_SKIP_STEPS=kirin-integrity git commit -m x',
  ]) assert.ok(getBlockedGitMessage(cmd), `should block: ${cmd}`);

  for (const cmd of [
    'git commit -m "document --no-verify behavior"',
    'git commit --message "use -n for something else"',
    'git commit -m"mention -n"', 'git commit -m --no-verify',
    'git commit --author "A -n B" -m x', 'git commit -- --no-verify',
    'git add "notes . txt"', 'git add notes\\ .\\ txt',
    'git add -- -A', 'git add -u src/file.ts',
    'git -C "repo . name" add src/file.ts',
    'git -c core.hooksPath=/dev/null status', 'command -v git',
    'git -c hook.hk-pre-commit.enabled=false status',
    'git commit -m "HK=0 is a hook bypass"', 'HK=1 git commit -m x',
    'HK_SKIP_STEPS= git commit -m x', 'HK=0 git status',
    'env -u HK=0 git commit -m x', 'exec -a HK=0 git commit -m x',
    'command -v git add -A',
    'echo "git add -A"',
  ]) assert.equal(getBlockedGitMessage(cmd), null, `should allow: ${cmd}`);
});

test("wrapper operands matching the executable do not change its command position", () => {
  for (const prefix of ["env -u git", "env -C git", "exec -a git", "command env -u git exec -a git"]) {
    assert.ok(getBlockedGitMessage(`${prefix} git add -A`), prefix);
    assert.ok(getBlockedGitMessage(`${prefix} git commit --no-verify -m x`), prefix);
    assert.equal(getBlockedGitMessage(`${prefix} git add src/file.ts`), null, prefix);
    assert.equal(getBlockedGitMessage(`${prefix} git commit -m 'mention --no-verify'`), null, prefix);
  }
  assert.ok(getBlockedPythonToolMessage("exec -a python python script.py"));
  assert.equal(getBlockedPythonToolMessage("env -u python uv run python script.py"), null);
});

test("Claude Bash hook invokes the shared policy without executing the command", () => {
  for (const [command, status] of [
    ['git -C repo add -A', 2],
    ['env -u git git add -A', 2],
    ['git commit -m "document --no-verify behavior"', 0],
  ]) {
    const result = spawnSync("bun", [path.join(root, "hooks/claude-guard.cjs")], {
      input: JSON.stringify({ tool_input: { command } }), encoding: "utf8",
    });
    assert.equal(result.status, status, result.stderr);
    if (status) assert.match(result.stderr, /Blocked/);
  }
});

test("guard requires uv for Python tooling", () => {
  for (const cmd of [
    "python3 -c 'print(1)'",
    "python -m pip install requests",
    "pip install requests",
    "poetry install",
  ]) assert.ok(getBlockedPythonToolMessage(cmd), `should block: ${cmd}`);

  for (const cmd of [
    "uv run script.py",
    "uv run python -c 'print(1)'",
    "uvx ruff check .",
    "./scripts/build.sh",
  ]) assert.equal(getBlockedPythonToolMessage(cmd), null, `should allow: ${cmd}`);
});

test("a separator inside quotes is an argument, not a command boundary", () => {
  // Splitting the raw string made `grep -E "uv|python"` look like a pipeline
  // ending in a bare `python`, so searching for the policy tripped the policy.
  for (const cmd of [
    'grep -E "uv|python" AGENTS.md',
    "grep -E 'pip|poetry' notes.md",
    'rg "python -m venv" docs/',
    'echo "run python; then pip install"',
    "git commit -m 'stop using pip'",
  ]) assert.equal(getBlockedPythonToolMessage(cmd), null, `should allow: ${cmd}`);
});

test("real separators still split, quoted or not", () => {
  for (const cmd of [
    "ls | python3 -",
    "ls; python3 x.py",
    "cd /tmp && pip install x",
    "false || python x.py",
    "ls;python3 x.py",
    'echo "safe" && python3 x.py',
  ]) assert.ok(getBlockedPythonToolMessage(cmd), `should block: ${cmd}`);
});

test("an escaped separator is not a boundary", () => {
  assert.equal(getBlockedPythonToolMessage("echo a\\; python is fine"), null);
});

function snapshot(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return [[file, "directory"], ...snapshot(file)];
    return [[file, fs.lstatSync(file).mode, entry.isSymbolicLink() ? fs.readlinkSync(file) : fs.readFileSync(file).toString("hex")]];
  });
}

const HK_COMMAND = 'test "${HK:-1}" = "0" || hk run pre-commit --from-hook';
const HK_BODY = '#!/bin/sh\ntest "${HK:-1}" = "0" || exec hk run pre-commit --from-hook "$@"\n';
const configHooks = spawnSync("git", ["hook", "-h"], { encoding: "utf8" }).stdout.includes("hook list");

function hookFixture(layout, mode = "legacy") {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "kirin-hooks-"));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  Object.assign(env, { HOME: base, XDG_CONFIG_HOME: base, GIT_CONFIG_GLOBAL: path.join(base, "no-global"), GIT_CONFIG_NOSYSTEM: "1", PATH: `${base}/bin${path.delimiter}${process.env.PATH}` });
  const repo = path.join(base, "repo");
  const git = (cwd, ...args) => {
    const result = spawnSync("git", ["-C", cwd, ...args], { env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  fs.mkdirSync(repo);
  git(repo, "init", "-q", "--template=", ...(layout === "gitfile" ? ["--separate-git-dir", path.join(base, "metadata")] : []));
  let project = repo;
  if (layout === "worktree") {
    project = path.join(base, "linked");
    git(repo, "worktree", "add", "--orphan", "-q", project);
  }
  if (layout === "custom") git(project, "config", "core.hooksPath", ".hooks");
  const hook = git(project, "rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit");
  fs.writeFileSync(path.join(project, "hk.pkl"), "// fixture only; native config is checked separately\n");
  const cwd = path.join(project, "src"); fs.mkdirSync(cwd);
  fs.mkdirSync(path.join(base, "bin"));
  const binary = path.join(base, "bin/hk");
  const body = HK_BODY;
  const install = mode === "config"
    ? `const {execFileSync}=require('node:child_process');for(const [key,value] of [['command',${JSON.stringify(HK_COMMAND)}],['event','pre-commit']])execFileSync('git',['config','--local','hook.hk-pre-commit.'+key,value]);`
    : `fs.mkdirSync(path.dirname(${JSON.stringify(hook)}),{recursive:true});fs.writeFileSync(${JSON.stringify(hook)},${JSON.stringify(body)},{mode:0o755});`;
  fs.writeFileSync(binary, `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');\nfs.appendFileSync(${JSON.stringify(path.join(base, "calls"))}, process.argv.slice(2).join(' ')+'\\n');\nif(process.argv[2]==='install'){${install}}\n`);
  fs.chmodSync(binary, 0o755);
  const run = (...args) => spawnSync(process.execPath, [path.join(root, "hooks/install.cjs"), ...args], { cwd, env, encoding: "utf8" });
  return { base, project, git, hook, body, binary, env, run };
}

for (const mode of ["legacy", "config"]) test(`hook assurance is read-only across Git layouts (${mode})`, { skip: mode === "config" && !configHooks }, () => {
  for (const layout of ["plain", "gitfile", "worktree", "custom"]) {
    const fixture = hookFixture(layout, mode);
    try {
      const before = snapshot(fixture.base);
      const check = fixture.run("--ensure");
      assert.equal(check.status, 0, check.stderr);
      assert.match(check.stderr, /not wired|not installed/);
      assert.deepEqual(snapshot(fixture.base), before, layout);
      const installed = fixture.run();
      assert.equal(installed.status, 0, installed.stderr);
      if (mode === "legacy") assert.equal(fs.readFileSync(fixture.hook, "utf8"), fixture.body);
      else assert.equal(fixture.git(fixture.project, "config", "--get", "hook.hk-pre-commit.command"), HK_COMMAND);
      const after = snapshot(fixture.base);
      assert.equal(fixture.run("--ensure").stderr, "");
      assert.equal(fixture.run().status, 0);
      assert.deepEqual(snapshot(fixture.base), after, layout);
    } finally { fs.rmSync(fixture.base, { recursive: true, force: true }); }
  }
});

test("hook detection rejects comments, disabled wiring and non-executable files without replacing them", () => {
  for (const kind of ["comment", "disabled", "mode", "crlf"]) {
    const fixture = hookFixture("plain");
    try {
      fs.mkdirSync(path.dirname(fixture.hook), { recursive: true });
      const text = kind === "comment" ? '#!/bin/sh\n# test "${HK:-1}" = "0" || hk run pre-commit\nexit 0\n'
        : kind === "disabled" ? fixture.body.replace('test "${HK:-1}"', 'exit 0\ntest "${HK:-1}"')
          : kind === "crlf" ? fixture.body.replace(/\n/g, "\r\n") : fixture.body;
      fs.writeFileSync(fixture.hook, text, { mode: kind === "mode" ? 0o644 : 0o755 });
      const before = snapshot(fixture.base);
      assert.match(fixture.run("--ensure").stderr, /not wired|unverified|not executable/);
      assert.equal(fixture.run().status, 1);
      assert.deepEqual(snapshot(fixture.base), before, kind);
    } finally { fs.rmSync(fixture.base, { recursive: true, force: true }); }
  }
});

test("native config hooks must be enabled and exact; custom entries are preserved", { skip: !configHooks }, () => {
  for (const kind of ["disabled", "command", "event", "other-hook"]) {
    const f = hookFixture("plain", "config");
    try {
      f.git(f.project, "config", "hook.hk-pre-commit.command", HK_COMMAND);
      f.git(f.project, "config", "hook.hk-pre-commit.event", "pre-commit");
      if (kind === "disabled") f.git(f.project, "config", "hook.hk-pre-commit.enabled", "false");
      if (kind === "command") f.git(f.project, "config", "hook.hk-pre-commit.command", "echo custom");
      if (kind === "event") f.git(f.project, "config", "hook.hk-pre-commit.event", "pre-push");
      if (kind === "other-hook") {
        f.git(f.project, "config", "--remove-section", "hook.hk-pre-commit");
        f.git(f.project, "config", "hook.hk-custom.command", "echo mine");
      }
      const before = snapshot(f.base);
      assert.match(f.run("--ensure").stderr, /unverified|not wired/);
      assert.equal(f.run().status, 1);
      assert.deepEqual(snapshot(f.base), before, kind);
    } finally { fs.rmSync(f.base, { recursive: true, force: true }); }
  }
});

test("installation preserves sibling hooks, including hk-like comments in samples", () => {
  for (const name of ["commit-msg", "pre-push.sample"]) {
    const f = hookFixture("plain");
    try {
      fs.mkdirSync(path.dirname(f.hook), { recursive: true });
      fs.writeFileSync(path.join(path.dirname(f.hook), name), '#!/bin/sh\n# test "${HK:-1}" = "0" || hk run pre-push\necho user-hook\n', { mode: 0o755 });
      const before = snapshot(f.base);
      assert.equal(f.run().status, 1);
      assert.deepEqual(snapshot(f.base), before, name);
    } finally { fs.rmSync(f.base, { recursive: true, force: true }); }
  }
});

test("hook installer requires an existing tool and never installs one", () => {
  const f = hookFixture("plain");
  try {
    fs.unlinkSync(f.binary);
    f.env.PATH = "/usr/bin:/bin";
    const before = snapshot(f.base);
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /hk.*(?:not available|not found|PATH)/);
    assert.deepEqual(snapshot(f.base), before);
  } finally { fs.rmSync(f.base, { recursive: true, force: true }); }
});

test("hook installation preserves a Git config symlink to an outside file", () => {
  const f = hookFixture("plain", "config");
  try {
    const config = f.git(f.project, "rev-parse", "--path-format=absolute", "--git-path", "config");
    const outside = path.join(f.base, "user-config");
    fs.renameSync(config, outside);
    fs.symlinkSync(outside, config);
    const before = snapshot(f.base);
    assert.equal(f.run().status, 1);
    assert.deepEqual(snapshot(f.base), before);
  } finally { fs.rmSync(f.base, { recursive: true, force: true }); }
});

test("repository integrity hook checks without fixing, staging or stashing", () => {
  const config = fs.readFileSync(path.join(root, "hk.pkl"), "utf8");
  assert.match(config, /fix = false/);
  assert.match(config, /stage = false/);
  assert.match(config, /stash = "none"/);
  assert.match(config, /argv = List\("bun", "run", "test"\)/);
  assert.doesNotMatch(config, /glob\s*=/);
  assert.equal(fs.existsSync(path.join(root, "prek.toml")), false);
});

test("hook installation does not modify an external shared hooksPath", () => {
  const fixture = hookFixture("plain");
  try {
    const outside = path.join(fixture.base, "shared-hooks"); fs.mkdirSync(outside);
    fixture.git(fixture.project, "config", "core.hooksPath", outside);
    const before = snapshot(fixture.base);
    const result = fixture.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /outside|shared/);
    assert.deepEqual(snapshot(fixture.base), before);
  } finally { fs.rmSync(fixture.base, { recursive: true, force: true }); }
});
