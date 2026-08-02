#!/usr/bin/env bun
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_FILES = ["docs/memory.md", "docs/verification.md"];
const DETECTED_ROOTS = [
  "docs/adr",
  "docs/adrs",
  "docs/decisions",
  "docs/specs",
  "docs/plans",
  "context",
  "project",
];
const GITIGNORE_MARKER = "# kirin working records";
const GITIGNORE_BLOCK = `${GITIGNORE_MARKER} — durable truth lives in docs/\n/context/\n`;

function usage(code = 0) {
  const out = code === 0 ? console.log : console.error;
  out("Usage: project-memory.cjs <check|init> [--root DIR]");
  process.exit(code);
}

function parse(argv) {
  const options = { command: argv[2], root: process.cwd() };
  for (let i = 3; i < argv.length; i += 1) {
    if (argv[i] === "--root" && argv[i + 1]) options.root = path.resolve(argv[++i]);
    else if (argv[i] === "-h" || argv[i] === "--help") usage();
    else usage(1);
  }
  if (!options.command || !["check", "init"].includes(options.command)) usage(options.command ? 1 : 0);
  options.root = path.resolve(options.root);
  return options;
}

function exists(root, relative) {
  return fs.existsSync(path.join(root, relative));
}

function detectedRoots(root) {
  return DETECTED_ROOTS.filter((relative) => exists(root, relative));
}

function state(root) {
  if (exists(root, "docs/memory.md")) return "adopted";
  return detectedRoots(root).length > 0 ? "detected" : "absent";
}

function ensureFile(root, relative, content) {
  const file = path.join(root, relative);
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  return true;
}

function ensureGitignore(root) {
  const file = path.join(root, ".gitignore");
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (current.includes(GITIGNORE_MARKER)) return false;
  const separator = current.length === 0 || current.endsWith("\n\n") ? "" : current.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(file, `${current}${separator}${GITIGNORE_BLOCK}`, "utf8");
  return true;
}

function memoryTemplate(found) {
  return `# Project Memory\n\nStatus: adopted\n\nDurable current truth lives under \`docs/\`. Effort records live under gitignored \`context/\` and may be deleted after their value reaches code, tests, or docs.\n\n## Required\n\n- \`docs/memory.md\` — adoption marker and routing rule\n- \`docs/verification.md\` — standing verification commands and what they prove\n\n## Optional, created when earned\n\n- \`docs/contracts/\`, \`docs/architecture.md\`, \`docs/glossary.md\`, \`docs/known-issues.md\`\n- \`docs/decisions/\` — only hard-to-reverse, surprising trade-offs\n- \`context/decision-maps/\`, \`context/research/\`, \`context/prototypes/\`, \`context/plans/\`, \`context/sessions/\`\n\n## Detected roots at adoption\n\n${found.length ? found.map((item) => `- \`${item}\``).join("\n") : "- None"}\n\nDo not move or rewrite detected roots automatically.\n`;
}

const verificationTemplate = `# Verification\n\n| Command | What it proves |\n|---|---|\n| Pending | Pending |\n`;

function check(root) {
  const current = state(root);
  console.log(`Project memory state: ${current}`);
  if (current === "adopted") {
    const missing = REQUIRED_FILES.filter((relative) => !exists(root, relative));
    if (missing.length === 0) console.log("Required project-memory files are present.");
    else for (const relative of missing) console.log(`Missing: ${relative}`);
    return missing.length === 0 ? 0 : 1;
  }
  for (const relative of detectedRoots(root)) console.log(`Detected: ${relative}`);
  return 0;
}

function init(root) {
  const found = detectedRoots(root);
  const created = [];
  if (ensureFile(root, "docs/memory.md", memoryTemplate(found))) created.push("docs/memory.md");
  if (ensureFile(root, "docs/verification.md", verificationTemplate)) created.push("docs/verification.md");
  if (ensureGitignore(root)) created.push(".gitignore");
  console.log(created.length ? `Created: ${created.join(", ")}` : "Project memory already initialized.");
  return 0;
}

function main(argv = process.argv) {
  const options = parse(argv);
  return options.command === "check" ? check(options.root) : init(options.root);
}

if (require.main === module) process.exitCode = main();

module.exports = { check, detectedRoots, init, main, state };
