const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "skills", "maintenance", "project-memory", "scripts", "project-memory.cjs");

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kirin-memory-"));
}

function run(command, repo) {
  return spawnSync(process.execPath, [script, command, "--root", repo], {
    cwd: root,
    encoding: "utf8",
  });
}

test("check reports an absent substrate without creating records", () => {
  const repo = tmpRepo();
  const result = run("check", repo);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /state: absent/);
  assert.equal(fs.existsSync(path.join(repo, "context")), false);
  assert.equal(fs.existsSync(path.join(repo, "docs")), false);
});

test("init creates only current docs and root-anchored ignores", () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, "docs", "adr"), { recursive: true });

  const result = run("init", repo);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(repo, "docs", "memory.md")), true);
  assert.equal(fs.existsSync(path.join(repo, "docs", "verification.md")), true);
  assert.equal(fs.existsSync(path.join(repo, "context")), false);

  const memory = fs.readFileSync(path.join(repo, "docs", "memory.md"), "utf8");
  assert.match(memory, /Detected roots at adoption/);
  assert.match(memory, /`docs\/adr`/);

  const ignore = fs.readFileSync(path.join(repo, ".gitignore"), "utf8");
  assert.match(ignore, /^\/context\/$/m);
  assert.match(ignore, /^\/\.design\/$/m);
  assert.doesNotMatch(ignore, /workflows/);
});

test("init is idempotent and check enforces both required docs", () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n", "utf8");
  assert.equal(run("init", repo).status, 0);
  const once = fs.readFileSync(path.join(repo, ".gitignore"), "utf8");
  assert.equal(run("init", repo).status, 0);
  assert.equal(fs.readFileSync(path.join(repo, ".gitignore"), "utf8"), once);

  fs.unlinkSync(path.join(repo, "docs", "verification.md"));
  const check = run("check", repo);
  assert.equal(check.status, 1);
  assert.match(check.stdout, /Missing: docs\/verification\.md/);
});
