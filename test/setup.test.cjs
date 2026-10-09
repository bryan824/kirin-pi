const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "setup.cjs");
const {
  KIRIN_SOURCE,
  SKILL_PACKS,
  START,
  SUBAGENT_CONFIG,
  WORKFLOW,
  applySkillChanges,
  expandPacks,
  installBlock,
  installInstructions,
  mergeClaudeSettings,
  mergeSubagentConfig,
  namedSkillSources,
  packageActions,
  parse,
  planSkills,
  setup,
  syncSharedSkills,
} = require("../setup.cjs");

const planProjectSkills = (project, packs, checkout) => planSkills(project, expandPacks(packs, checkout));

function syncProjectSkills(project, packs, decision, checkout, operations) {
  const plan = planProjectSkills(project, packs, checkout);
  return { plan, result: applySkillChanges(plan, decision, operations) };
}

const WORKFLOW_SKILLS = [
  "architecture", "commit", "debug", "design", "implement",
  "plan", "prototype", "research", "survey", "verify", "wait-what",
];
const MAINTENANCE_SKILLS = ["agents-md", "project-memory", "retro", "session-close", "harness", "write-skill"];
const SHARED_SKILLS = [...WORKFLOW_SKILLS, ...MAINTENANCE_SKILLS.filter((name) => name !== "harness"), "chatgpt-export", "herdr"].sort();

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

function snapshotTree(base) {
  return fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const file = path.join(base, entry.name);
    if (entry.isDirectory()) return [[entry.name, ["directory"]], ...snapshotTree(file).map(([name, data]) => [path.join(entry.name, name), data])];
    return [[entry.name, entry.isSymbolicLink() ? ["link", fs.readlinkSync(file)] : ["file", fs.readFileSync(file, "utf8")]]];
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
  return checkout;
}

test("individual project installation mirrors the complete skill without running setup", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const project = path.join(base, "project");
  fs.mkdirSync(project);
  write(path.join(home, ".claude", "settings.json"), "not installer input\n");
  write(path.join(home, ".agents", "skills", "custom", "SKILL.md"), "keep\n");
  const fakePi = path.join(home, "bin", "pi");
  write(fakePi, "#!/bin/sh\nprintf called >> \"$HOME/pi-calls\"\n");
  fs.chmodSync(fakePi, 0o755);
  const before = filesUnder(home).map((file) => [file, fs.readFileSync(file, "utf8")]);

  const result = spawnSync(process.execPath, [script, "install", "harness", "--scope", "project"], {
    cwd: project,
    env: { ...process.env, HOME: home, PATH: "", PI_BIN: fakePi },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const source = path.join(root, "skills", "maintenance", "harness");
  const sourceFiles = filesUnder(source).map((file) => path.relative(source, file)).sort();
  for (const directory of [".agents", ".claude"]) {
    const destination = path.join(project, directory, "skills", "harness");
    assert.deepEqual(fs.readdirSync(path.dirname(destination)), ["harness"]);
    assert.deepEqual(filesUnder(destination).map((file) => path.relative(destination, file)).sort(), sourceFiles);
    for (const file of sourceFiles) {
      assert.deepEqual(fs.readFileSync(path.join(destination, file)), fs.readFileSync(path.join(source, file)), file);
    }
    assert.equal(fs.existsSync(path.join(project, directory, "AGENTS.md")), false);
  }
  assert.equal(fs.existsSync(path.join(project, ".claude", "settings.json")), false);
  assert.deepEqual(filesUnder(home).map((file) => [file, fs.readFileSync(file, "utf8")]), before);
});

test("standalone design ships its decision reference and rejects the retired install name without mutation", (context) => {
  const base = tempDir(), project = path.join(base, "project"), home = path.join(base, "home");
  context.after(() => fs.rmSync(base, { recursive: true, force: true }));
  fs.mkdirSync(project);
  const invoke = (name) => spawnSync(process.execPath, [script, "install", name, "--scope", "project"], {
    cwd: project, env: { ...process.env, HOME: home, PATH: "" }, encoding: "utf8",
  });
  const installed = invoke("design");
  assert.equal(installed.status, 0, installed.stderr);
  for (const host of [".agents", ".claude"]) {
    const skillRoot = path.join(project, host, "skills");
    assert.deepEqual(fs.readdirSync(skillRoot), ["design"]);
    assert.deepEqual(fs.readFileSync(path.join(skillRoot, "design", "references", "DECISIONS.md")),
      fs.readFileSync(path.join(root, "skills", "workflow", "design", "references", "DECISIONS.md")));
  }
  const before = snapshotTree(project);
  const retired = invoke("decision-map");
  assert.notEqual(retired.status, 0);
  assert.match(retired.stderr, /Unknown Kirin skill/);
  assert.deepEqual(snapshotTree(project), before);
});

test("standalone frontend, prototype, Herdr and maintenance installs retain complete local guidance", (context) => {
  // Installation/payload contract only; no consuming model or browser is run.
  const base = tempDir();
  context.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const names = [...SKILL_PACKS.frontend.map((entry) => path.basename(entry.source)), "prototype", "herdr", ...MAINTENANCE_SKILLS];
  for (const name of names) {
    const project = path.join(base, name), home = path.join(base, "home");
    fs.mkdirSync(project);
    const result = spawnSync(process.execPath, [script, "install", name, "--scope", "project"], {
      cwd: project, env: { ...process.env, HOME: home, PATH: "" }, encoding: "utf8",
    });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    const group = MAINTENANCE_SKILLS.includes(name) ? "maintenance" : name === "prototype" ? "workflow" : "domain";
    const source = path.join(root, "skills", group, name);
    for (const host of [".agents", ".claude"]) {
      const destination = path.join(project, host, "skills", name);
      assert.deepEqual(fs.readdirSync(path.dirname(destination)), [name]);
      const files = filesUnder(source).map((file) => path.relative(source, file)).sort();
      assert.deepEqual(filesUnder(destination).map((file) => path.relative(destination, file)).sort(), files);
      for (const file of files) assert.deepEqual(fs.readFileSync(path.join(destination, file)), fs.readFileSync(path.join(source, file)), `${name}/${file}`);
      const text = fs.readFileSync(path.join(destination, "SKILL.md"), "utf8").replace(/\s+/g, " ");
      if (name === "frontend-design") {
        assert.ok(fs.existsSync(path.join(destination, "references", "REVIEW.md")));
        assert.match(text, /Missing siblings are not an installation requirement/);
      } else if (name === "prototype") {
        assert.match(text, /Throwaway status does not waive/);
        assert.ok(fs.existsSync(path.join(destination, "LOGIC.md")));
        assert.ok(fs.existsSync(path.join(destination, "UI.md")));
      } else if (name === "herdr") {
        assert.match(text, /installed CLI.*authority/);
        assert.match(text, /artifact.*write authority/);
        assert.match(text, /Canceling or timing out a wait does not stop/);
      } else if (group === "domain") {
        assert.equal(fs.existsSync(path.join(destination, "..", "frontend-design")), false);
        assert.match(text, /When `frontend-design` is installed/);
        assert.match(text, /Otherwise report focused/);
        assert.match(text, /Review-only requests stay read-only/);
        assert.match(text, /do not install siblings/);
      }
    }
    assert.deepEqual(fs.readdirSync(project).sort(), [".agents", ".claude"]);
    assert.equal(fs.existsSync(path.join(project, ".claude", "settings.json")), false);
    assert.equal(fs.existsSync(home), false);
  }
});

test("individual global installation changes only the named skill trees", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const project = path.join(base, "project");
  fs.mkdirSync(project);
  for (const directory of [".agents", ".claude"]) {
    write(path.join(home, directory, "skills", "custom", "SKILL.md"), "keep custom\n");
  }
  write(path.join(home, ".claude", "settings.json"), "not installer input\n");
  write(path.join(home, ".pi", "agent", "settings.json"), "not installer input either\n");
  const fakePi = path.join(home, "bin", "pi");
  write(fakePi, "#!/bin/sh\nprintf called >> \"$HOME/pi-calls\"\n");
  fs.chmodSync(fakePi, 0o755);
  const before = filesUnder(home).map((file) => [file, fs.readFileSync(file, "utf8")]);
  const invoke = () => spawnSync(process.execPath, [script, "install", "debug", "verify", "debug", "--scope", "global"], {
    cwd: project,
    env: { ...process.env, HOME: home, PATH: "", PI_BIN: fakePi },
    encoding: "utf8",
  });
  const result = invoke();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /4 skill target\(s\) added, 0 replaced/);
  for (const directory of [".agents", ".claude"]) {
    const destination = path.join(home, directory, "skills");
    assert.deepEqual(fs.readdirSync(destination).sort(), ["custom", "debug", "verify"]);
    for (const name of ["debug", "verify"]) {
      assert.deepEqual(
        fs.readFileSync(path.join(destination, name, "SKILL.md")),
        fs.readFileSync(path.join(root, "skills", "workflow", name, "SKILL.md")),
      );
    }
    assert.equal(fs.existsSync(path.join(home, directory, "AGENTS.md")), false);
  }
  for (const [file, contents] of before) assert.equal(fs.readFileSync(file, "utf8"), contents, file);
  assert.equal(fs.existsSync(path.join(home, "pi-calls")), false);
  assert.equal(fs.existsSync(path.join(home, ".claude", "kirin")), false);
  assert.deepEqual(fs.readdirSync(project), []);
  const again = invoke();
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /0 skill target\(s\) added, 0 replaced, 4 unchanged or skipped/);
});

test("skill collisions require explicit replacement", () => {
  for (const command of [["install", "rust"], ["install", "rust", "python"]]) {
    const base = tempDir();
    const home = path.join(base, "home");
    const project = path.join(base, "project");
    const target = path.join(project, ".agents", "skills", "rust", "SKILL.md");
    write(target, "my rust notes\n");
    const invoke = (flags) => spawnSync(process.execPath, [script, ...command, "--scope", "project", ...flags], {
      cwd: project,
      env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
      encoding: "utf8",
    });
    for (const flags of [[]]) {
      const denied = invoke(flags);
      assert.equal(denied.status, 1, denied.stdout);
      assert.match(denied.stderr, /collisions require --replace/);
      assert.equal(fs.readFileSync(target, "utf8"), "my rust notes\n");
      assert.equal(fs.existsSync(path.join(project, ".claude")), false);
    }
    const replaced = invoke(["--replace"]);
    assert.equal(replaced.status, 0, replaced.stderr);
    for (const directory of [".agents", ".claude"]) {
      assert.equal(
        fs.readFileSync(path.join(project, directory, "skills", "rust", "SKILL.md"), "utf8"),
        fs.readFileSync(path.join(root, "skills", "domain", "rust", "SKILL.md"), "utf8"),
      );
    }
    const identical = invoke([]);
    assert.equal(identical.status, 0, identical.stderr);
    assert.match(identical.stdout, /0 replaced, \d+ unchanged or skipped/);
    assert.equal(fs.existsSync(home), false);
  }
});

test("no-command and help invocations never run setup", () => {
  const home = tempDir();
  const fakePi = path.join(home, "bin", "pi");
  write(fakePi, "#!/bin/sh\nprintf called >> \"$HOME/pi-calls\"\n");
  fs.chmodSync(fakePi, 0o755);
  for (const args of [[], ["--help"], ["install", "--help"], ["setup", "--help"]]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      env: { ...process.env, HOME: home, PI_BIN: fakePi },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /install <skill/);
    assert.match(result.stdout, /setup/);
    assert.deepEqual(filesUnder(home), [fakePi]);
  }
});

test("non-interactive commands never infer a global scope", () => {
  const home = tempDir();
  for (const command of [["setup"], ["install", "debug"]]) {
    const result = spawnSync(process.execPath, [script, ...command], {
      cwd: root,
      env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
      encoding: "utf8",
    });
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /requires --scope/);
    assert.deepEqual(fs.readdirSync(home), []);
  }
});

test("project installation reports existing global copies without migrating them", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const project = path.join(base, "project");
  fs.mkdirSync(project);
  const copies = [".agents/skills", ".claude/skills", ".pi/agent/skills"]
    .map((directory) => path.join(home, directory, "harness", "SKILL.md"));
  for (const file of copies) write(file, "older global audit\n");
  const result = spawnSync(process.execPath, [script, "install", "harness", "--scope", "project"], {
    cwd: project,
    env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /global.*copies/i);
  for (const file of copies) {
    assert.ok(result.stdout.includes(file), file);
    assert.equal(fs.readFileSync(file, "utf8"), "older global audit\n");
  }
  assert.deepEqual(filesUnder(home).sort(), copies.sort());
  assert.equal(fs.existsSync(path.join(project, ".agents", "skills", "harness", "SKILL.md")), true);
});

test("invalid individual selections leave both scopes untouched", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const project = path.join(base, "project");
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  for (const scope of ["global", "project"]) {
    for (const name of ["not-a-skill", "../escape", "frontends"]) {
      const result = spawnSync(process.execPath, [script, "install", "debug", name, "--scope", scope, "--replace"], {
        cwd: project,
        env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
        encoding: "utf8",
      });
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /Unknown Kirin skill/);
      assert.deepEqual(fs.readdirSync(home), []);
      assert.deepEqual(fs.readdirSync(project), []);
    }
  }
  const checkout = fixtureCheckout(base);
  write(path.join(checkout, "skills", "domain", "debug", "SKILL.md"), "duplicate name\n");
  assert.throws(() => namedSkillSources(["debug"], checkout), /Duplicate Kirin skill name/);
});

test("global commands refuse escaping skill roots before mutation", () => {
  for (const command of [["install", "debug"], ["setup"]]) {
    for (const directory of [".agents", ".claude"]) {
      for (const level of [directory, path.join(directory, "skills")]) {
        const base = tempDir();
        const home = path.join(base, "home");
        const outside = path.join(base, "outside");
        const link = path.join(home, level);
        write(path.join(outside, "sentinel"), "keep outside\n");
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(outside, link, "dir");
        const result = spawnSync(process.execPath, [script, ...command, "--scope", "global", "--replace"], {
          cwd: root,
          env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
          encoding: "utf8",
        });
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, /resolves outside/);
        assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
        assert.deepEqual(fs.readdirSync(home), [directory]);
        assert.deepEqual(fs.readdirSync(outside), ["sentinel"]);
        assert.equal(fs.readFileSync(path.join(outside, "sentinel"), "utf8"), "keep outside\n");
      }
    }
  }
});

test("CLI parsing separates explicit setup from named skill installation", () => {
  const defaults = { help: false, home: os.homedir() };
  assert.deepEqual(parse([]), { ...defaults, help: true });
  assert.deepEqual(parse(["setup", "--scope", "global"]), { ...defaults, command: "setup", scope: "global" });
  assert.deepEqual(parse(["install", "debug", "verify", "debug", "--scope", "project", "--replace"]), {
    ...defaults, command: "install", skills: ["debug", "verify"], scope: "project", replace: true,
  });
  assert.deepEqual(parse(["install", "frontend", "--scope", "project", "--project", "/tmp/kirin"]), {
    ...defaults, command: "install", skills: ["frontend"], scope: "project", project: "/tmp/kirin",
  });
  assert.throws(() => parse(["--scope", "global"]), /explicit `setup`/);
  assert.throws(() => parse(["install", "--scope", "global"]), /at least one skill or pack/);
  assert.throws(() => parse(["install", "debug"]), /requires --scope/);
  assert.throws(() => parse(["setup"]), /requires --scope/);
  assert.throws(() => parse(["setup", "debug", "--scope", "global"]), /takes no names/);
  assert.throws(() => parse(["setup", "--scope", "project"]), /setup is global only/);
  assert.throws(() => parse(["install", "debug", "--scope", "local"]), /scope must be `global` or `project`/);
  assert.throws(() => parse(["install", "debug", "--scope", "global", "--project", "/tmp/kirin"]), /requires --scope project/);
  for (const retired of ["--packs", "--yes", "--global"]) {
    assert.throws(() => parse(["setup", "--scope", "global", retired, ...(retired === "--packs" ? ["rust"] : [])]), /Unknown option/);
  }
  assert.throws(() => parse(["bootstrap", "workflow"]), /explicit `setup`/);
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
  assert.ok(packed.every((name) => shipped.includes(name)), "every packed skill is shipped");
  assert.deepEqual(namedSkillSources(shipped).map((skill) => skill.name).sort(), shipped.sort(), "every shipped skill is individually selectable");
  assert.equal(new Set(packed).size, packed.length, "no skill belongs to two packs");
  const checkout = fixtureCheckout(tempDir());
  write(path.join(checkout, "skills", "workflow", "future-workflow", "SKILL.md"), "---\nname: future-workflow\ndescription: test\n---\n");
  write(path.join(checkout, "skills", "maintenance", "future-maintenance", "SKILL.md"), "---\nname: future-maintenance\ndescription: test\n---\n");
  assert.deepEqual(
    expandPacks(["core"], checkout).map((skill) => skill.name).sort(),
    [...SHARED_SKILLS, "future-workflow"].sort(),
  );
  assert.deepEqual(namedSkillSources(["rust", "teaching", "python"]).map((skill) => skill.name), ["rust", "teach", "python-tooling"], "pack aliases resolve after skill names");
  assert.deepEqual(namedSkillSources(["frontend", "frontend-color"]).map((skill) => skill.name).sort(), expandPacks(["frontend"]).map((skill) => skill.name).sort());
  assert.deepEqual(namedSkillSources(["harness", "future-maintenance"], checkout).map((skill) => skill.name), ["harness", "future-maintenance"]);
});

test("package plan tracks latest Kirin, Nico and web access", () => {
  assert.deepEqual(packageActions({ packages: [] }).map((item) => item.action), ["install", "install", "install"]);

  const current = packageActions({ packages: [KIRIN_SOURCE, "npm:pi-subagents", "npm:pi-web-access"] });
  assert.deepEqual(current.map((item) => item.action), ["update", "update", "update"]);

  const pinned = packageActions({ packages: [KIRIN_SOURCE, "npm:pi-subagents@0.47.1", "npm:pi-web-access"] });
  assert.deepEqual(pinned, [
    { source: KIRIN_SOURCE, action: "update" },
    { source: "npm:pi-subagents", action: "install" },
    { source: "npm:pi-subagents", action: "update" },
    { source: "npm:pi-web-access", action: "update" },
  ]);

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

test("a target created during staging is not silently replaced", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  fs.mkdirSync(project);
  const target = path.join(project, ".agents", "skills", "rust", "SKILL.md");
  const operations = {
    copy(source, destination) {
      fs.cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
      if (destination.includes(`${path.sep}.claude${path.sep}`)) write(target, "arrived during staging\n");
    },
  };
  assert.throws(() => syncProjectSkills(project, ["rust"], "skip", checkout, operations), /appeared during installation/);
  assert.equal(fs.readFileSync(target, "utf8"), "arrived during staging\n");
  assert.equal(fs.existsSync(path.join(project, ".claude", "skills", "rust")), false);
});

test("nested skill roots are rejected before either host or setup configuration changes", () => {
  const commands = [
    { command: ["install", "debug"], scope: "project", name: "debug" },
    { command: ["install", "debug"], scope: "global", name: "debug" },
    { command: ["install", "rust"], scope: "project", name: "rust" },
    { command: ["setup"], scope: "global", name: "debug" },
  ];
  for (const { command, scope, name } of commands) {
    for (const [outer, inner] of [[".agents", ".claude"], [".claude", ".agents"]]) {
      for (const layout of ["direct", "nested", "indirect", "missing-root", "bridge"]) {
        const base = tempDir();
        try {
          const home = path.join(base, "home");
          const project = path.join(base, "project");
          fs.mkdirSync(project);
          const fakePi = path.join(home, "bin", "pi");
          write(fakePi, "#!/bin/sh\nprintf called >> \"$HOME/pi-calls\"\n");
          fs.chmodSync(fakePi, 0o755);
          const destination = scope === "global" ? home : project;
          const selected = path.join(destination, outer, "skills", name);
          const storage = layout === "indirect" ? path.join(destination, "storage") : selected;
          write(path.join(storage, "SKILL.md"), "old selected skill\n");
          if (layout === "indirect") {
            fs.mkdirSync(path.dirname(selected), { recursive: true });
            fs.symlinkSync(storage, selected, "dir");
          }
          if (layout === "missing-root") {
            fs.symlinkSync(selected, path.join(destination, inner), "dir");
          } else {
            const nested = layout === "nested" ? path.join(selected, "nested")
              : layout === "bridge" ? path.join(selected, "bridge") : selected;
            if (layout === "bridge") {
              const storage = path.join(destination, "storage");
              fs.mkdirSync(storage);
              fs.symlinkSync(storage, nested, "dir");
            }
            write(path.join(nested, "custom", "SKILL.md"), "keep custom\n");
            fs.mkdirSync(path.join(destination, inner));
            fs.symlinkSync(nested, path.join(destination, inner, "skills"), "dir");
          }
          const before = snapshotTree(base);
          const result = spawnSync(process.execPath, [script, ...command, "--scope", scope, "--replace"], {
            cwd: project,
            env: { ...process.env, HOME: home, PATH: "", PI_BIN: fakePi },
            encoding: "utf8",
          });
          const scenario = `${command.join(" ")} ${scope} ${outer} ${layout}`;
          assert.equal(result.status, 1, `${scenario}: ${result.stdout}`);
          assert.match(result.stderr, /traverses selected skill tree/, scenario);
          assert.deepEqual(snapshotTree(base), before, scenario);
        } finally {
          fs.rmSync(base, { recursive: true, force: true });
        }
      }
    }
  }
});

test("root traversal rejects relative detours, link/.. paths, and self-dependent roots", () => {
  for (const layout of ["chain", "dots", "self-root", "case-alias"]) {
    const base = tempDir();
    try {
      const home = path.join(base, "home");
      const project = path.join(base, "project");
      const storage = path.join(project, "storage");
      const agentRoot = path.join(project, ".agents", "skills");
      const claudeRoot = path.join(project, ".claude", "skills");
      fs.mkdirSync(home);
      let selected = path.join(layout === "self-root" ? storage : agentRoot, "debug");
      write(path.join(selected, "SKILL.md"), "old debug\n");
      if (layout === "case-alias") {
        const upper = path.join(path.dirname(selected), "DEBUG");
        if (fs.existsSync(upper)) {
          fs.renameSync(selected, upper);
          selected = upper;
        } else fs.symlinkSync(selected, upper, "dir");
      }
      const bridge = path.join(selected, "bridge");
      const linked = layout === "dots" ? path.join(storage, "inner") : storage;
      fs.mkdirSync(linked, { recursive: true });
      fs.symlinkSync(path.relative(selected, linked), bridge, "dir");
      if (layout === "self-root") {
        fs.mkdirSync(path.dirname(agentRoot));
        fs.symlinkSync(bridge, agentRoot, "dir");
      } else {
        fs.mkdirSync(path.dirname(claudeRoot));
        let route = bridge;
        if (layout === "chain") {
          route = path.join(project, "alias");
          fs.symlinkSync(path.relative(project, bridge), route, "dir");
        } else if (layout === "dots") {
          fs.mkdirSync(path.join(storage, "root"));
          route = `${bridge}/../root`;
        } else route = path.join(path.dirname(selected), "DEBUG", "bridge");
        // Do not normalize link/.. away before the filesystem resolves it.
        fs.symlinkSync(layout === "dots" ? route : path.relative(path.dirname(claudeRoot), route), claudeRoot, "dir");
      }
      const affectedRoot = layout === "self-root" ? agentRoot : claudeRoot;
      assert.equal(fs.statSync(affectedRoot).isDirectory(), true, layout);
      write(path.join(affectedRoot, "custom", "SKILL.md"), "keep custom\n");
      const before = snapshotTree(base);
      const result = spawnSync(process.execPath, [script, "install", "debug", "--scope", "project", "--replace"], {
        cwd: project,
        env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
        encoding: "utf8",
      });
      assert.equal(result.status, 1, `${layout}: ${result.stdout}`);
      assert.match(result.stderr, /traverses selected skill tree/, layout);
      assert.deepEqual(snapshotTree(base), before, layout);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  }
});

test("aliased skill roots inside the selected scope remain supported", () => {
  const home = tempDir();
  const shared = path.join(home, "shared-skills");
  write(path.join(shared, "custom", "SKILL.md"), "keep\n");
  for (const directory of [".agents", ".claude"]) {
    fs.mkdirSync(path.join(home, directory));
    fs.symlinkSync(shared, path.join(home, directory, "skills"), "dir");
  }
  const result = spawnSync(process.execPath, [script, "install", "debug", "--scope", "global"], {
    cwd: root,
    env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  for (const directory of [".agents", ".claude"]) {
    const skillRoot = path.join(home, directory, "skills");
    assert.equal(fs.lstatSync(skillRoot).isSymbolicLink(), true);
    assert.deepEqual(fs.readdirSync(skillRoot).sort(), ["custom", "debug"]);
    assert.equal(fs.readFileSync(path.join(skillRoot, "custom", "SKILL.md"), "utf8"), "keep\n");
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

test("a stale skill plan cannot follow redirected ancestors outside its scope", () => {
  const base = tempDir();
  const checkout = fixtureCheckout(base);
  const project = path.join(base, "project");
  const outside = path.join(base, "outside");
  fs.mkdirSync(project);
  fs.mkdirSync(outside);
  const plan = planProjectSkills(project, ["rust"], checkout);
  fs.symlinkSync(outside, path.join(project, ".agents"), "dir");
  assert.throws(() => applySkillChanges(plan, "skip"), /resolves outside/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.existsSync(path.join(project, ".claude")), false);
});

test("a stale skill plan rejects newly nested host roots before staging", () => {
  for (const bridge of [false, true]) {
    const base = tempDir();
    try {
      const checkout = fixtureCheckout(base);
      const project = path.join(base, "project");
      const selected = path.join(project, ".agents", "skills", "rust");
      write(path.join(selected, "SKILL.md"), "old rust\n");
      const plan = planProjectSkills(project, ["rust"], checkout);
      const nestedRoot = path.join(project, ".claude", "skills");
      fs.mkdirSync(path.dirname(nestedRoot));
      const route = bridge ? path.join(selected, "bridge") : selected;
      if (bridge) {
        const storage = path.join(project, "storage");
        fs.mkdirSync(storage);
        fs.symlinkSync(storage, route, "dir");
      }
      fs.symlinkSync(route, nestedRoot, "dir");
      write(path.join(nestedRoot, "custom", "SKILL.md"), "keep custom\n");
      const before = snapshotTree(project);
      assert.throws(() => applySkillChanges(plan, "replace"), /traverses selected skill tree/);
      assert.deepEqual(snapshotTree(project), before);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  }
});

test("selected skill symlinks, including broken links, are replaced without writing through them", () => {
  for (const kind of ["existing", "missing", "loop"]) {
    const base = tempDir();
    try {
      const checkout = fixtureCheckout(base);
      const project = path.join(base, "project");
      const managed = path.join(base, "managed-rust");
      if (kind === "existing") write(path.join(managed, "SKILL.md"), "managed\n");
      fs.mkdirSync(path.join(project, ".agents", "skills"), { recursive: true });
      const target = path.join(project, ".agents", "skills", "rust");
      fs.symlinkSync(kind === "loop" ? target : managed, target, "dir");

      assert.deepEqual(planProjectSkills(project, ["rust"], checkout).collisions.map((skill) => skill.name), ["rust"]);
      syncProjectSkills(project, ["rust"], "replace", checkout);
      assert.equal(fs.lstatSync(target).isSymbolicLink(), false);
      assert.match(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), /name: rust/);
      if (kind === "existing") assert.equal(fs.readFileSync(path.join(managed, "SKILL.md"), "utf8"), "managed\n");
      else assert.equal(fs.existsSync(managed), false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  }
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

test("global core sync preserves unselected skills and excludes harness-only audit", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];
  const oldSource = path.join(home, "old-design");
  write(path.join(oldSource, "SKILL.md"), "stale design\n");
  fs.mkdirSync(roots[0], { recursive: true });
  fs.symlinkSync(oldSource, path.join(roots[0], "design"), "dir");
  write(path.join(roots[1], "design", "SKILL.md"), "stale design\n");
  write(path.join(roots[0], "hand-written", "SKILL.md"), "hand written\n");
  write(path.join(roots[1], "rust", "SKILL.md"), "optional rust\n");
  for (const dir of roots) write(path.join(dir, "decision-map", "SKILL.md"), "preserve retired deployment\n");
  const record = path.join(home, "context", "decision-maps", "old", "map.md");
  write(record, "preserve existing decisions\n");

  const first = syncSharedSkills(checkout, home, "replace");
  assert.equal(fs.existsSync(path.join(roots[0], "hand-written", "SKILL.md")), true);
  assert.equal(fs.readFileSync(path.join(roots[1], "rust", "SKILL.md"), "utf8"), "optional rust\n");
  assert.equal(fs.readFileSync(path.join(oldSource, "SKILL.md"), "utf8"), "stale design\n");
  assert.equal(first.count, SHARED_SKILLS.length);
  for (const dir of roots) {
    assert.equal(fs.lstatSync(path.join(dir, "design")).isDirectory(), true);
    assert.match(fs.readFileSync(path.join(dir, "design", "SKILL.md"), "utf8"), /name: design/);
    assert.equal(fs.existsSync(path.join(dir, "harness")), false);
    write(path.join(dir, "harness", "SKILL.md"), "previously installed audit\n");
  }

  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "updated\n");
  fs.rmSync(path.join(checkout, "skills", "workflow", "survey"), { recursive: true });
  const second = syncSharedSkills(checkout, home, "replace");
  assert.equal(second.count, SHARED_SKILLS.length - 1);
  for (const dir of roots) {
    assert.equal(fs.existsSync(path.join(dir, "survey", "SKILL.md")), true);
    assert.equal(fs.readFileSync(path.join(dir, "harness", "SKILL.md"), "utf8"), "previously installed audit\n");
    assert.equal(fs.readFileSync(path.join(dir, "design", "updated.txt"), "utf8"), "updated\n");
    assert.equal(fs.readFileSync(path.join(dir, "decision-map", "SKILL.md"), "utf8"), "preserve retired deployment\n");
  }
  assert.equal(fs.readFileSync(record, "utf8"), "preserve existing decisions\n");
});

test("a missing selected source fails before either destination changes", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];
  fs.mkdirSync(home);
  syncSharedSkills(checkout, home);

  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "updated\n");
  fs.rmSync(path.join(checkout, "skills", "domain", "herdr"), { recursive: true });
  assert.throws(() => syncSharedSkills(checkout, home), /Missing Kirin skill source/);
  for (const dir of roots) {
    assert.equal(fs.existsSync(path.join(dir, "herdr")), true);
    assert.equal(fs.existsSync(path.join(dir, "design", "updated.txt")), false);
  }
});

test("a later shared-skill stage failure leaves both old trees intact", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];
  fs.mkdirSync(home);
  syncSharedSkills(checkout, home);
  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "new\n");

  const operations = {
    copy(source, target) {
      if (path.basename(source) === "design" && target.includes(`${path.sep}.claude${path.sep}skills${path.sep}.kirin-stage-`)) {
        throw new Error("later copy failed");
      }
      fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true });
    },
  };
  assert.throws(() => syncSharedSkills(checkout, home, "replace", operations), /later copy failed/);
  for (const root of roots) {
    assert.equal(fs.existsSync(path.join(root, "design", "updated.txt")), false);
    assert.equal(fs.existsSync(path.join(root, "herdr", "SKILL.md")), true);
  }
});

test("a shared-skill swap failure restores both old trees", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  const roots = [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")];
  fs.mkdirSync(home);
  syncSharedSkills(checkout, home);
  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "new\n");

  const operations = {
    copy: (source, target) => fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true }),
    rename(source, target) {
      if (source.endsWith(`${path.sep}tree`) && target === path.join(fs.realpathSync(home), ".claude", "skills", "design")) throw new Error("second swap failed");
      fs.renameSync(source, target);
    },
  };
  assert.throws(() => syncSharedSkills(checkout, home, "replace", operations), /second swap failed/);
  for (const root of roots) {
    assert.equal(fs.existsSync(path.join(root, "design", "updated.txt")), false);
    assert.deepEqual(fs.readdirSync(root).filter((name) => name.startsWith(".kirin-stage-")), []);
  }
});

test("malformed instructions fail before shared skills swap", () => {
  const base = tempDir();
  const home = path.join(base, "home");
  const checkout = fixtureCheckout(base);
  fs.mkdirSync(home);
  syncSharedSkills(checkout, home);
  write(path.join(checkout, "skills", "workflow", "design", "updated.txt"), "new\n");
  write(path.join(home, ".agents", "AGENTS.md"), `${START}\n`);

  assert.throws(() => setup({ home, pi: null, replace: true }, checkout), /mismatched/);
  for (const root of [path.join(home, ".agents", "skills"), path.join(home, ".claude", "skills")]) {
    assert.equal(fs.existsSync(path.join(root, "design", "updated.txt")), false);
  }
});

test("Claude imports canonical AGENTS while custom text survives", () => {
  const home = tempDir();
  const piAgents = path.join(home, ".pi", "agent", "AGENTS.md");
  const canonicalText = `${WORKFLOW}\n\n## Earned\n\n- Keep me.\n`;
  write(path.join(home, ".agents", "AGENTS.md"), canonicalText);
  write(piAgents, canonicalText);
  write(path.join(home, ".claude", "CLAUDE.md"), `${WORKFLOW}\n\nCustom Claude note.\n`);

  const first = installInstructions(home, "run-1", true);
  // Nothing to back up: the Pi file already held exactly what would be written.
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

test("Claude-specific rules survive canonicalization", () => {
  const home = tempDir();
  write(path.join(home, ".claude", "CLAUDE.md"), "## Claude only\n\n- Keep this too.\n");
  installInstructions(home, "run-1", false);
  const claude = fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8");
  assert.match(claude, /^@AGENTS\.md/);
  assert.match(claude, /Keep this too\./);
});

test("workflow block replacement is idempotent", () => {
  const existing = `Before\n\n${WORKFLOW}\n\nAfter\n`;
  assert.equal(installBlock(installBlock(existing)), installBlock(existing));
});

test("Claude settings merge preserves unrelated hooks, drops the retired startup hook and is idempotent", () => {
  const current = {
    model: "opus",
    hooks: {
      PreToolUse: [
        { matcher: "*", hooks: [{ type: "command", command: "other pre-hook" }] },
        { matcher: "Bash", hooks: [{ type: "command", command: "bun \"$HOME/.claude/kirin/hooks/claude-guard.cjs\"" }] },
      ],
      SessionStart: [{ hooks: [{ type: "command", command: 'cd "$CLAUDE_PROJECT_DIR" && bun "$HOME/.claude/kirin/hooks/install.cjs" --ensure' }] }],
      Stop: [{ matcher: "*", hooks: [{ type: "command", command: "other stop-hook" }] }],
    },
  };

  const merged = mergeClaudeSettings(current);
  assert.equal(merged.model, "opus");
  assert.deepEqual(merged.hooks.Stop, current.hooks.Stop);
  assert.equal(JSON.stringify(merged).match(/kirin\/hooks\/claude-guard/g).length, 1);
  assert.doesNotMatch(JSON.stringify(merged), /kirin\/hooks\/install/);
  assert.equal(merged.hooks.SessionStart, undefined);
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

test("configuration writes preserve multi-hop links, including dangling targets", () => {
  for (const missing of [false, true]) {
    const home = tempDir();
    try {
      const target = path.join(home, "managed/settings.json");
      const hop = path.join(home, "links/settings.json");
      const file = path.join(home, ".claude/settings.json");
      fs.mkdirSync(path.dirname(hop), { recursive: true });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.symlinkSync("../managed/settings.json", hop);
      fs.symlinkSync("../links/settings.json", file);
      if (!missing) { write(target, '{"theme":"keep"}\n'); fs.chmodSync(target, 0o640); }
      setup({ home, pi: null }, root);
      assert.equal(fs.lstatSync(file).isSymbolicLink(), true);
      assert.equal(fs.lstatSync(hop).isSymbolicLink(), true);
      const settings = JSON.parse(fs.readFileSync(target, "utf8"));
      if (!missing) { assert.equal(settings.theme, "keep"); assert.equal(fs.statSync(target).mode & 0o777, 0o640); }
      assert.ok(settings.hooks.PreToolUse.length);
      mergeSubagentConfig(file);
      assert.equal(fs.lstatSync(hop).isSymbolicLink(), true);
      assert.equal(JSON.parse(fs.readFileSync(target, "utf8")).artifactDir, "project");
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
  }
});

test("cyclic configuration links fail before any setup changes", () => {
  for (const relative of [".claude/settings.json", ".claude/CLAUDE.md", ".agents/AGENTS.md"]) {
    const home = tempDir();
    try {
      const file = path.join(home, relative), hop = path.join(home, "hop");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.symlinkSync(hop, file);
      fs.symlinkSync(file, hop);
      const before = snapshotTree(home);
      assert.throws(() => setup({ home, pi: null }, root), /ELOOP|link cycle|symbolic links/);
      assert.deepEqual(snapshotTree(home), before);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
  }
});

test("a dangling link/.. cycle cannot be activated and replaced by settings writes", () => {
  const home = tempDir();
  try {
    const file = path.join(home, ".claude/settings.json");
    fs.mkdirSync(path.dirname(file));
    fs.symlinkSync("missing/../settings.json", file);
    const before = snapshotTree(home);
    assert.throws(() => setup({ home, pi: null }, root), /ENOENT|ELOOP/);
    assert.deepEqual(snapshotTree(home), before);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test("Claude hooks merely mentioning a managed path retain their custom behavior", () => {
  const hook = { type: "command", command: 'echo "Inspect $HOME/.claude/kirin/hooks/claude-guard.cjs"', timeout: 99 };
  const entry = { matcher: "Bash", hooks: [hook] };
  const merged = mergeClaudeSettings({ hooks: { PreToolUse: [entry] } });
  assert.deepEqual(merged.hooks.PreToolUse[0], entry);
  assert.equal(merged.hooks.PreToolUse.length, 2);
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
  assert.equal(JSON.stringify(installed).match(/\.claude\/kirin\/hooks/g).length, 1);
  assert.equal(first.backups.some((file) => file.endsWith("settings.json")), true);

  assert.equal(fs.existsSync(path.join(home, ".agents", "skills", "design", "SKILL.md")), true);
  const runtime = path.join(home, ".claude", "kirin");
  for (const file of ["chatgpt-export.ts", "guard-policy.cjs", "hooks/claude-guard.cjs"]) {
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

test("global setup surfaces collisions before any runtime changes", () => {
  const home = tempDir();
  const edited = path.join(home, ".agents", "skills", "debug", "SKILL.md");
  write(edited, "my debug notes\n");
  write(path.join(home, ".agents", "skills", "custom", "SKILL.md"), "keep\n");
  const before = filesUnder(home).map((file) => [file, fs.readFileSync(file, "utf8")]);
  const invoke = (flags) => spawnSync(process.execPath, [script, "setup", "--scope", "global", ...flags], {
    cwd: root,
    env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  const denied = invoke([]);
  assert.equal(denied.status, 1, denied.stdout);
  assert.match(denied.stderr, /collisions require --replace/);
  assert.deepEqual(filesUnder(home).map((file) => [file, fs.readFileSync(file, "utf8")]), before);
  const replaced = invoke(["--replace"]);
  assert.equal(replaced.status, 0, replaced.stderr);
  assert.deepEqual(fs.readFileSync(edited), fs.readFileSync(path.join(root, "skills", "workflow", "debug", "SKILL.md")));
  assert.equal(fs.readFileSync(path.join(home, ".agents", "skills", "custom", "SKILL.md"), "utf8"), "keep\n");
  assert.equal(fs.existsSync(path.join(home, ".claude", "kirin", "hooks", "claude-guard.cjs")), true);
});

test("spawned CLI mirrors global core and project selections without a TTY", () => {
  const base = tempDir();
  const globalHome = path.join(base, "global-home");
  fs.mkdirSync(globalHome);
  const global = spawnSync(process.execPath, [script, "setup", "--scope", "global"], {
    cwd: root,
    env: { ...process.env, HOME: globalHome, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  assert.equal(global.status, 0, global.stderr);
  for (const directory of [".agents", ".claude"]) {
    const skillRoot = path.join(globalHome, directory, "skills");
    assert.equal(fs.readdirSync(skillRoot).length, SHARED_SKILLS.length);
    assert.equal(fs.existsSync(path.join(skillRoot, "rust", "SKILL.md")), false);
    assert.equal(fs.existsSync(path.join(skillRoot, "harness", "SKILL.md")), false);
  }

  const project = path.join(base, "project");
  fs.mkdirSync(project);
  const projectHome = path.join(base, "project-home");
  const selected = spawnSync(process.execPath, [script, "install", "rust", "--scope", "project", "--project", project], {
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
  const collision = spawnSync(process.execPath, [script, "install", "rust", "--scope", "project", "--project", project], {
    cwd: root,
    env: { ...process.env, HOME: projectHome, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });
  assert.equal(collision.status, 1);
  assert.match(collision.stderr, /collisions require --replace/);
  assert.equal(fs.readFileSync(path.join(project, ".agents", "skills", "rust", "SKILL.md"), "utf8"), "custom\n");
});

test("explicit setup installs shared skills and Claude instructions without Pi", () => {
  const home = tempDir();
  const result = spawnSync(process.execPath, [script, "setup", "--scope", "global"], {
    cwd: root,
    env: { ...process.env, HOME: home, PATH: "", PI_BIN: "" },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pi not found in PATH/);
  assert.equal(fs.existsSync(path.join(home, ".pi")), false);
  assert.equal(fs.readdirSync(path.join(home, ".agents", "skills")).length, SHARED_SKILLS.length);
  assert.equal(fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  const claudeAgents = path.join(home, ".claude", "AGENTS.md");
  assert.equal(fs.lstatSync(claudeAgents).isSymbolicLink(), false);
  assert.equal(
    fs.readFileSync(claudeAgents, "utf8"),
    fs.readFileSync(path.join(home, ".agents", "AGENTS.md"), "utf8"),
  );
});

test("explicit setup adds Pi-specific setup only when Pi is in PATH", () => {
  const home = tempDir();
  write(path.join(home, ".pi", "agent", "agents", "reviewer.md"), "custom reviewer\n");

  const fakePi = path.join(home, "bin", "pi");
  write(fakePi, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$HOME/pi-calls\"\n");
  fs.chmodSync(fakePi, 0o755);

  const result = spawnSync(process.execPath, [script, "setup", "--scope", "global"], {
    cwd: root,
    env: { ...process.env, HOME: home, PI_BIN: fakePi },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Kirin setup complete/);
  assert.equal(fs.readFileSync(path.join(home, "pi-calls"), "utf8").trim().split("\n").length, 3);
  assert.equal(fs.readdirSync(path.join(home, ".agents", "skills")).length, SHARED_SKILLS.length);
  assert.equal(fs.readFileSync(path.join(home, ".pi", "agent", "agents", "reviewer.md"), "utf8"), "custom reviewer\n");
  assert.equal(fs.existsSync(path.join(home, ".pi", "agent", "agents", ".kirin-managed-agents.json")), false);
  assert.equal(fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(home, ".pi", "agent", "extensions", "subagent", "config.json"), "utf8")),
    SUBAGENT_CONFIG,
  );
  // `pi install` is the only writer of settings.json; setup never edits it directly.
  assert.equal(fs.existsSync(path.join(home, ".pi", "agent", "settings.json")), false);
});

test("documented Nico defaults keep missions automatic and schedules disabled", () => {
  assert.deepEqual(SUBAGENT_CONFIG, {
    toolDescriptionMode: "compact",
    scheduledRuns: { enabled: false },
    missions: { enabled: true },
    artifactDir: "project",
  });
});

test("Nico config merge preserves unrelated nested settings", () => {
  const home = tempDir();
  const config = path.join(home, ".pi", "agent", "extensions", "subagent", "config.json");
  write(config, `${JSON.stringify({
    scheduledRuns: { enabled: true, maxPending: 7, storeRoot: "/tmp/schedules" },
    missions: { enabled: false, directory: "custom", retainTerminal: 9 },
    fleetView: false,
  })}\n`);

  mergeSubagentConfig(config);
  assert.deepEqual(JSON.parse(fs.readFileSync(config, "utf8")), {
    toolDescriptionMode: "compact",
    scheduledRuns: { enabled: false, maxPending: 7, storeRoot: "/tmp/schedules" },
    missions: { enabled: true, directory: "custom", retainTerminal: 9 },
    fleetView: false,
    artifactDir: "project",
  });
});
