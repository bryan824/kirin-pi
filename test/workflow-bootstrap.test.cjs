const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "harness", "bootstrap.cjs");
const { END, START } = require("../harness/bootstrap.cjs");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kirin-bootstrap-"));
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
}

test("bootstrap prints help without mutating when invoked without arguments", () => {
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /kirin-pi bootstrap workflow/);
});

test("bootstrap installs the approved lifecycle idempotently", () => {
  const repo = tmpDir();
  const args = ["bootstrap", "workflow", "--project", "--root", repo, "--agents", "all"];
  assert.equal(run(args).status, 0);

  for (const rel of ["AGENTS.md", "CLAUDE.md"]) {
    const file = path.join(repo, rel);
    const once = fs.readFileSync(file, "utf8");
    assert.match(once, /small: design -> implement -> verify -> commit/);
    assert.match(once, /large: design \| decision-map -> plan -> implement -> verify -> commit/);
    assert.match(once, /bug:\s+debug -> verify -> commit/);
    assert.doesNotMatch(once, /workflow-gate|to-spec|to-tickets|wayfinder/);
    assert.equal(run(args).status, 0);
    assert.equal(fs.readFileSync(file, "utf8"), once);
  }
});

test("bootstrap replaces only its marked block", () => {
  const repo = tmpDir();
  const file = path.join(repo, "AGENTS.md");
  fs.writeFileSync(file, `# Existing\n\n${START}\nold\n${END}\n\nKeep me.\n`, "utf8");

  const result = run(["bootstrap", "workflow", "--project", "--root", repo, "--agents", "pi"]);
  assert.equal(result.status, 0, result.stderr);
  const body = fs.readFileSync(file, "utf8");
  assert.match(body, /^# Existing/);
  assert.match(body, /Keep me\./);
  assert.doesNotMatch(body, /\nold\n/);
  assert.equal((body.match(new RegExp(START, "g")) ?? []).length, 1);
});

test("bootstrap supports global paths without touching the real home", () => {
  const home = tmpDir();
  const result = run(["bootstrap", "workflow", "--global", "--home", home, "--agents", "all"]);
  assert.equal(result.status, 0, result.stderr);
  for (const rel of [".claude/CLAUDE.md", ".pi/agent/AGENTS.md", ".config/opencode/AGENTS.md"]) {
    assert.equal(fs.existsSync(path.join(home, rel)), true, rel);
  }
});
