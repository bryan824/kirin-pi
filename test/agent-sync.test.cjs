const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const {
  DEFAULT_MANIFEST_FILE,
  readManifest,
  sha256,
  syncBundledAgents,
} = require(path.join(root, "harness", "agent-sync.cjs"));

function tmpDirs() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "kirin-agent-sync-"));
  const sourceDir = path.join(base, "source");
  const targetDir = path.join(base, "target");
  fs.mkdirSync(sourceDir);
  fs.mkdirSync(targetDir);
  return { base, sourceDir, targetDir };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

test("agent sync copies bundled agents and records their hashes", () => {
  const { sourceDir, targetDir } = tmpDirs();
  write(path.join(sourceDir, "scout.md"), "---\ndescription: Scout\n---\n\nScout body\n");

  const result = syncBundledAgents({ sourceDir, targetDir });

  assert.deepEqual(result.added, ["scout.md"]);
  assert.equal(fs.readFileSync(path.join(targetDir, "scout.md"), "utf8"), "---\ndescription: Scout\n---\n\nScout body\n");
  assert.equal(readManifest(targetDir)["scout.md"], sha256("---\ndescription: Scout\n---\n\nScout body\n"));
});

test("agent sync does not overwrite an unmanaged user agent", () => {
  const { sourceDir, targetDir } = tmpDirs();
  write(path.join(sourceDir, "reviewer.md"), "bundled reviewer\n");
  write(path.join(targetDir, "reviewer.md"), "user reviewer\n");

  const result = syncBundledAgents({ sourceDir, targetDir });

  assert.deepEqual(result.pendingUpdate, ["reviewer.md"]);
  assert.equal(fs.readFileSync(path.join(targetDir, "reviewer.md"), "utf8"), "user reviewer\n");
  assert.equal(readManifest(targetDir)["reviewer.md"], "");
});

test("agent sync auto-updates a managed file that has not been user-edited", () => {
  const { sourceDir, targetDir } = tmpDirs();
  write(path.join(sourceDir, "worker.md"), "v1\n");
  syncBundledAgents({ sourceDir, targetDir });

  write(path.join(sourceDir, "worker.md"), "v2\n");
  const result = syncBundledAgents({ sourceDir, targetDir });

  assert.deepEqual(result.updated, ["worker.md"]);
  assert.equal(fs.readFileSync(path.join(targetDir, "worker.md"), "utf8"), "v2\n");
  assert.equal(readManifest(targetDir)["worker.md"], sha256("v2\n"));
});

test("agent sync protects user-edited managed files unless force sync is requested", () => {
  const { sourceDir, targetDir } = tmpDirs();
  write(path.join(sourceDir, "locator.md"), "v1\n");
  syncBundledAgents({ sourceDir, targetDir });

  write(path.join(targetDir, "locator.md"), "user edit\n");
  write(path.join(sourceDir, "locator.md"), "v2\n");

  const safeResult = syncBundledAgents({ sourceDir, targetDir });
  assert.deepEqual(safeResult.pendingUpdate, ["locator.md"]);
  assert.equal(fs.readFileSync(path.join(targetDir, "locator.md"), "utf8"), "user edit\n");

  const forceResult = syncBundledAgents({ sourceDir, targetDir, apply: true });
  assert.deepEqual(forceResult.updated, ["locator.md"]);
  assert.equal(fs.readFileSync(path.join(targetDir, "locator.md"), "utf8"), "v2\n");
});

test("agent sync removes only stale managed files and leaves custom files alone", () => {
  const { sourceDir, targetDir } = tmpDirs();
  write(path.join(sourceDir, "old.md"), "old\n");
  syncBundledAgents({ sourceDir, targetDir });

  fs.unlinkSync(path.join(sourceDir, "old.md"));
  write(path.join(targetDir, "custom.md"), "custom\n");

  const result = syncBundledAgents({ sourceDir, targetDir });

  assert.deepEqual(result.removed, ["old.md"]);
  assert.equal(fs.existsSync(path.join(targetDir, "old.md")), false);
  assert.equal(fs.readFileSync(path.join(targetDir, "custom.md"), "utf8"), "custom\n");
  assert.deepEqual(readManifest(targetDir), {});
  assert.equal(fs.existsSync(path.join(targetDir, DEFAULT_MANIFEST_FILE)), true);
});
