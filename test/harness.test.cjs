const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packageJson = require("../package.json");

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

test("executable integration lives at the root with no wrapper directory", () => {
  for (const name of ["agents", "extensions", "hooks", "skills", "docs", "test", "agent-sync.cjs", "guard-policy.cjs", "setup.cjs"]) {
    assert.equal(fs.existsSync(path.join(root, name)), true, name);
  }
  for (const name of ["harness", "scripts", "intercepted-commands", "context", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]) {
    assert.equal(fs.existsSync(path.join(root, name)), false, name);
  }
  assert.equal(fs.existsSync(path.join(root, "docs", "decisions")), false);
});

test("package uses native Pi resources and a strict publication allowlist", () => {
  // No `skills` key: shared skills reach agents through ~/.agents/skills only.
  // Re-adding it makes Pi load every skill a second time from the package.
  assert.deepEqual(packageJson.pi, { extensions: ["./extensions"] });
  assert.equal(packageJson.bin["kirin-pi"], "./setup.cjs");
  assert.deepEqual(packageJson.files, [
    "agents", "extensions", "hooks", "skills", "docs",
    "agent-sync.cjs", "guard-policy.cjs", "setup.cjs",
    "README.md", "LICENSE", "LICENSE-APACHE",
  ]);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(fs.existsSync(path.join(root, "bun.lock")), false);
  assert.equal(fs.existsSync(path.join(root, "bun.lockb")), false);
});

test("upstream repository references stay in the ledger except explicit Herdr sync links", () => {
  const candidates = [
    ...filesUnder(path.join(root, "agents")),
    ...filesUnder(path.join(root, "extensions")),
    ...filesUnder(path.join(root, "hooks")),
    ...filesUnder(path.join(root, "skills")),
    path.join(root, "agent-sync.cjs"),
    path.join(root, "guard-policy.cjs"),
    path.join(root, "setup.cjs"),
    path.join(root, "AGENTS.md"),
  ].filter((file) => /\.(?:md|ts|cjs)$/.test(file));

  const allowed = new Set([
    "https://github.com/herdrdev/herdr/blob/master/src/integration/assets/pi/herdr-agent-state.ts",
    "https://github.com/herdrdev/herdr/blob/master/skills/herdr/SKILL.md",
  ]);
  for (const file of candidates) {
    const urls = fs.readFileSync(file, "utf8").match(/https?:\/\/github\.com\/[^\s)`]+/g) ?? [];
    for (const url of urls) assert.ok(allowed.has(url), `${path.relative(root, file)}: ${url}`);
  }
});

test("README documents the remote and checkout install sources", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  // The remote form must pin a resolved commit: bunx resolves a source string once,
  // so a branch ref would keep serving whatever commit it first saw.
  assert.match(readme, /bunx "github:bryan824\/kirin-pi#\$\(git ls-remote /);
  assert.doesNotMatch(readme, /bunx 'github:bryan824\/kirin-pi#main'/);
  assert.doesNotMatch(readme, /rm -rf .*bunx-/);
  assert.match(readme, /bun run kirin-pi\b/);
  assert.doesNotMatch(readme, /bootstrap workflow/);
  // `bun run kirin-pi` is the package script; no link step or node_modules required.
  assert.equal(packageJson.scripts["kirin-pi"], "bun setup.cjs");
  assert.equal(packageJson.scripts.link, undefined);
});

test("required legal and current-truth docs exist", () => {
  for (const rel of ["README.md", "LICENSE", "LICENSE-APACHE", "docs/memory.md", "docs/verification.md", "docs/UPSTREAM_LEDGER.md"]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  const ledger = fs.readFileSync(path.join(root, "docs", "UPSTREAM_LEDGER.md"), "utf8");
  assert.match(ledger, /MIT notices/);
  assert.match(ledger, /Apache-2\.0 notice/);
  assert.match(ledger, /herdrdev\/herdr/);
});
