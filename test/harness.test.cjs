const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
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
  for (const name of ["agents", "extensions", "hooks", "skills", "docs", "test", "chatgpt-export.ts", "guard-policy.cjs", "setup.cjs"]) {
    assert.equal(fs.existsSync(path.join(root, name)), true, name);
  }
  for (const name of ["harness", "scripts", "intercepted-commands", "agent-sync.cjs", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]) {
    assert.equal(fs.existsSync(path.join(root, name)), false, name);
  }
  assert.equal(fs.existsSync(path.join(root, "docs", "decisions")), false);
});

test("package uses native Pi resources and a strict publication allowlist", () => {
  // No `skills` key: selected skills reach Pi through global/project .agents/skills.
  // Re-adding it bypasses selection and loads every packaged skill.
  assert.deepEqual(packageJson.pi, {
    extensions: ["./extensions"],
    subagents: { agents: ["./agents"] },
  });
  assert.equal(packageJson.bin["kirin-pi"], "./setup.cjs");
  assert.equal(packageJson.packageManager, "bun@1.4.2");
  assert.deepEqual(packageJson.files, [
    "agents", "extensions", "hooks", "skills", "docs",
    "chatgpt-export.ts", "guard-policy.cjs", "setup.cjs",
    "README.md", "LICENSE", "LICENSE-APACHE",
  ]);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(fs.existsSync(path.join(root, "bun.lock")), false);
  assert.equal(fs.existsSync(path.join(root, "bun.lockb")), false);
});

test("test command runs owned files, not archived namesakes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kirin-test-scope-"));
  const write = (file, text) => {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  try {
    write("package.json", JSON.stringify({ scripts: { test: packageJson.scripts.test } }));
    write(".gitignore", "/context/\n");
    for (const [file, name] of [
      ["test/owned.test.cjs", "owned cjs"],
      ["test/owned.test.ts", "owned ts"],
      ["skills/maintenance/harness/scripts/skill-cleaner.test.ts", "owned analyzer"],
    ]) write(file, `const {test}=require("bun:test"); test(${JSON.stringify(name)},()=>console.log(${JSON.stringify(`RAN ${name}`)}));\n`);
    write("context/archive/test/owned.test.cjs", 'throw new Error("ARCHIVED_TEST_MUST_NOT_RUN");\n');
    const result = spawnSync("bun", ["run", "test"], { cwd: dir, encoding: "utf8", timeout: 15_000 });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    for (const name of ["owned cjs", "owned ts", "owned analyzer"]) assert.ok(output.includes(`RAN ${name}`), output);
    assert.doesNotMatch(output, /ARCHIVED_TEST_MUST_NOT_RUN/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("upstream repository references stay in the ledger", () => {
  const candidates = [
    ...filesUnder(path.join(root, "agents")),
    ...filesUnder(path.join(root, "extensions")),
    ...filesUnder(path.join(root, "hooks")),
    ...filesUnder(path.join(root, "skills")),
    path.join(root, "chatgpt-export.ts"),
    path.join(root, "guard-policy.cjs"),
    path.join(root, "setup.cjs"),
    path.join(root, "AGENTS.md"),
  ].filter((file) => /\.(?:md|ts|cjs)$/.test(file));

  for (const file of candidates) {
    const urls = fs.readFileSync(file, "utf8").match(/https?:\/\/github\.com\/[^\s)`]+/g) ?? [];
    assert.deepEqual(urls, [], path.relative(root, file));
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

test("README documents Claude native-equivalent boundaries", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /Claude native equivalents/);
  assert.match(readme, /~\/\.claude\/settings\.json/);
  assert.match(readme, /~\/\.claude\/kirin/);
  assert.match(readme, /\/insights/);
  assert.match(readme, /MCP|plugin/);
});

test("working records, runtime artifacts, and local installed copies stay untracked", () => {
  for (const record of [
    "context/plans/probe.md", ".pi/subagents/artifacts/probe",
    ".agents/skills/harness/SKILL.md", ".claude/skills/harness/SKILL.md",
  ]) {
    const result = spawnSync("git", ["-c", "core.excludesFile=/dev/null", "check-ignore", record], { cwd: root });
    assert.equal(result.status, 0, record);
  }
  const tracked = spawnSync("git", ["ls-files", "--", "context/", ".pi/subagents/", ".agents/skills/", ".claude/skills/"], { cwd: root, encoding: "utf8" });
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.equal(tracked.stdout, "", "working records and installed copies must not enter Git history");
});

test("root instructions use native AGENTS.md and maintenance navigation resolves", () => {
  assert.equal(fs.lstatSync(path.join(root, "AGENTS.md")).isFile(), true);
  assert.equal(fs.lstatSync(path.join(root, "CLAUDE.md"), { throwIfNoEntry: false }), undefined);
  const instructions = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  for (const command of ["test", "pack:dry"]) {
    assert.ok(packageJson.scripts[command]);
    assert.ok(instructions.includes(`bun run ${command}`));
  }
  for (const target of ["README.md#maintaining-the-harness", "docs/memory.md", "docs/verification.md", "skills/maintenance/write-skill/SKILL.md"]) {
    assert.ok(instructions.includes(`](${target})`), target);
  }
  // These maps use simple Markdown headings. Existence is not model navigation evidence.
  for (const relative of ["AGENTS.md", "README.md", "docs/memory.md", "docs/verification.md"]) {
    const file = path.join(root, relative);
    for (const [, href] of fs.readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(href)) continue;
      const [local, anchor] = href.split("#");
      const target = local ? path.resolve(path.dirname(file), decodeURI(local)) : file;
      assert.equal(fs.statSync(target).isFile(), true, `${relative}: ${href}`);
      if (anchor) {
        const headings = [...fs.readFileSync(target, "utf8").matchAll(/^#{1,6} (.+)$/gm)]
          .map(([, title]) => title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s/g, "-"));
        assert.ok(headings.includes(anchor), `${relative}: ${href}`);
      }
    }
  }
});

test("upstream checkpoints are separate from retained provenance", () => {
  const ledger = fs.readFileSync(path.join(root, "docs", "UPSTREAM_LEDGER.md"), "utf8");
  const relationships = ledger.split("## Current relationships\n")[1].split("## Current borrowed surfaces")[0];
  const rows = relationships.split("\n").filter((line) => line.startsWith("|"));
  assert.equal(rows[0], "| Source | Provenance / prior review | Reviewed through | Relationship now | Revisit when |");
  assert.ok(rows.length > 2, "source inventory must not be empty");
  for (const row of rows.slice(2)) {
    const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
    assert.equal(cells.length, 5, row);
    assert.ok(cells.every(Boolean), row);
  }
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const maintenance = readme.split("## Maintaining the harness\n")[1].split("## Development\n")[0];
  assert.ok(maintenance.includes("](skills/maintenance/harness/SKILL.md)"), "maintenance routes to the harness skill");
});

test("required legal and current-truth docs exist", () => {
  for (const rel of ["README.md", "LICENSE", "LICENSE-APACHE", "docs/memory.md", "docs/verification.md", "docs/UPSTREAM_LEDGER.md"]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
  const ledger = fs.readFileSync(path.join(root, "docs", "UPSTREAM_LEDGER.md"), "utf8");
  assert.match(ledger, /MIT notices/);
  assert.match(ledger, /Apache-2\.0 notice/);
  for (const notice of ["Copyright (c) 2026 Jakub Krehel", "Copyright (c) 2026 Emil Kowalski"]) {
    assert.ok(ledger.includes(notice), notice);
  }
  assert.match(ledger, /herdrdev\/herdr/);
  assert.match(ledger, /Copyright 2024 Anthropic PBC/);
  assert.match(ledger, /frontend-design[\s\S]*Apache-2\.0/);
  for (const file of ["extensions/herdr/agent-state.ts", "extensions/session-breakdown.ts", "skills/domain/frontend-design/SKILL.md", "skills/domain/herdr/SKILL.md"]) {
    assert.match(fs.readFileSync(path.join(root, file), "utf8"), /Modified for kirin-pi/, file);
  }
});
