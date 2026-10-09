const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
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

test("repository integrity hook checks without fixing, staging or stashing", () => {
  const config = fs.readFileSync(path.join(root, "hk.pkl"), "utf8");
  assert.match(config, /fix = false/);
  assert.match(config, /stage = false/);
  assert.match(config, /stash = "none"/);
  assert.match(config, /argv = List\("bun", "run", "test"\)/);
  assert.doesNotMatch(config, /glob\s*=/);
  assert.equal(fs.existsSync(path.join(root, "prek.toml")), false);
});
