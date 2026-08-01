const assert = require("node:assert/strict");
const path = require("node:path");
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
