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

function gitEnv(repo) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  return { ...env, HOME: repo, XDG_CONFIG_HOME: repo, GIT_CONFIG_GLOBAL: path.join(repo, "no-global-config"), GIT_CONFIG_NOSYSTEM: "1" };
}

function run(command, repo) {
  return spawnSync(process.execPath, [script, command, "--root", repo], {
    cwd: root,
    encoding: "utf8",
    env: gitEnv(repo),
  });
}

function git(repo, ...args) {
  return spawnSync("git", ["-C", repo, ...args], { encoding: "utf8",
    env: gitEnv(repo) });
}

test("effective Git ignores, not the marker, determine private-record protection", () => {
  const repo = tmpRepo();
  try {
    assert.equal(git(repo, "init", "-q", "--template=").status, 0);
    assert.equal(run("init", repo).status, 0);
    fs.writeFileSync(path.join(repo, ".gitignore"), "# kirin working records\n/context/\n!/context/\n");
    const before = fs.readFileSync(path.join(repo, ".gitignore"), "utf8");
    const check = run("check", repo);
    assert.equal(check.status, 1);
    assert.match(check.stdout, /ignore/i);
    assert.equal(fs.readFileSync(path.join(repo, ".gitignore"), "utf8"), before);
    assert.equal(run("init", repo).status, 0);
    assert.equal(git(repo, "check-ignore", "--quiet", "context/private.md").status, 0);
    const fixed = fs.readFileSync(path.join(repo, ".gitignore"), "utf8");
    assert.ok(fixed.startsWith(before));
    assert.equal(run("init", repo).status, 0);
    assert.equal(fs.readFileSync(path.join(repo, ".gitignore"), "utf8"), fixed);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test("tracked context stays untouched and is not certified private by an ignore", () => {
  const repo = tmpRepo();
  try {
    assert.equal(git(repo, "init", "-q", "--template=").status, 0);
    fs.mkdirSync(path.join(repo, "context"));
    fs.writeFileSync(path.join(repo, "context/kept.md"), "fixture record\n");
    const staged = git(repo, "add", "context/kept.md");
    assert.equal(staged.status, 0, staged.stderr || staged.error?.message);
    const tracked = git(repo, "ls-files", "-z").stdout;
    const result = run("init", repo);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /tracked/i);
    assert.equal(git(repo, "ls-files", "-z").stdout, tracked);
    assert.equal(fs.readFileSync(path.join(repo, "context/kept.md"), "utf8"), "fixture record\n");
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test("initialization refuses symlink ownership instead of changing outside files", () => {
  for (const relative of ["docs", ".gitignore", "docs/memory.md"]) {
    const base = tmpRepo();
    try {
      const repo = path.join(base, "repo"), outside = path.join(base, "outside");
      fs.mkdirSync(repo);
      if (relative === "docs") fs.mkdirSync(outside); else fs.writeFileSync(outside, "keep\n");
      const link = path.join(repo, relative);
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(outside, link);
      const result = run("init", repo);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /symlink ownership/);
      assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
      if (relative === "docs") assert.deepEqual(fs.readdirSync(outside), []);
      else assert.equal(fs.readFileSync(outside, "utf8"), "keep\n");
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
  }
});

test("a directory cannot satisfy a required memory document", () => {
  const repo = tmpRepo();
  try {
    fs.mkdirSync(path.join(repo, "docs/memory.md"), { recursive: true });
    assert.equal(run("check", repo).status, 1);
    assert.equal(run("init", repo).status, 1);
    assert.deepEqual(fs.readdirSync(path.join(repo, "docs")), ["memory.md"]);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

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
  assert.match(memory, /Cleanup or migration requires explicit authority/);
  assert.match(memory, /one suitable effort record/);
  assert.doesNotMatch(memory, /may be deleted after/);
  const guidance = memory.replace(/\s+/g, " ");
  assert.match(guidance, /compact entry point: purpose, ownership/);
  assert.match(guidance, /Link to existing build\/test\/update\/fix guidance/);
  assert.match(guidance, /Capture important agreed constraints, explicit no-s and rationale as they settle, within write authority/);
  assert.match(guidance, /observations from assumptions, proposals and unrun checks/);
  assert.match(guidance, /discovery leads, not an authoritative map/);
  assert.equal(fs.existsSync(path.join(repo, "AGENTS.md")), false);
  assert.equal(fs.existsSync(path.join(repo, "CONTEXT.md")), false);
  assert.deepEqual(fs.readdirSync(path.join(repo, "docs")).sort(), ["adr", "memory.md", "verification.md"]);
  const verification = fs.readFileSync(path.join(repo, "docs", "verification.md"), "utf8");
  assert.match(verification, /Repository commands not yet inspected/);
  assert.doesNotMatch(verification, /bun run test|npm test|pytest/);
  assert.equal(run("init", repo).status, 0);
  assert.equal(fs.readFileSync(path.join(repo, "docs", "memory.md"), "utf8"), memory);

  const ignore = fs.readFileSync(path.join(repo, ".gitignore"), "utf8");
  assert.match(ignore, /^\/context\/$/m);
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
