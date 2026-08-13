const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "setup.cjs");
const {
  KIRIN_SOURCE,
  SKILL_PACKS,
  START,
  SUBAGENT_DEFAULTS,
  WORKFLOW,
  expandPacks,
  installBlock,
  installInstructions,
  mergeClaudeSettings,
  packageActions,
  parse,
  planProjectSkills,
  resolveOptions,
  setup,
  syncProjectSkills,
  syncSharedSkills,
} = require("../setup.cjs");

const WORKFLOW_SKILLS = [
  "architecture", "commit", "debug", "decision-map", "design", "implement",
  "parallel-work", "plan", "prototype", "research", "survey", "verify",
];
const MAINTENANCE_SKILLS = ["project-memory", "session-close", "skill-audit", "write-skill"];
const SHARED_SKILLS = [...WORKFLOW_SKILLS, ...MAINTENANCE_SKILLS, "chatgpt-export", "herdr"].sort();

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
  write(path.join(checkout, "skills", "domain", "chatgpt-export", "SKILL.md"), "---\nname: chatgpt-export\ndescription: test\n---\n");
  write(path.join(checkout, "skills", "domain", "herdr", "SKILL.md"), "---\nname: herdr\ndescription: test\n---\n");
  write(path.join(checkout, "skills", "domain", "rust", "SKILL.md"), "---\nname: rust\ndescription: test\n---\n");
  write(path.join(checkout, "skills", "domain", "python-tooling", "SKILL.md"), "---\nname: python-tooling\ndescription: test\n---\n");
  fs.cpSync(path.join(root, "agents"), path.join(checkout, "agents"), { recursive: true });
  return checkout;
}

test("setup CLI retains global defaults and parses future selectors", () => {
  assert.deepEqual(parse([]), { help: false, dryRun: false, home: os.homedir() });
  assert.deepEqual(parse(["setup"]), { help: false, dryRun: false, home: os.homedir() });
  assert.deepEqual(parse(["--scope", "global"]), { help: false, dryRun: false, home: os.homedir(), scope: "global" });
  assert.deepEqual(parse(["setup", "--scope", "project", "--project", "/tmp/kirin", "--packs", "frontend,rust", "--yes"]), {
    help: false,
    dryRun: false,
    home: os.homedir(),
    scope: "project",
    project: "/tmp/kirin",
    packs: ["frontend", "rust"],
    yes: true,
  });
  assert.throws(() => parse(["--scope", "global", "--packs", "rust"]), /Global setup installs core only/);
  assert.throws(() => parse(["--scope", "project", "--packs", "core"]), /Project setup installs optional packs only/);
  assert.throws(() => parse(["--packs", "core,unknown"]), /Unknown Kirin skill pack: unknown/);
  assert.throws(() => parse(["--scope", "local"]), /scope must be `global` or `project`/);
  assert.throws(() => parse(["--project", "/tmp/kirin"]), /requires --scope project/);
  assert.deepEqual(parse(["--scope", "project"]), {
    help: false,
    dryRun: false,
    home: os.homedir(),
    scope: "project",
  });
  assert.throws(() => parse(["--global"]), /Unknown option/);
  assert.throws(() => parse(["bootstrap", "workflow"]), /optional `setup` command/);
});

test("skill packs expand to the approved source groups", () => {
  assert.deepEqual(Object.keys(SKILL_PACKS), ["core", "frontend", "rust", "python", "teaching"]);
  assert.deepEqual(expandPacks(["core"]).map((skill) => skill.name).sort(), SHARED_SKILLS);
  assert.deepEqual(
    expandPacks(["frontend"]).map((skill) => skill.name).sort(),
    ["apple-interface", "frontend-accessibility", "frontend-color", "frontend-design", "frontend-layout", "frontend-motion", "frontend-polish", "frontend-typography", "frontend-writing"],
  );
  assert.deepEqual(expandPacks(["rust", "python", "teaching"]).map((skill) => skill.name), ["rust", "python-tooling", "teach"]);
  const shipped = fs.readdirSync(path.join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((group) => fs.readdirSync(path.join(root, "skills", group.name), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name));
  const packed = expandPacks(Object.keys(SKILL_PACKS)).map((skill) => skill.name);
  assert.deepEqual(packed.slice().sort(), shipped.sort(), "every shipped skill belongs to a pack");
  assert.equal(new Set(packed).size, packed.length, "no skill belongs to two packs");
  const checkout = fixtureCheckout(tempDir());
  write(path.join(checkout, "skills", "workflow", "future-workflow", "SKILL.md"), "---\nname: future-workflow\ndescription: test\n---\n");
  write(path.join(checkout, "skills", "maintenance", "future-maintenance", "SKILL.md"), "---\nname: future-maintenance\ndescription: test\n---\n");
  assert.deepEqual(
    expandPacks(["core"], checkout).map((skill) => skill.name).sort(),
    [...SHARED_SKILLS, "future-workflow", "future-maintenance"].sort(),
  );
});

test("option resolution prompts through injected questions and cancels on EOF", async () => {
  const base = tempDir();
  const project = path.join(base, "project");
  fs.mkdirSync(project);
  const answers = ["project", "", "frontend,rust", "yes"];
  const resolved = await resolveOptions(
    { help: false, dryRun: false, home: path.join(base, "home") },
    root,
    { input: { isTTY: true }, output: { isTTY: true }, cwd: project, question: async () => answers.shift() },
  );
  assert.deepEqual(resolved, {
    help: false,
    dryRun: false,
    home: path.join(base, "home"),
    scope: "project",
    project,
    packs: ["frontend", "rust"],
    decision: "skip",
  });
  await assert.rejects(
    resolveOptions(
      { help: false, dryRun: false, home: path.join(base, "home") },
      root,
      { input: { isTTY: true }, output: { isTTY: true }, cwd: project, question: async () => undefined },
    ),
    /cancelled/,
  );
  write(path.join(project, ".agents", "skills", "rust", "SKILL.md"), "custom\n");
  await assert.rejects(
    resolveOptions(
      { help: false, dryRun: false, home: path.join(base, "home"), scope: "project", project, packs: ["rust"] },
      root,
      { input: { isTTY: true }, output: { isTTY: true }, cwd: project, question: async () => "cancel" },
    ),
    /cancelled/,
  );
  assert.equal(fs.readFileSync(path.join(project, ".agents", "skills", "rust", "SKILL.md"), "utf8"), "custom\n");
});

test("scope choices keep core global and optional packs project-local", async () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const project = path.join(base, "project");
  fs.mkdirSync(project);

  const globalAnswers = ["global", "yes"];
  const global = await resolveOptions(
    { help: false, dryRun: false, home }, root,
    { input: { isTTY: true }, output: { isTTY: true }, cwd: project, question: async () => globalAnswers.shift() },
  );
  assert.deepEqual(global.packs, ["core"]);

  const projectAnswers = ["project", "", "rust", "yes"];
  const local = await resolveOptions(
    { help: false, dryRun: false, home }, root,
    { input: { isTTY: true }, output: { isTTY: true }, cwd: project, question: async () => projectAnswers.shift() },
  );
  assert.deepEqual(local.packs, ["rust"]);
  await assert.rejects(
    resolveOptions(
      { help: false, dryRun: false, home, scope: "global", packs: ["rust"], yes: true }, root,
      { input: { isTTY: false }, output: { isTTY: false }, cwd: project },
    ),
    /Global setup installs core only/,
  );
  await assert.rejects(
    resolveOptions(
      { help: false, dryRun: false, home, scope: "project", packs: ["core"], yes: true }, root,
      { input: { isTTY: false }, output: { isTTY: false }, cwd: project },
    ),
    /Project setup installs optional packs only/,
  );
});

test("non-interactive options default global to core and require project packs", async () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const global = await resolveOptions(
    { help: false, dryRun: false, home }, checkout,
    { input: { isTTY: false }, output: { isTTY: false }, cwd: base },
  );
  assert.deepEqual(global.packs, ["core"]);

  const answers = ["global", "yes"];
  const promptedGlobal = await resolveOptions(
    { help: false, dryRun: false, home }, checkout,
    { input: { isTTY: true }, output: { isTTY: true }, cwd: base, question: async () => answers.shift() },
  );
  assert.deepEqual(promptedGlobal.packs, ["core"]);

  const project = path.join(base, "project");
  fs.mkdirSync(project);
  const projectDefault = await resolveOptions(
    { help: false, dryRun: false, home, scope: "project", packs: ["rust"], yes: true }, checkout,
    { input: { isTTY: false }, output: { isTTY: false }, cwd: project },
  );
  assert.equal(projectDefault.project, project);
  assert.equal(projectDefault.decision, "replace");

  await assert.rejects(
    resolveOptions(
      { help: false, dryRun: false, home, scope: "project" }, checkout,
      { input: { isTTY: false }, output: { isTTY: false }, cwd: base },
    ),
    /requires --packs/,
  );
});

test("native readline cancels on EOF and Ctrl-C without running setup", async () => {
  for (const endInput of [
    (input) => input.end(),
    (input) => input.write("\x03"),
  ]) {
    const home = tempDir();
    const input = new PassThrough();
    const output = new PassThrough();
    input.isTTY = true;
    output.isTTY = true;
    const pending = resolveOptions({ help: false, dryRun: false, home }, root, { input, output });
    queueMicrotask(() => endInput(input));
    await assert.rejects(pending, /cancelled/);
    assert.deepEqual(fs.readdirSync(home), []);
  }
});

test("package plan installs missing packages and updates present packages", () => {
  assert.deepEqual(packageActions({ packages: [] }).map((item) => item.action), ["install", "install", "install"]);
  const actions = packageActions({ packages: [KIRIN_SOURCE, "npm:pi-web-access"] });
  assert.deepEqual(actions.map((item) => item.action), ["update", "install", "update"]);
});

test("project skill sync preserves custom skills and recognizes identical reruns", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  for (const directory of [".agents", ".claude"]) {
    write(path.join(project, directory, "skills", "custom", "SKILL.md"), "custom\n");
  }
  write(path.join(checkout, "skills", "domain", "rust", "version.txt"), "1\n");
  fs.symlinkSync("version.txt", path.join(checkout, "skills", "domain", "rust", "current-version"));

  const first = syncProjectSkills(project, ["rust"], "replace", checkout);
  assert.deepEqual(first.plan.add.map((skill) => skill.name), ["rust", "rust"]);
  for (const directory of [".agents", ".claude"]) {
    assert.equal(fs.readFileSync(path.join(project, directory, "skills", "custom", "SKILL.md"), "utf8"), "custom\n");
    assert.equal(fs.existsSync(path.join(project, directory, "skills", "rust", "SKILL.md")), true);
    assert.equal(fs.lstatSync(path.join(project, directory, "skills", "rust", "current-version")).isSymbolicLink(), true);
  }

  const rerun = planProjectSkills(project, ["rust"], checkout);
  assert.deepEqual(rerun.add, []);
  assert.deepEqual(rerun.collisions, []);
  assert.deepEqual(rerun.skip.map((skill) => skill.name), ["rust", "rust"]);

  fs.chmodSync(path.join(checkout, "skills", "domain", "rust", "version.txt"), 0o755);
  assert.deepEqual(planProjectSkills(project, ["rust"], checkout).collisions.map((skill) => skill.name), ["rust", "rust"]);
});

test("project skill sync applies one decision to mixed additions and collisions", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  const rust = path.join(project, ".agents", "skills", "rust", "SKILL.md");
  write(rust, "old rust\n");

  const cancelled = syncProjectSkills(project, ["rust", "python"], "cancel", checkout);
  assert.equal(cancelled.plan.add.some((skill) => skill.name === "python-tooling"), true);
  assert.equal(cancelled.plan.collisions.some((skill) => skill.name === "rust"), true);
  assert.equal(fs.readFileSync(rust, "utf8"), "old rust\n");
  assert.equal(fs.existsSync(path.join(project, ".agents", "skills", "python-tooling")), false);

  const originalLog = console.log;
  const logs = [];
  console.log = (...items) => logs.push(items.join(" "));
  try {
    setup({ scope: "project", project, packs: ["rust", "python"], decision: "skip", dryRun: true }, checkout);
  } finally {
    console.log = originalLog;
  }
  assert.equal(logs.some((line) => line.includes("2 skill target(s) to add, 0 to replace, 2 unchanged or skipped")), true);
  assert.equal(fs.existsSync(path.join(project, ".claude", "skills", "rust")), false);

  const skipped = syncProjectSkills(project, ["rust", "python"], "skip", checkout);
  assert.equal(fs.readFileSync(rust, "utf8"), "old rust\n");
  assert.equal(fs.existsSync(path.join(project, ".claude", "skills", "rust")), false);
  for (const directory of [".agents", ".claude"]) {
    assert.equal(fs.existsSync(path.join(project, directory, "skills", "python-tooling", "SKILL.md")), true);
  }
  assert.equal(skipped.result.added.includes("rust"), false);
  assert.equal(skipped.result.replaced.length, 0);

  const replaced = syncProjectSkills(project, ["rust", "python"], "replace", checkout);
  assert.match(fs.readFileSync(rust, "utf8"), /name: rust/);
  assert.equal(replaced.result.replaced.includes("rust"), true);
});

test("project skill planning prevalidates the project and every selected source", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  assert.throws(() => planProjectSkills(path.join(base, "missing"), ["rust"], checkout), /existing directory/);

  const project = path.join(base, "project");
  fs.mkdirSync(project);
  assert.throws(() => planProjectSkills(project, [], checkout), /at least one skill pack/);
  const target = path.join(project, ".agents", "skills", "custom", "SKILL.md");
  write(target, "custom\n");
  fs.rmSync(path.join(checkout, "skills", "domain", "rust"), { recursive: true });
  assert.throws(() => planProjectSkills(project, ["rust"], checkout), /Missing Kirin skill source/);
  assert.equal(fs.readFileSync(target, "utf8"), "custom\n");
});

test("project skill staging failure leaves selected targets and custom content unchanged", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  const rust = path.join(project, ".agents", "skills", "rust", "SKILL.md");
  write(rust, "old rust\n");
  write(path.join(project, ".agents", "skills", "custom", "SKILL.md"), "custom\n");

  const operations = {
    copy(source, target) {
      if (path.basename(source) === "rust") throw new Error("later copy failed");
      fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true });
    },
  };
  assert.throws(() => syncProjectSkills(project, ["python", "rust"], "replace", checkout, operations), /later copy failed/);
  assert.equal(fs.readFileSync(rust, "utf8"), "old rust\n");
  assert.equal(fs.readFileSync(path.join(project, ".agents", "skills", "custom", "SKILL.md"), "utf8"), "custom\n");
  for (const directory of [".agents", ".claude"]) {
    assert.equal(fs.existsSync(path.join(project, directory, "skills", "python-tooling")), false);
  }
});

test("failed rollback retains staging with old targets and reports both failures", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  fs.mkdirSync(project);
  const target = path.join(fs.realpathSync(project), ".agents", "skills", "rust");
  write(path.join(target, "SKILL.md"), "old rust\n");
  const operations = {
    rename(source, destination) {
      if (source.endsWith(`${path.sep}tree`) && destination === target) throw new Error("swap failed");
      if (source.endsWith(`${path.sep}previous`) && destination === target) throw new Error("rollback failed");
      fs.renameSync(source, destination);
    },
  };

  let failure;
  try {
    syncProjectSkills(project, ["rust"], "replace", checkout, operations);
  } catch (error) {
    failure = error;
  }
  assert.equal(failure.name, "AggregateError");
  assert.deepEqual(failure.errors.map((error) => error.message), ["swap failed", "rollback failed"]);
  assert.match(failure.message, /Retained staging:/);
  assert.equal(failure.staging.length, 2);
  const retained = failure.staging.find((staging) => fs.existsSync(path.join(staging, "previous")));
  assert.equal(fs.readFileSync(path.join(retained, "previous", "SKILL.md"), "utf8"), "old rust\n");
  assert.match(fs.readFileSync(path.join(retained, "tree", "SKILL.md"), "utf8"), /name: rust/);
});

test("project skill ancestors cannot escape the canonical project root", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const outside = path.join(base, "outside");
  fs.mkdirSync(outside);

  for (const directory of [".agents", ".claude"]) {
    const project = path.join(base, `${directory.slice(1)}-project`);
    fs.mkdirSync(project);
    fs.symlinkSync(outside, path.join(project, directory), "dir");
    assert.throws(() => planProjectSkills(project, ["rust"], checkout), /resolves outside/);
    assert.equal(fs.existsSync(path.join(outside, "skills", "rust")), false);

    fs.rmSync(path.join(project, directory));
    fs.mkdirSync(path.join(project, directory));
    fs.symlinkSync(outside, path.join(project, directory, "skills"), "dir");
    assert.throws(() => planProjectSkills(project, ["rust"], checkout), /resolves outside/);
  }
});

test("a selected skill symlink is replaced without following it", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  const managed = path.join(base, "managed-rust");
  write(path.join(managed, "SKILL.md"), "managed\n");
  fs.mkdirSync(path.join(project, ".agents", "skills"), { recursive: true });
  const target = path.join(project, ".agents", "skills", "rust");
  fs.symlinkSync(managed, target, "dir");

  assert.deepEqual(planProjectSkills(project, ["rust"], checkout).collisions.map((skill) => skill.name), ["rust"]);
  syncProjectSkills(project, ["rust"], "replace", checkout);
  assert.equal(fs.lstatSync(target).isSymbolicLink(), false);
  assert.match(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), /name: rust/);
  assert.equal(fs.readFileSync(path.join(managed, "SKILL.md"), "utf8"), "managed\n");
});

test("project sync preserves paths resembling its former staging names", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  const oldStaging = path.join(project, ".agents", "skills", `rust.kirin-${process.pid}-0`);
  write(path.join(oldStaging, "SKILL.md"), "keep\n");

  syncProjectSkills(project, ["rust"], "replace", checkout);
  assert.equal(fs.readFileSync(path.join(oldStaging, "SKILL.md"), "utf8"), "keep\n");
});

test("each run rebuilds both skill roots from the package alone", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];

  // Whatever was there before — an older layout's symlink, a hand-written skill,
  // an opt-in domain skill — does not survive a rebuild.
  const staging = path.join(home, ".local", "share", "kirin-pi", "skills");
  write(path.join(staging, "design", "SKILL.md"), "---\nname: design\n---\nstale\n");
  fs.mkdirSync(roots[0], { recursive: true });
  fs.symlinkSync(path.join(staging, "design"), path.join(roots[0], "design"), "dir");
  write(path.join(roots[1], "design", "SKILL.md"), "---\nname: design\n---\nstale\n");
  write(path.join(roots[0], "hand-written", "SKILL.md"), "---\nname: hand-written\n---\n");
  write(path.join(roots[1], "rust", "SKILL.md"), "---\nname: rust\n---\n");

  const first = syncSharedSkills(checkout, home);
  assert.equal(first.count, 18);
  for (const dir of roots) {
    assert.deepEqual(fs.readdirSync(dir).sort(), SHARED_SKILLS);
    assert.equal(fs.lstatSync(path.join(dir, "design")).isDirectory(), true);
    assert.match(fs.readFileSync(path.join(dir, "design", "SKILL.md"), "utf8"), /name: design/);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, "design", "SKILL.md"), "utf8"), /stale/);
  }

  // Workflow and maintenance skill children remain dynamically discovered.
  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "updated\n");
  fs.rmSync(path.join(checkout, "skills", "workflow", "survey"), { recursive: true });
  const second = syncSharedSkills(checkout, home);
  assert.equal(second.count, 17);
  for (const dir of roots) {
    assert.equal(fs.existsSync(path.join(dir, "survey")), false);
    assert.equal(fs.readFileSync(path.join(dir, "design", "updated.txt"), "utf8"), "updated\n");
  }
});

test("a missing selected source fails before either skill destination is rebuilt", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];
  syncSharedSkills(checkout, home);

  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "updated\n");
  fs.rmSync(path.join(checkout, "skills", "domain", "herdr"), { recursive: true });
  assert.throws(() => syncSharedSkills(checkout, home), /Missing Kirin skill source/);
  for (const dir of roots) {
    assert.equal(fs.existsSync(path.join(dir, "herdr")), true);
    assert.equal(fs.existsSync(path.join(dir, "design", "updated.txt")), false);
  }
});

test("a later shared-skill stage failure leaves both old roots intact", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];
  syncSharedSkills(checkout, home);
  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "new\n");

  const operations = {
    copy(source, target) {
      if (path.basename(source) === "herdr" && target.includes(`${path.sep}.claude${path.sep}.kirin-stage-`)) {
        throw new Error("later copy failed");
      }
      fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true });
    },
  };
  assert.throws(() => syncSharedSkills(checkout, home, operations), /later copy failed/);
  for (const root of roots) {
    assert.equal(fs.existsSync(path.join(root, "design", "updated.txt")), false);
    assert.equal(fs.existsSync(path.join(root, "herdr", "SKILL.md")), true);
  }
});

test("a shared-skill swap failure restores both old roots", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];
  syncSharedSkills(checkout, home);
  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "new\n");

  const operations = {
    copy: (source, target) => fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true }),
    rename(source, target) {
      if (source.endsWith(`${path.sep}tree`) && target === roots[1]) throw new Error("second swap failed");
      fs.renameSync(source, target);
    },
  };
  assert.throws(() => syncSharedSkills(checkout, home, operations), /second swap failed/);
  for (const root of roots) {
    assert.equal(fs.existsSync(path.join(root, "design", "updated.txt")), false);
    assert.deepEqual(fs.readdirSync(path.dirname(root)).filter((name) => name.startsWith(".kirin-stage-")), []);
  }
});

test("malformed instructions fail before shared skill roots swap", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  syncSharedSkills(checkout, home);
  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "new\n");
  write(path.join(home, ".agents", "AGENTS.md"), `${START}\n`);

  assert.throws(() => setup({ home, pi: null }, checkout), /mismatched/);
  for (const root of [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")]) {
    assert.equal(fs.existsSync(path.join(root, "design", "updated.txt")), false);
  }
});

test("Claude imports canonical Pi AGENTS while custom text survives", () => {
  const home = tempDir();
  const piAgents = path.join(home, ".pi", "agent", "AGENTS.md");
  write(piAgents, `${WORKFLOW}\n\n<!-- kirin-ratchet:start -->\n## Earned\n\n- Keep me.\n<!-- kirin-ratchet:end -->\n`);
  write(path.join(home, ".claude", "CLAUDE.md"), `${WORKFLOW}\n\nCustom Claude note.\n`);

  const first = installInstructions(home, "run-1", true);
  // Nothing to back up: the Pi file already held exactly what would be written,
  // so it is left alone. The old layout backed it up regardless, because turning
  // a file into a symlink destroyed it even when the content matched.
  assert.equal(first.backups.length, 0);
  const canonical = path.join(home, ".agents", "AGENTS.md");
  // Real files, not links: editors and agent tooling refuse to write through a
  // symlink, so every instruction target is a copy of the canonical file.
  for (const copy of [path.join(home, ".claude", "AGENTS.md"), piAgents]) {
    assert.equal(fs.lstatSync(copy).isSymbolicLink(), false);
    assert.equal(fs.readFileSync(copy, "utf8"), fs.readFileSync(canonical, "utf8"));
  }
  const claude = fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8");
  assert.equal(claude, "@AGENTS.md\n\nCustom Claude note.\n");
  const shared = fs.readFileSync(canonical, "utf8");
  assert.equal((shared.match(new RegExp(START, "g")) ?? []).length, 1);
  assert.match(shared, /Keep me\./);

  installInstructions(home, "run-2", true);
  assert.equal(fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"), claude);
});

test("instruction copies replace a managed symlink and back it up", () => {
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

  const result = installInstructions(home, "run-1", true);

  // AGENTS.md becomes a real file. The previous link is preserved in a backup
  // rather than followed, so the file it pointed at is left untouched.
  assert.equal(fs.lstatSync(piLink).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(managedPi, "utf8"), "Pi custom.\n");
  assert.equal(fs.statSync(managedPi).mode & 0o777, 0o640);
  assert.equal(result.backups.length > 0, true);

  // CLAUDE.md is still written through its link — that path is a merge of user
  // text, not a copy of the canonical file, so a dotfile manager keeps owning it.
  assert.equal(fs.lstatSync(claudeLink).isSymbolicLink(), true);
  assert.equal(fs.statSync(managedClaude).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(managedClaude, "utf8"), "@AGENTS.md\n\nClaude custom.\n");
});

test("a second run rewrites a hand-edited copy from the canonical file", () => {
  const home = tempDir();
  installInstructions(home, "run-1", true);
  const claudeAgents = path.join(home, ".claude", "AGENTS.md");
  fs.writeFileSync(claudeAgents, "hand edited, will not survive\n");

  installInstructions(home, "run-2", true);
  assert.equal(
    fs.readFileSync(claudeAgents, "utf8"),
    fs.readFileSync(path.join(home, ".agents", "AGENTS.md"), "utf8"),
  );
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

test("Claude settings merge preserves unrelated hooks and is idempotent", () => {
  const current = {
    model: "opus",
    hooks: {
      PreToolUse: [
        { matcher: "*", hooks: [{ type: "command", command: "other pre-hook" }] },
        { matcher: "Bash", hooks: [{ type: "command", command: "bun \"$HOME/.claude/kirin/hooks/claude-guard.cjs\"" }] },
      ],
      Stop: [{ matcher: "*", hooks: [{ type: "command", command: "other stop-hook" }] }],
    },
  };

  const merged = mergeClaudeSettings(current);
  assert.equal(merged.model, "opus");
  assert.deepEqual(merged.hooks.Stop, current.hooks.Stop);
  assert.equal(JSON.stringify(merged).match(/kirin\/hooks\/claude-guard/g).length, 1);
  assert.equal(JSON.stringify(merged).match(/kirin\/hooks\/install/g).length, 1);
  assert.deepEqual(mergeClaudeSettings(merged), merged);
});

test("invalid Claude settings fail before setup mutates home", () => {
  for (const [value, message] of [
    [[], /Claude settings must be a JSON object/],
    [{ hooks: { PreToolUse: {} } }, /hooks\.PreToolUse must be an array/],
    [{ hooks: { PreToolUse: [{ matcher: "Bash", hooks: "bad" }] } }, /hook entry must contain a hooks array/],
    [{ hooks: { PreToolUse: [{ hooks: [null] }] } }, /hook definition must be a JSON object/],
  ]) {
    const home = tempDir();
    const settings = path.join(home, ".claude", "settings.json");
    write(settings, `${JSON.stringify(value)}\n`);
    assert.throws(() => setup({ home, pi: null }, root), message);
    assert.deepEqual(filesUnder(home), [settings]);
  }
});

test("setup installs durable Claude hooks and preserves settings through a symlink", () => {
  const home = tempDir();
  const managed = path.join(home, "managed", "settings.json");
  const settings = path.join(home, ".claude", "settings.json");
  write(managed, JSON.stringify({ theme: "dark", hooks: { Stop: [] } }, null, 2) + "\n");
  fs.chmodSync(managed, 0o640);
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.symlinkSync(managed, settings);

  const first = setup({ home, pi: null }, root);
  assert.equal(fs.lstatSync(settings).isSymbolicLink(), true);
  assert.equal(fs.statSync(managed).mode & 0o777, 0o640);
  const installed = JSON.parse(fs.readFileSync(managed, "utf8"));
  assert.equal(installed.theme, "dark");
  assert.deepEqual(installed.hooks.Stop, []);
  assert.equal(JSON.stringify(installed).match(/\.claude\/kirin\/hooks/g).length, 2);
  assert.equal(first.backups.some((file) => file.endsWith("settings.json")), true);

  assert.equal(fs.existsSync(path.join(home, ".agents", "skills", "design", "SKILL.md")), true);
  const runtime = path.join(home, ".claude", "kirin");
  for (const file of ["chatgpt-export.ts", "guard-policy.cjs", "hooks/claude-guard.cjs", "hooks/install.cjs"]) {
    assert.equal(fs.existsSync(path.join(runtime, file)), true, file);
  }
  const blocked = spawnSync(process.execPath, [path.join(runtime, "hooks", "claude-guard.cjs")], {
    input: JSON.stringify({ tool_input: { command: "git add ." } }),
    encoding: "utf8",
  });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /Blocked/);

  const second = setup({ home, pi: null }, root);
  assert.equal(second.backups.length, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(managed, "utf8")), installed);
});

test("project setup changes only selected project skills and validates collisions", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  fs.mkdirSync(project);
  write(path.join(project, ".agents", "skills", "rust", "SKILL.md"), "custom\n");

  assert.throws(() => setup({ home, scope: "project", project, packs: ["rust"], pi: null }, checkout), /collisions require --yes/);
  assert.equal(fs.existsSync(path.join(home, ".claude")), false);
  assert.equal(fs.readFileSync(path.join(project, ".agents", "skills", "rust", "SKILL.md"), "utf8"), "custom\n");

  const result = setup({ home, scope: "project", project, packs: ["rust"], yes: true, pi: null }, checkout);
  assert.equal(result.scope, "project");
  for (const directory of [".agents", ".claude"]) {
    assert.match(fs.readFileSync(path.join(project, directory, "skills", "rust", "SKILL.md"), "utf8"), /name: rust/);
  }
  assert.equal(fs.existsSync(path.join(home, ".claude")), false);
});

test("spawned CLI mirrors global core and project selections without a TTY", () => {
  const base = tempDir();
  const globalHome = path.join(base, "global-home");
  const global = spawnSync(process.execPath, [script, "--scope", "global", "--yes"], {
    cwd: root,
    env: { ...process.env, HOME: globalHome, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  assert.equal(global.status, 0, global.stderr);
  for (const directory of [".agents", ".claude"]) {
    const skillRoot = path.join(globalHome, directory, "skills");
    assert.equal(fs.readdirSync(skillRoot).length, 18);
    assert.equal(fs.existsSync(path.join(skillRoot, "rust", "SKILL.md")), false);
  }

  const project = path.join(base, "project");
  fs.mkdirSync(project);
  const projectHome = path.join(base, "project-home");
  const selected = spawnSync(process.execPath, [script, "--scope", "project", "--project", project, "--packs", "rust", "--yes"], {
    cwd: root,
    env: { ...process.env, HOME: projectHome, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  assert.equal(selected.status, 0, selected.stderr);
  for (const directory of [".agents", ".claude"]) {
    assert.equal(fs.existsSync(path.join(project, directory, "skills", "rust", "SKILL.md")), true);
  }
  assert.equal(fs.existsSync(path.join(projectHome, ".claude")), false);

  write(path.join(project, ".agents", "skills", "rust", "SKILL.md"), "custom\n");
  const collision = spawnSync(process.execPath, [script, "--scope", "project", "--project", project, "--packs", "rust"], {
    cwd: root,
    env: { ...process.env, HOME: projectHome, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  assert.equal(collision.status, 1);
  assert.match(collision.stderr, /collisions require --yes/);
  assert.equal(fs.readFileSync(path.join(project, ".agents", "skills", "rust", "SKILL.md"), "utf8"), "custom\n");
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
  assert.equal(fs.readdirSync(path.join(home, ".agents", "skills")).length, 18);
  assert.equal(fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  const claudeAgents = path.join(home, ".claude", "AGENTS.md");
  assert.equal(fs.lstatSync(claudeAgents).isSymbolicLink(), false);
  assert.equal(
    fs.readFileSync(claudeAgents, "utf8"),
    fs.readFileSync(path.join(home, ".agents", "AGENTS.md"), "utf8"),
  );
});

test("zero-argument CLI adds Pi-specific setup only when Pi is in PATH", () => {
  const home = tempDir();
  write(path.join(home, ".pi", "agent", "agents", "reviewer.md"), "custom reviewer\n");
  // A decoy in Pi's own clone: presets must come from the running package, not from there.
  const piClone = path.join(home, ".pi", "agent", "git", "github.com", "bryan824", "kirin-pi");
  write(path.join(piClone, "agents", "reviewer.md"), "decoy reviewer\n");

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
  assert.equal(fs.readdirSync(path.join(home, ".agents", "skills")).length, 18);
  assert.equal(fs.readdirSync(path.join(home, ".pi", "agent", "agents")).filter((name) => name.endsWith(".md")).length, 7);
  const reviewerBackups = filesUnder(path.join(home, ".pi", "agent", "kirin-backups"))
    .filter((file) => path.basename(file) === "reviewer.md");
  assert.equal(reviewerBackups.length, 1);
  assert.equal(fs.readFileSync(reviewerBackups[0], "utf8"), "custom reviewer\n");
  assert.equal(
    fs.readFileSync(path.join(home, ".pi", "agent", "agents", "reviewer.md"), "utf8"),
    fs.readFileSync(path.join(root, "agents", "reviewer.md"), "utf8"),
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
