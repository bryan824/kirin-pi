const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "harness", "setup.cjs");
const {
  KIRIN_SOURCE,
  START,
  SUBAGENT_DEFAULTS,
  WORKFLOW,
  installBlock,
  installInstructions,
  packageActions,
  parse,
  setup,
  syncSharedSkills,
} = require("../harness/setup.cjs");

const WORKFLOW_SKILLS = [
  "architecture", "commit", "debug", "decision-map", "design", "implement",
  "parallel-work", "plan", "prototype", "research", "survey", "verify",
];
const MAINTENANCE_SKILLS = ["project-memory", "session-close", "skill-audit", "write-skill"];
const SHARED_SKILLS = [...WORKFLOW_SKILLS, ...MAINTENANCE_SKILLS, "herdr"].sort();

function tempDir(prefix = "kirin-setup-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function fixtureCheckout(base) {
  const checkout = path.join(base, "checkout");
  for (const name of WORKFLOW_SKILLS) write(path.join(checkout, "skills", "workflow", name, "SKILL.md"), `---\nname: ${name}\ndescription: test\n---\n`);
  for (const name of MAINTENANCE_SKILLS) write(path.join(checkout, "skills", "maintenance", name, "SKILL.md"), `---\nname: ${name}\ndescription: test\n---\n`);
  write(path.join(checkout, "skills", "domain", "herdr", "SKILL.md"), "---\nname: herdr\ndescription: test\n---\n");
  write(path.join(checkout, "skills", "domain", "rust", "SKILL.md"), "---\nname: rust\ndescription: test\n---\n");
  fs.cpSync(path.join(root, "harness", "agents"), path.join(checkout, "harness", "agents"), { recursive: true });
  return checkout;
}

test("setup CLI is always global and requires no arguments", () => {
  assert.deepEqual(parse([]), { help: false, dryRun: false, home: os.homedir() });
  assert.deepEqual(parse(["setup"]), { help: false, dryRun: false, home: os.homedir() });
  assert.throws(() => parse(["--global"]), /takes no options/);
  assert.throws(() => parse(["bootstrap", "workflow"]), /takes no options/);
});

test("package plan installs missing packages and updates present packages", () => {
  assert.deepEqual(packageActions({ packages: [] }).map((item) => item.action), ["install", "install", "install"]);
  const actions = packageActions({ packages: [KIRIN_SOURCE, "npm:pi-web-access"] });
  assert.deepEqual(actions.map((item) => item.action), ["update", "install", "update"]);
});

test("shared setup links only core plus Herdr and safely backs up collisions", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  write(path.join(home, ".local", "share", "kirin-pi", "skills", "user.txt"), "unmanaged snapshot\n");
  write(path.join(home, ".agents", "skills", "design", "user.txt"), "shared original\n");
  write(path.join(home, ".claude", "skills", "design", "user.txt"), "claude original\n");
  write(path.join(home, ".agents", "skills", "rust", "user.txt"), "shared opt-in\n");
  write(path.join(home, ".claude", "skills", "rust", "user.txt"), "claude opt-in\n");

  const first = syncSharedSkills(checkout, home, "run-1");
  assert.equal(first.count, 17);
  assert.equal(first.backups.length, 5);
  assert.deepEqual(
    fs.readdirSync(path.join(home, ".agents", "skills")).filter((name) => !name.startsWith(".")).sort(),
    SHARED_SKILLS,
  );
  assert.equal(fs.existsSync(path.join(home, ".agents", "skills", "rust")), false);
  assert.equal(fs.lstatSync(path.join(home, ".agents", "skills", "design")).isSymbolicLink(), true);
  assert.equal(fs.lstatSync(path.join(home, ".claude", "skills", "design")).isSymbolicLink(), true);
  assert.match(fs.realpathSync(path.join(home, ".agents", "skills", "design")), /\.local\/share\/kirin-pi\/skills\/design$/);
  assert.equal(fs.existsSync(path.join(home, ".local", "share", "kirin-pi", "skills", ".managed-by-kirin")), true);
  assert.equal(fs.readFileSync(path.join(home, ".agents", "kirin-backups", "run-1", "skills", "design", "user.txt"), "utf8"), "shared original\n");
  assert.equal(fs.readFileSync(path.join(home, ".claude", "kirin-backups", "run-1", "skills", "design", "user.txt"), "utf8"), "claude original\n");
  assert.equal(fs.readFileSync(path.join(home, ".agents", "kirin-backups", "run-1", "opt-in-skills", "rust", "user.txt"), "utf8"), "shared opt-in\n");
  assert.equal(fs.readFileSync(path.join(home, ".claude", "kirin-backups", "run-1", "opt-in-skills", "rust", "user.txt"), "utf8"), "claude opt-in\n");
  assert.equal(fs.readFileSync(path.join(home, ".local", "share", "kirin-pi", "backups", "run-1", "skills", "user.txt"), "utf8"), "unmanaged snapshot\n");

  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "updated\n");
  const second = syncSharedSkills(checkout, home, "run-2");
  assert.equal(second.backups.length, 0);
  assert.equal(fs.readFileSync(path.join(home, ".agents", "skills", "design", "updated.txt"), "utf8"), "updated\n");
});

test("Claude imports canonical Pi AGENTS while custom text survives", () => {
  const home = tempDir();
  const piAgents = path.join(home, ".pi", "agent", "AGENTS.md");
  write(piAgents, `${WORKFLOW}\n\n<!-- kirin-ratchet:start -->\n## Earned\n\n- Keep me.\n<!-- kirin-ratchet:end -->\n`);
  write(path.join(home, ".claude", "CLAUDE.md"), `${WORKFLOW}\n\nCustom Claude note.\n`);

  const first = installInstructions(home, "run-1", true);
  assert.equal(first.backups.length, 1);
  const canonical = path.join(home, ".agents", "AGENTS.md");
  assert.equal(fs.readlinkSync(path.join(home, ".claude", "AGENTS.md")), canonical);
  assert.equal(fs.readlinkSync(piAgents), canonical);
  const claude = fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8");
  assert.equal(claude, "@AGENTS.md\n\nCustom Claude note.\n");
  const shared = fs.readFileSync(canonical, "utf8");
  assert.equal((shared.match(new RegExp(START, "g")) ?? []).length, 1);
  assert.match(shared, /Keep me\./);

  installInstructions(home, "run-2", true);
  assert.equal(fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"), claude);
});

test("instruction writes preserve dotfile-managed symlinks", () => {
  const home = tempDir();
  const managedPi = path.join(home, "managed", "AGENTS.md");
  const managedClaude = path.join(home, "managed", "CLAUDE.md");
  const piLink = path.join(home, ".pi", "agent", "AGENTS.md");
  const claudeLink = path.join(home, ".claude", "CLAUDE.md");
  write(managedPi, "Pi custom.\n");
  write(managedClaude, "Claude custom.\n");
  fs.chmodSync(managedPi, 0o640);
  fs.chmodSync(managedClaude, 0o600);
  fs.mkdirSync(path.dirname(piLink), { recursive: true });
  fs.mkdirSync(path.dirname(claudeLink), { recursive: true });
  fs.symlinkSync(managedPi, piLink);
  fs.symlinkSync(managedClaude, claudeLink);

  installInstructions(home, "run-1", true);
  assert.equal(fs.lstatSync(piLink).isSymbolicLink(), true);
  assert.equal(fs.lstatSync(claudeLink).isSymbolicLink(), true);
  assert.equal(fs.statSync(managedPi).mode & 0o777, 0o640);
  assert.equal(fs.statSync(managedClaude).mode & 0o777, 0o600);
  assert.match(fs.readFileSync(managedPi, "utf8"), /Pi custom/);
  assert.equal(fs.readlinkSync(piLink), path.join(home, ".agents", "AGENTS.md"));
  assert.equal(fs.readFileSync(managedClaude, "utf8"), "@AGENTS.md\n\nClaude custom.\n");
});

test("Claude-specific earned rules survive canonicalization", () => {
  const home = tempDir();
  write(path.join(home, ".claude", "CLAUDE.md"), "<!-- kirin-ratchet:start -->\n## Claude only\n\n- Keep this too.\n<!-- kirin-ratchet:end -->\n");
  installInstructions(home, "run-1", false);
  const claude = fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8");
  assert.match(claude, /^@AGENTS\.md/);
  assert.match(claude, /Keep this too\./);
});

test("workflow block replacement is idempotent", () => {
  const existing = `Before\n\n${WORKFLOW}\n\nAfter\n`;
  assert.equal(installBlock(installBlock(existing)), installBlock(existing));
});

test("internal dry run mutates neither home nor repository", () => {
  const home = tempDir();
  const before = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const originalLog = console.log;
  console.log = () => {};
  try {
    const result = setup({ home, dryRun: true, pi: null }, root);
    assert.deepEqual(result, { dryRun: true, pi: false });
  } finally {
    console.log = originalLog;
  }
  assert.equal(fs.readdirSync(home).length, 0);
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), before);
});

test("zero-argument CLI installs shared skills and Claude instructions without Pi", () => {
  const home = tempDir();
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pi not found in PATH/);
  assert.equal(fs.existsSync(path.join(home, ".pi")), false);
  assert.equal(fs.readdirSync(path.join(home, ".agents", "skills")).length, 17);
  assert.equal(fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  assert.equal(fs.readlinkSync(path.join(home, ".claude", "AGENTS.md")), path.join(home, ".agents", "AGENTS.md"));
});

test("zero-argument CLI adds Pi-specific setup only when Pi is in PATH", () => {
  const home = tempDir();
  write(path.join(home, ".pi", "agent", "agents", "reviewer.md"), "custom reviewer\n");
  // A decoy in Pi's own clone: presets must come from the running package, not from there.
  const piClone = path.join(home, ".pi", "agent", "git", "github.com", "bryan824", "kirin-pi");
  write(path.join(piClone, "harness", "agents", "reviewer.md"), "decoy reviewer\n");

  const fakePi = path.join(home, "bin", "pi");
  write(fakePi, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$HOME/pi-calls\"\n");
  fs.chmodSync(fakePi, 0o755);

  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, HOME: home, PI_BIN: fakePi },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Kirin setup complete/);
  assert.equal(fs.readFileSync(path.join(home, "pi-calls"), "utf8").trim().split("\n").length, 3);
  assert.equal(fs.readdirSync(path.join(home, ".agents", "skills")).length, 17);
  assert.equal(fs.readdirSync(path.join(home, ".pi", "agent", "agents")).filter((name) => name.endsWith(".md")).length, 7);
  const reviewerBackups = filesUnder(path.join(home, ".pi", "agent", "kirin-backups"))
    .filter((file) => path.basename(file) === "reviewer.md");
  assert.equal(reviewerBackups.length, 1);
  assert.equal(fs.readFileSync(reviewerBackups[0], "utf8"), "custom reviewer\n");
  assert.equal(
    fs.readFileSync(path.join(home, ".pi", "agent", "agents", "reviewer.md"), "utf8"),
    fs.readFileSync(path.join(root, "harness", "agents", "reviewer.md"), "utf8"),
  );
  assert.equal(fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".pi", "agent", "subagents.json"), "utf8")), SUBAGENT_DEFAULTS);
  // `pi install` is the only writer of settings.json; setup never edits it directly.
  assert.equal(fs.existsSync(path.join(home, ".pi", "agent", "settings.json")), false);
});

test("documented subagent defaults remain compact and finite", () => {
  assert.deepEqual(SUBAGENT_DEFAULTS, {
    defaultMaxTurns: 30,
    graceTurns: 3,
    schedulingEnabled: false,
    toolDescriptionMode: "compact",
    outputTranscript: false,
  });
});
