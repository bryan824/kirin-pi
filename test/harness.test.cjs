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

test("repository has four owned areas and no legacy deploy surface", () => {
  for (const name of ["harness", "skills", "docs", "test"]) {
    assert.equal(fs.existsSync(path.join(root, name)), true, name);
  }
  for (const name of ["agents", "extensions", "scripts", "intercepted-commands", "context", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]) {
    assert.equal(fs.existsSync(path.join(root, name)), false, name);
  }
  assert.equal(fs.existsSync(path.join(root, "docs", "decisions")), false);
});

test("package uses native Pi resources and a strict publication allowlist", () => {
  assert.deepEqual(packageJson.pi, {
    extensions: ["./harness/extensions"],
    skills: ["./skills"],
  });
  assert.equal(packageJson.bin["kirin-pi"], "./harness/bootstrap.cjs");
  assert.deepEqual(packageJson.files, ["harness", "skills", "docs", "README.md", "LICENSE", "LICENSE-APACHE"]);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(fs.existsSync(path.join(root, "bun.lock")), false);
  assert.equal(fs.existsSync(path.join(root, "bun.lockb")), false);
});

test("upstream repository references stay in the ledger except explicit Herdr sync links", () => {
  const candidates = [
    ...filesUnder(path.join(root, "harness")),
    ...filesUnder(path.join(root, "skills")),
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

test("required legal and current-truth docs exist", () => {
  for (const rel of ["README.md", "LICENSE", "LICENSE-APACHE", "docs/memory.md", "docs/verification.md", "docs/UPSTREAM_LEDGER.md"]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  const ledger = fs.readFileSync(path.join(root, "docs", "UPSTREAM_LEDGER.md"), "utf8");
  assert.match(ledger, /MIT notices/);
  assert.match(ledger, /Apache-2\.0 notice/);
  assert.match(ledger, /herdrdev\/herdr/);
});
