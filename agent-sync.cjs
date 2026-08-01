const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MANIFEST_FILE = ".kirin-managed-agents.json";

function emptyResult() {
  return {
    added: [],
    updated: [],
    unchanged: [],
    removed: [],
    pendingUpdate: [],
    pendingRemove: [],
    errors: [],
  };
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isManagedAgentName(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  if (name.includes("\0")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name === "." || name === "..") return false;
  if (name.includes("..")) return false;
  if (path.isAbsolute(name)) return false;
  return name.endsWith(".md");
}

function safeJoin(targetDir, name) {
  if (!isManagedAgentName(name)) return null;
  const root = path.resolve(targetDir);
  const resolved = path.resolve(root, name);
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function readManifest(targetDir, manifestFile = DEFAULT_MANIFEST_FILE) {
  const manifestPath = path.join(targetDir, manifestFile);
  if (!fs.existsSync(manifestPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!isPlainObject(parsed)) return {};
    const manifest = {};
    for (const [name, hash] of Object.entries(parsed)) {
      if (isManagedAgentName(name) && typeof hash === "string") manifest[name] = hash;
    }
    return manifest;
  } catch {
    return {};
  }
}

function writeManifest(targetDir, manifest, result, manifestFile = DEFAULT_MANIFEST_FILE) {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const ordered = {};
    for (const name of Object.keys(manifest).filter(isManagedAgentName).sort()) {
      ordered[name] = manifest[name];
    }
    const manifestPath = path.join(targetDir, manifestFile);
    const tmpPath = path.join(targetDir, `${manifestFile}.${process.pid}.tmp`);
    try {
      fs.writeFileSync(tmpPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
      fs.renameSync(tmpPath, manifestPath);
    } catch (error) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore cleanup failure
      }
      throw error;
    }
  } catch (error) {
    result.errors.push({ op: "manifest-write", message: error instanceof Error ? error.message : String(error) });
  }
}

function listSourceAgents(sourceDir, result) {
  if (!fs.existsSync(sourceDir)) return [];
  try {
    return fs.readdirSync(sourceDir)
      .filter((name) => isManagedAgentName(name))
      .sort();
  } catch (error) {
    result.errors.push({ op: "read-source", message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

function canOverwrite(knownHash, destHash, apply) {
  return apply || (knownHash && knownHash === destHash);
}

function syncBundledAgents(options) {
  const { sourceDir, targetDir, apply = false, manifestFile = DEFAULT_MANIFEST_FILE } = options;
  const result = emptyResult();

  const sourceAgents = listSourceAgents(sourceDir, result);
  if (sourceAgents === null) return result;
  if (sourceAgents.length === 0 && !fs.existsSync(sourceDir)) return result;

  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (error) {
    result.errors.push({ op: "mkdir", message: error instanceof Error ? error.message : String(error) });
    return result;
  }

  const manifest = readManifest(targetDir, manifestFile);
  const nextManifest = {};
  const sourceNames = new Set(sourceAgents);

  for (const name of sourceAgents) {
    const srcPath = safeJoin(sourceDir, name);
    const destPath = safeJoin(targetDir, name);
    const knownHash = manifest[name] || "";

    if (!srcPath || !destPath) {
      result.errors.push({ file: name, op: "copy", message: "rejected unsafe path" });
      nextManifest[name] = knownHash;
      continue;
    }

    let srcContent;
    try {
      srcContent = fs.readFileSync(srcPath, "utf8");
    } catch (error) {
      result.errors.push({ file: name, op: "read-source", message: error instanceof Error ? error.message : String(error) });
      nextManifest[name] = knownHash;
      continue;
    }

    const srcHash = sha256(srcContent);
    if (!fs.existsSync(destPath)) {
      try {
        fs.writeFileSync(destPath, srcContent, "utf8");
        result.added.push(name);
        nextManifest[name] = srcHash;
      } catch (error) {
        result.errors.push({ file: name, op: "copy", message: error instanceof Error ? error.message : String(error) });
        nextManifest[name] = knownHash;
      }
      continue;
    }

    let destContent;
    try {
      destContent = fs.readFileSync(destPath, "utf8");
    } catch (error) {
      result.errors.push({ file: name, op: "read-dest", message: error instanceof Error ? error.message : String(error) });
      nextManifest[name] = knownHash;
      continue;
    }

    const destHash = sha256(destContent);
    if (destHash === srcHash) {
      result.unchanged.push(name);
      nextManifest[name] = srcHash;
      continue;
    }

    if (canOverwrite(knownHash, destHash, apply)) {
      try {
        fs.writeFileSync(destPath, srcContent, "utf8");
        result.updated.push(name);
        nextManifest[name] = srcHash;
      } catch (error) {
        result.errors.push({ file: name, op: "copy", message: error instanceof Error ? error.message : String(error) });
        nextManifest[name] = knownHash;
      }
    } else {
      result.pendingUpdate.push(name);
      nextManifest[name] = knownHash;
    }
  }

  for (const name of Object.keys(manifest).sort()) {
    if (sourceNames.has(name)) continue;
    const destPath = safeJoin(targetDir, name);
    const knownHash = manifest[name] || "";
    if (!destPath) {
      result.errors.push({ file: name, op: "remove", message: "rejected unsafe path" });
      continue;
    }
    if (!fs.existsSync(destPath)) {
      result.removed.push(name);
      continue;
    }

    let destContent;
    try {
      destContent = fs.readFileSync(destPath, "utf8");
    } catch (error) {
      result.errors.push({ file: name, op: "read-dest", message: error instanceof Error ? error.message : String(error) });
      nextManifest[name] = knownHash;
      continue;
    }

    const destHash = sha256(destContent);
    if (canOverwrite(knownHash, destHash, apply)) {
      try {
        fs.unlinkSync(destPath);
        result.removed.push(name);
      } catch (error) {
        result.errors.push({ file: name, op: "remove", message: error instanceof Error ? error.message : String(error) });
        nextManifest[name] = knownHash;
      }
    } else {
      result.pendingRemove.push(name);
      nextManifest[name] = knownHash;
    }
  }

  writeManifest(targetDir, nextManifest, result, manifestFile);
  return result;
}

function formatSyncReport(result) {
  const parts = [];
  if (result.added.length) parts.push(`${result.added.length} added`);
  if (result.updated.length) parts.push(`${result.updated.length} updated`);
  if (result.removed.length) parts.push(`${result.removed.length} removed`);
  if (result.pendingUpdate.length) parts.push(`${result.pendingUpdate.length} user-edited/outdated`);
  if (result.pendingRemove.length) parts.push(`${result.pendingRemove.length} user-edited/stale`);
  if (result.errors.length) parts.push(`${result.errors.length} error(s)`);
  return parts.length ? `Kirin agent sync: ${parts.join(", ")}.` : "Kirin agents already up to date.";
}

module.exports = {
  DEFAULT_MANIFEST_FILE,
  emptyResult,
  formatSyncReport,
  isManagedAgentName,
  readManifest,
  safeJoin,
  sha256,
  syncBundledAgents,
};
