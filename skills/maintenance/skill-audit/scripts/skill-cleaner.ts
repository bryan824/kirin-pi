#!/usr/bin/env bun
// Pi-native skill auditor. Scans the deployed Pi/Claude skill roots (and the repo
// source), derives model-visibility from `disable-model-invocation` frontmatter
// (Pi hides those from the system prompt; Claude Code drops the description), and
// scans Pi/Claude session logs for usage. Harness-agnostic math (budget, dedup,
// description compaction, similarity) is kept; the I/O layer is Pi/Claude.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Skill = {
  name: string;
  baseName: string;
  description: string;
  path: string;
  realPath: string;
  dir: string;
  root: string;
  realRoot: string;
  scope: string;
  modelInvocable: boolean;
  enabled: boolean;
  descChars: number;
  lineChars: number;
  lineBytes: number;
  bodyHash: string;
  bodyKey: string;
  descKey: string;
  renderPath: string;
};

type Usage = {
  command: number; // `/skill:name` user invocation
  load: number; // `<skill name="...">` injection (skill loaded into context)
  fileRead: number; // a `skills/<name>/SKILL.md` path referenced (read/bash)
};

type Budget = {
  model: string;
  contextTokens: number;
  contextSource: string;
  budgetPercent: number;
  budgetTokens: number;
  renderedLineChars: number;
  unbudgetedFullTokens: number;
  minimumTokens: number;
  budgetedTokens: number;
  charsPerToken: number;
  unbudgetedBudgetUsedRatio: number;
  budgetedBudgetUsedRatio: number;
  unbudgetedContextUsedRatio: number;
  budgetedContextUsedRatio: number;
  remainingBudgetTokens: number;
  includedSkills: number;
  omittedSkills: number;
  truncatedDescriptionChars: number;
  truncatedDescriptionCount: number;
};

const home = os.homedir();
const args = new Set(process.argv.slice(2));

function argValue(name: string, fallback: string): string {
  const raw = process.argv.slice(2);
  const index = raw.indexOf(name);
  return index >= 0 && raw[index + 1] ? raw[index + 1] : fallback;
}

const months = Number(argValue("--months", "3"));
const noLogs = args.has("--no-logs");
const json = args.has("--json");
const includeAll = args.has("--all");
const model = argValue("--model", "default");
const budgetPercent = Number(argValue("--budget-percent", "1"));
const contextTokensOverride = argValue("--context-tokens", "");
const charsPerToken = Number(argValue("--chars-per-token", "4"));
const maxLogBytes = Number(argValue("--max-log-mb", "300")) * 1024 * 1024;
const cutoffMs = Date.now() - Math.max(0, months) * 31 * 24 * 60 * 60 * 1000;
const budgetRoot = expandHome(argValue("--budget-root", path.join(home, ".agents/skills")));
const rootOnly = args.has("--root-only");
const extraRoots = process.argv
  .slice(2)
  .flatMap((arg, index, all) => {
    const value = all[index + 1];
    return arg === "--root" && value && !value.startsWith("--") ? [value] : [];
  });

function expandHome(input: string): string {
  return input.replace(/^~(?=$|\/)/, home);
}

function exists(input: string): boolean {
  try {
    fs.accessSync(input);
    return true;
  } catch {
    return false;
  }
}

function numberArg(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Context-window size for the budget model. Pi loads every skill description, so
// the "full" cost is the real Pi number; the budgeted view models Claude Code's
// ~1% listing budget. There is no per-harness model cache to read, so this is the
// `--context-tokens` override or a sane default.
function modelContext(): { tokens: number; source: string } {
  const override = numberArg(contextTokensOverride, 0);
  if (override > 0) return { tokens: override, source: "--context-tokens" };
  return { tokens: 272_000, source: "default:272k" };
}

function walkFiles(root: string, predicate: (file: string) => boolean, maxDepth = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let real = dir;
    try {
      real = fs.realpathSync(dir);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        let stat: fs.Stats;
        try {
          stat = fs.statSync(file);
        } catch {
          continue;
        }
        if (stat.isDirectory()) walk(file, depth + 1);
      } else if (entry.isFile() && predicate(file)) {
        out.push(file);
      }
    }
  }
  if (exists(root)) walk(root, 0);
  return out;
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseYamlScalar(raw: string): string {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseFrontmatter(
  file: string,
): { name?: string; description?: string; disableModelInvocation: boolean; body: string } | null {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const fm: string[] = [];
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      end = i;
      break;
    }
    fm.push(lines[i] ?? "");
  }
  if (end < 0) return null;
  let name: string | undefined;
  let description: string | undefined;
  let disableModelInvocation = false;
  for (let i = 0; i < fm.length; i++) {
    const line = fm[i] ?? "";
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const raw = match[2] ?? "";
    if (key === "name") name = sanitizeSingleLine(parseYamlScalar(raw));
    if (key === "disable-model-invocation") disableModelInvocation = /true/i.test(raw.trim());
    if (key === "description") {
      if (raw.trim() === "|" || raw.trim() === ">") {
        const block: string[] = [];
        for (let j = i + 1; j < fm.length; j++) {
          if (/^[A-Za-z0-9_-]+:\s*/.test(fm[j] ?? "")) break;
          block.push((fm[j] ?? "").replace(/^\s{2}/, ""));
        }
        description = sanitizeSingleLine(block.join(" "));
      } else {
        description = sanitizeSingleLine(parseYamlScalar(raw));
      }
    }
  }
  return { name, description, disableModelInvocation, body: lines.slice(end + 1).join("\n") };
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeWords(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`"'’().,;:!?/\\[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(input: string): Set<string> {
  return new Set(normalizeWords(input).split(" ").filter((word) => word.length >= 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

// Classify a skill root. `~/.agents/skills` is what Pi loads (and the codex
// `--agent` target writes); `~/.claude/skills` is Claude Code's; `~/.pi/...` is
// Pi-native; a repo `skills/` tree under ~/Projects is the editable source.
function skillRootScope(root: string): string {
  const normalized = root.split(path.sep).join("/");
  if (normalized.includes("/.agents/skills")) return "agents";
  if (normalized.includes("/.claude/skills")) return "claude";
  if (normalized.includes("/.pi/agent/skills") || normalized.includes("/.pi/skills")) return "pi";
  if (/\/Projects\/[^/]+\/skills(\/|$)/.test(normalized)) return "repo";
  return "extra";
}

// Lower number = better copy to keep. The editable repo source wins; deployed
// roots (flattened outputs) lose, because you fix the source and re-deploy.
function deletePriority(skill: Skill): number {
  if (skill.scope === "repo") return 0;
  if (skill.scope === "pi") return 1;
  if (skill.scope === "agents") return 2;
  if (skill.scope === "claude") return 3;
  return 4;
}

function preferredKeepSkill(list: Skill[]): Skill {
  return [...list].sort((a, b) => {
    const byPriority = deletePriority(a) - deletePriority(b);
    if (byPriority !== 0) return byPriority;
    return a.realPath.length - b.realPath.length || a.realPath.localeCompare(b.realPath);
  })[0]!;
}

function configState(): { disabledPaths: Set<string>; disabledNames: Set<string> } {
  // The deployed flattened skills are not disabled per-skill the way Codex
  // plugins were; Pi toggles whole package resources via `pi config`, not
  // individual SKILL.md files. Treat all discovered skills as enabled.
  return { disabledPaths: new Set(), disabledNames: new Set() };
}

export function discoverRoots(
  baseHome = home,
  providedRoots = extraRoots,
  exclusive = rootOnly,
): string[] {
  const rootsByRealPath = new Map<string, string>();
  const add = (root: string) => {
    if (!exists(root)) return;
    const real = fs.realpathSync(root);
    const current = rootsByRealPath.get(real);
    if (!current || root.length < current.length) rootsByRealPath.set(real, root);
  };
  const roots = providedRoots.map((root) => root.replace(/^~(?=$|\/)/, baseHome));
  // Exclusive mode (--root-only): scan only the supplied roots — no harness
  // defaults, no cwd repo roots, no projects sweep.
  if (exclusive) {
    roots.forEach(add);
    return [...rootsByRealPath.values()].sort();
  }
  // Deployed + global roots the harnesses actually load.
  [
    path.join(baseHome, ".agents/skills"),
    path.join(baseHome, ".claude/skills"),
    path.join(baseHome, ".pi/agent/skills"),
    ...roots,
  ].forEach(add);
  // The current repo, when run from a skill repo (e.g. kirin-pi) — gives the
  // editable source to diff against the deployed copies.
  for (const local of ["skills", ".agents/skills", ".pi/skills"]) {
    add(path.resolve(process.cwd(), local));
  }
  // Every skill repo under ~/Projects — opt-in, since most aren't deployed and
  // add cross-repo noise to a "what do my agents load" audit.
  if (args.has("--scan-projects")) {
    const projects = path.join(baseHome, "Projects");
    if (exists(projects)) {
      for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        for (const sub of [".agents/skills", ".pi/skills", "skills"]) {
          add(path.join(projects, entry.name, sub));
        }
      }
    }
  }
  return [...rootsByRealPath.values()].sort();
}

function discoverSkills(): Skill[] {
  const { disabledPaths, disabledNames } = configState();
  const skillsByRealPath = new Map<string, Skill>();
  for (const root of discoverRoots()) {
    for (const file of walkFiles(root, (candidate) => path.basename(candidate) === "SKILL.md", 10)) {
      const parsed = parseFrontmatter(file);
      if (!parsed) continue;
      const baseName = parsed.name || path.basename(path.dirname(file));
      const description = parsed.description ?? "";
      const rendered = description
        ? `- ${baseName}: ${description} (file: ${file})`
        : `- ${baseName}: (file: ${file})`;
      const bodyKey = normalizeWords(parsed.body);
      const realPath = fs.realpathSync(file);
      const skill: Skill = {
        name: baseName,
        baseName,
        description,
        path: file,
        realPath,
        dir: path.dirname(file),
        root,
        realRoot: exists(root) ? fs.realpathSync(root) : root,
        scope: skillRootScope(root),
        modelInvocable: !parsed.disableModelInvocation,
        enabled: !disabledPaths.has(file) && !disabledNames.has(baseName),
        descChars: [...description].length,
        lineChars: [...`${rendered}\n`].length,
        lineBytes: Buffer.byteLength(`${rendered}\n`, "utf8"),
        bodyHash: fnv1a(bodyKey),
        bodyKey,
        descKey: normalizeWords(description),
        renderPath: file,
      };
      if (!skillsByRealPath.has(skill.realPath)) skillsByRealPath.set(skill.realPath, skill);
    }
  }
  return [...skillsByRealPath.values()];
}

// The set the budget/visibility/unused analysis runs on: one copy per skill name,
// preferring the budget root (what Pi loads), then the best-kept copy.
function primarySkills(skills: Skill[]): Skill[] {
  const byName = groupBy(skills, (skill) => skill.baseName.toLowerCase());
  const out: Skill[] = [];
  for (const [, list] of byName) {
    const inBudgetRoot = list.filter((skill) => skill.realPath.startsWith(`${budgetRoot}${path.sep}`));
    out.push((inBudgetRoot.length ? inBudgetRoot : list).sort(
      (a, b) => deletePriority(a) - deletePriority(b),
    )[0]!);
  }
  return out.sort((a, b) => a.baseName.localeCompare(b.baseName));
}

// ---- Usage (Pi/Claude session logs) ----

function sessionRoots(): string[] {
  return [path.join(home, ".pi/agent/sessions"), path.join(home, ".claude/projects")].filter(exists);
}

function recentLogFiles(): string[] {
  if (noLogs) return [];
  const files = new Set<string>();
  for (const root of sessionRoots()) {
    for (const file of walkRecentFiles(root, (candidate) => candidate.endsWith(".jsonl"), 8)) {
      try {
        if (fs.statSync(file).mtimeMs >= cutoffMs) files.add(file);
      } catch {}
    }
  }
  return [...files].sort();
}

function walkRecentFiles(root: string, predicate: (file: string) => boolean, maxDepth = 8): string[] {
  const out: string[] = [];
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (entry.isDirectory()) {
        if (depth > 0 && stat.mtimeMs < cutoffMs) continue;
        walk(file, depth + 1);
      } else if (entry.isFile() && stat.mtimeMs >= cutoffMs && predicate(file)) {
        out.push(file);
      }
    }
  }
  if (exists(root)) walk(root, 0);
  return out;
}

// Count per-skill usage signals in raw session text. Format-resilient by design:
// matches the three signals Pi/Claude leave behind regardless of nested record
// shape — `/skill:name` (typed), `<skill name="name">` (loaded into context), and
// a `skills/name/SKILL.md` path (read/bash).
export function parsePiSkillUsage(text: string): Map<string, Usage> {
  const usage = new Map<string, Usage>();
  const bump = (name: string, key: keyof Usage) => {
    const lower = name.toLowerCase();
    const item = usage.get(lower) ?? { command: 0, load: 0, fileRead: 0 };
    item[key] += 1;
    usage.set(lower, item);
  };
  for (const match of text.matchAll(/\/skill:([a-z0-9][a-z0-9:_-]*)/gi)) {
    bump((match[1] ?? "").split(":").at(-1) ?? "", "command");
  }
  for (const match of text.matchAll(/<skill\s+name=\\?"([a-z0-9][a-z0-9:_-]*)\\?"/gi)) {
    bump((match[1] ?? "").split(":").at(-1) ?? "", "load");
  }
  for (const match of text.matchAll(/skills\/([a-z0-9][a-z0-9_-]*)\/SKILL\.md/gi)) {
    bump(match[1] ?? "", "fileRead");
  }
  usage.delete("");
  usage.delete("name");
  return usage;
}

function scanUsage(skills: Skill[], logFiles: string[]): Map<string, Usage> {
  const usage = new Map<string, Usage>();
  for (const skill of skills) usage.set(skill.baseName.toLowerCase(), { command: 0, load: 0, fileRead: 0 });
  let consumedBytes = 0;
  for (const file of logFiles) {
    let text = "";
    try {
      const stat = fs.statSync(file);
      if (stat.size > 150 * 1024 * 1024) continue;
      if (consumedBytes + stat.size > maxLogBytes) break;
      consumedBytes += stat.size;
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const [name, counts] of parsePiSkillUsage(text)) {
      const item = usage.get(name);
      if (!item) continue;
      item.command += counts.command;
      item.load += counts.load;
      item.fileRead += counts.fileRead;
    }
  }
  return usage;
}

function usageTotal(item: Usage | undefined): number {
  return item ? item.command + item.load + item.fileRead : 0;
}

function usageForSkill(usage: Map<string, Usage>, skill: Skill): Usage {
  return usage.get(skill.baseName.toLowerCase()) ?? { command: 0, load: 0, fileRead: 0 };
}

// ---- Harness-agnostic helpers (kept) ----

export function compactDescription(description: string, maxChars = 110): string {
  let draft = sanitizeSingleLine(description)
    .replace(/^Use this skill alongside ([A-Za-z0-9_.:-]+) when the task involves /i, "$1 + workflow: ")
    .replace(/^Use this skill whenever /i, "")
    .replace(/^Use this skill when /i, "")
    .replace(/^Use when /i, "")
    .replace(/^Trigger whenever the user asks to /i, "")
    .replace(/^This is the preferred workflow skill whenever /i, "")
    .replace(/\bthe user wants to\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstSentence = draft.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length >= 35) draft = firstSentence;
  if ([...draft].length <= maxChars) return draft;
  const prefix = [...draft].slice(0, maxChars - 3).join("");
  const boundary = Math.max(prefix.lastIndexOf(";"), prefix.lastIndexOf(","), prefix.lastIndexOf(" "));
  return `${prefix.slice(0, boundary >= maxChars * 0.6 ? boundary : prefix.length).trimEnd()}...`;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    map.set(value, [...(map.get(value) ?? []), item]);
  }
  return map;
}

function similarity(a: Skill, b: Skill): { description: number; body: number; overall: number } {
  const description = jaccard(wordSet(a.description), wordSet(b.description));
  const body = a.bodyHash === b.bodyHash ? 1 : jaccard(wordSet(a.bodyKey), wordSet(b.bodyKey));
  return { description, body, overall: body * 0.8 + description * 0.2 };
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatOnePct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function tokenCost(text: string): number {
  return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
}

function renderSkillLine(skill: Skill, description: string): string {
  return description
    ? `- ${skill.name}: ${description} (file: ${skill.renderPath})`
    : `- ${skill.name}: (file: ${skill.renderPath})`;
}

function renderSkillDescriptionPrefix(skill: Skill, descriptionChars: number): string {
  if (descriptionChars <= 0) return "";
  return [...skill.description].slice(0, descriptionChars).join("");
}

function lineTokenCost(line: string): number {
  return tokenCost(`${line}\n`);
}

function minimumLineTokenCost(skill: Skill): number {
  return lineTokenCost(renderSkillLine(skill, ""));
}

function fullLineTokenCost(skill: Skill): number {
  return lineTokenCost(renderSkillLine(skill, skill.description));
}

function extraDescriptionCosts(skill: Skill): number[] {
  const minimumLine = renderSkillLine(skill, "");
  const minimumBytes = Buffer.byteLength(`${minimumLine}\n`, "utf8");
  const minimumCost = Math.ceil(minimumBytes / 4);
  const costs = [0];
  let prefixBytes = 0;
  for (const char of skill.description) {
    prefixBytes += Buffer.byteLength(char, "utf8");
    const renderedBytes = minimumBytes + prefixBytes + 1;
    costs.push(Math.ceil(renderedBytes / 4) - minimumCost);
  }
  return costs;
}

// Models a listing budget that truncates least-first (Claude Code's ~1%). Pi
// loads every description, so `fullTokens` is the Pi reality and the budgeted
// view is "what Claude Code would keep".
function budgetedSkillCost(skills: Skill[], budgetTokens: number): {
  fullTokens: number;
  minimumTokens: number;
  budgetedTokens: number;
  includedSkills: number;
  omittedSkills: number;
  truncatedDescriptionChars: number;
  truncatedDescriptionCount: number;
} {
  const ordered = [...skills].sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
  const fullTokens = ordered.reduce((sum, skill) => sum + fullLineTokenCost(skill), 0);
  if (fullTokens <= budgetTokens) {
    return {
      fullTokens,
      minimumTokens: ordered.reduce((sum, skill) => sum + minimumLineTokenCost(skill), 0),
      budgetedTokens: fullTokens,
      includedSkills: ordered.length,
      omittedSkills: 0,
      truncatedDescriptionChars: 0,
      truncatedDescriptionCount: 0,
    };
  }

  const minimumTokens = ordered.reduce((sum, skill) => sum + minimumLineTokenCost(skill), 0);
  if (minimumTokens <= budgetTokens) {
    const remainingByIndex = ordered.map((skill) => [...skill.description].length);
    const allocatedByIndex = ordered.map(() => 0);
    const currentExtraCosts = ordered.map(() => 0);
    const extraCostsByIndex = ordered.map(extraDescriptionCosts);
    let remaining = budgetTokens - minimumTokens;
    while (true) {
      let changed = false;
      for (let index = 0; index < ordered.length; index++) {
        if (allocatedByIndex[index] >= remainingByIndex[index]) continue;
        const nextChars = allocatedByIndex[index] + 1;
        const nextCost = extraCostsByIndex[index]?.[nextChars] ?? currentExtraCosts[index];
        const delta = nextCost - currentExtraCosts[index];
        if (delta <= remaining) {
          allocatedByIndex[index] = nextChars;
          currentExtraCosts[index] = nextCost;
          remaining -= delta;
          changed = true;
        }
      }
      if (!changed) break;
    }
    const rendered = ordered.map((skill, index) =>
      renderSkillLine(skill, renderSkillDescriptionPrefix(skill, allocatedByIndex[index] ?? 0))
    );
    const truncatedDescriptionChars = ordered.reduce(
      (sum, skill, index) => sum + Math.max(0, [...skill.description].length - (allocatedByIndex[index] ?? 0)),
      0,
    );
    const truncatedDescriptionCount = ordered.filter(
      (skill, index) => (allocatedByIndex[index] ?? 0) < [...skill.description].length,
    ).length;
    return {
      fullTokens,
      minimumTokens,
      budgetedTokens: rendered.reduce((sum, line) => sum + lineTokenCost(line), 0),
      includedSkills: ordered.length,
      omittedSkills: 0,
      truncatedDescriptionChars,
      truncatedDescriptionCount,
    };
  }

  let budgetedTokens = 0;
  let includedSkills = 0;
  let omittedSkills = 0;
  let truncatedDescriptionChars = 0;
  let truncatedDescriptionCount = 0;
  for (const skill of ordered) {
    const cost = minimumLineTokenCost(skill);
    if (budgetedTokens + cost <= budgetTokens) {
      budgetedTokens += cost;
      includedSkills++;
    } else {
      omittedSkills++;
    }
    const descriptionChars = [...skill.description].length;
    truncatedDescriptionChars += descriptionChars;
    if (descriptionChars > 0) truncatedDescriptionCount++;
  }
  return {
    fullTokens,
    minimumTokens,
    budgetedTokens,
    includedSkills,
    omittedSkills,
    truncatedDescriptionChars,
    truncatedDescriptionCount,
  };
}

function skillBudget(skills: Skill[]): Budget {
  const context = modelContext();
  const tokenRatio = numberArg(String(charsPerToken), 4);
  const percent = numberArg(String(budgetPercent), 1);
  const renderedLineChars = skills.reduce((sum, skill) => sum + skill.lineChars, 0);
  const budgetTokens = Math.floor(context.tokens * (percent / 100));
  const cost = budgetedSkillCost(skills, Math.max(1, budgetTokens));
  return {
    model,
    contextTokens: context.tokens,
    contextSource: context.source,
    budgetPercent: percent,
    budgetTokens,
    renderedLineChars,
    unbudgetedFullTokens: cost.fullTokens,
    minimumTokens: cost.minimumTokens,
    budgetedTokens: cost.budgetedTokens,
    charsPerToken: tokenRatio,
    unbudgetedBudgetUsedRatio: cost.fullTokens / budgetTokens,
    budgetedBudgetUsedRatio: cost.budgetedTokens / budgetTokens,
    unbudgetedContextUsedRatio: cost.fullTokens / context.tokens,
    budgetedContextUsedRatio: cost.budgetedTokens / context.tokens,
    remainingBudgetTokens: budgetTokens - cost.budgetedTokens,
    includedSkills: cost.includedSkills,
    omittedSkills: cost.omittedSkills,
    truncatedDescriptionChars: cost.truncatedDescriptionChars,
    truncatedDescriptionCount: cost.truncatedDescriptionCount,
  };
}

function isLikelyCopy(score: { description: number; body: number }): boolean {
  return score.body >= 0.95 || (score.body >= 0.85 && score.description >= 0.85);
}

function render(
  discovered: Skill[],
  primary: Skill[],
  usage: Map<string, Usage>,
  logFiles: string[],
): string {
  const visible = primary.filter((skill) => skill.modelInvocable);
  const hidden = primary.filter((skill) => !skill.modelInvocable);
  const considered = includeAll ? primary : visible;
  const roots = groupBy(discovered, (skill) => skill.root);

  // Duplicates: group by name across roots. Identical copies across deploy roots
  // are expected (one skill deployed); only flag groups whose bodies DIVERGE
  // (source vs deployed drift, or a real name collision).
  const byBase = [...groupBy(discovered, (skill) => skill.baseName.toLowerCase()).entries()]
    .map(([name, list]) => [name, list, new Set(list.map((skill) => skill.bodyHash))] as const)
    .filter(([, list]) => list.length > 1);
  const drift = byBase.filter(([, , hashes]) => hashes.size > 1);

  const longDescriptions = considered
    .filter((skill) => skill.descChars >= 110 || skill.lineChars >= 180)
    .sort((a, b) => b.descChars - a.descChars)
    .slice(0, 30);
  const unused = visible
    .filter((skill) => usageTotal(usage.get(skill.baseName.toLowerCase())) === 0)
    .sort((a, b) => a.scope.localeCompare(b.scope) || a.name.localeCompare(b.name))
    .slice(0, 80);
  const totalLineChars = considered.reduce((sum, skill) => sum + skill.lineChars, 0);
  const totalDescChars = considered.reduce((sum, skill) => sum + skill.descChars, 0);
  const budget = skillBudget(considered);
  const lines: string[] = [];
  lines.push("# Skill Cleaner Report", "");
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`months: ${months}`);
  lines.push(`visibility_source: disable-model-invocation frontmatter`);
  lines.push(`budget_root: ${budgetRoot}`);
  lines.push(
    `skills: ${discovered.length} discovered, ${primary.length} unique, ${visible.length} model-visible, ${hidden.length} user-invoked`,
  );
  lines.push(`description_chars: ${totalDescChars}`);
  lines.push(`rendered_line_chars: ${totalLineChars}`);
  lines.push(`log_files_scanned: ${logFiles.length}`, "");

  lines.push("## Skill Budget", "");
  lines.push(`model: ${budget.model}`);
  lines.push(`context_tokens: ${formatNumber(budget.contextTokens)}`);
  lines.push(`context_source: ${budget.contextSource}`);
  lines.push(`${budget.budgetPercent}%_budget_tokens: ${formatNumber(budget.budgetTokens)}`);
  lines.push(`cost_rule: ceil(utf8_bytes / ${budget.charsPerToken})`);
  lines.push(`full_tokens_pi_loads_all: ${formatNumber(budget.unbudgetedFullTokens)}`);
  lines.push(`minimum_no_description_tokens: ${formatNumber(budget.minimumTokens)}`);
  lines.push(`budgeted_tokens_claude_1pct: ${formatNumber(budget.budgetedTokens)}`);
  lines.push(`full_used_of_budget: ${formatOnePct(budget.unbudgetedBudgetUsedRatio)}`);
  lines.push(`full_used_of_context: ${formatOnePct(budget.unbudgetedContextUsedRatio)}`);
  lines.push(`remaining_budget_tokens: ${formatNumber(budget.remainingBudgetTokens)}`);
  lines.push(`included_after_budget: ${budget.includedSkills}`);
  lines.push(`omitted_after_budget: ${budget.omittedSkills}`);
  lines.push(`truncated_description_chars: ${formatNumber(budget.truncatedDescriptionChars)}`, "");

  lines.push("## User-Invoked (hidden from model prompt)", "");
  for (const skill of hidden.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`- ${skill.name}: ${skill.scope}; ${skill.path}`);
  }
  if (hidden.length === 0) lines.push("- none");
  lines.push("");

  lines.push("## Description Candidates", "");
  for (const skill of longDescriptions) {
    lines.push(`- ${skill.name}`);
    lines.push(`  path: ${skill.path}`);
    lines.push(`  chars: description=${skill.descChars}, rendered_line=${skill.lineChars}`);
    lines.push(`  current: ${skill.description}`);
    lines.push(`  draft: ${compactDescription(skill.description)}`);
  }
  if (longDescriptions.length === 0) lines.push("- none");
  lines.push("");

  lines.push("## Source/Deploy Drift (same name, different body)", "");
  for (const [name, list] of drift.slice(0, 40)) {
    lines.push(`- ${name}`);
    const keep = preferredKeepSkill(list);
    lines.push(`  source-of-truth: ${keep.scope}: ${keep.path}`);
    for (const skill of list) {
      if (skill.realPath === keep.realPath) continue;
      const score = similarity(keep, skill);
      const tag = isLikelyCopy(score) ? "stale-deploy?" : "different-skill?";
      lines.push(
        `  ${tag}: ${skill.scope}: ${skill.path} (body=${formatPct(score.body)}, description=${formatPct(score.description)})`,
      );
    }
  }
  if (drift.length === 0) lines.push("- none (deployed copies match source)");
  lines.push("");

  lines.push("## Unused Candidates (model-visible, no recent use)", "");
  for (const skill of unused) {
    const item = usageForSkill(usage, skill);
    lines.push(
      `- ${skill.name}: ${skill.scope}; command=${item.command}, load=${item.load}, reads=${item.fileRead}; ${skill.path}`,
    );
  }
  if (unused.length === 0) lines.push("- none");
  lines.push("");

  lines.push("## Root Summary", "");
  for (const [root, list] of [...roots.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const userInvoked = list.filter((skill) => !skill.modelInvocable).length;
    lines.push(`- ${root}: ${list.length} skills${userInvoked ? `, ${userInvoked} user-invoked` : ""}`);
  }
  return lines.join("\n");
}

function main(): void {
  if (rootOnly && extraRoots.length === 0) {
    console.error("skill-cleaner: --root-only requires at least one --root <path>");
    process.exitCode = 2;
    return;
  }
  const skills = discoverSkills();
  const primary = primarySkills(skills);
  const logFiles = recentLogFiles();
  const usage = scanUsage(primary, logFiles);
  const considered = includeAll ? primary : primary.filter((skill) => skill.modelInvocable);
  const budget = skillBudget(considered);
  const output = json
    ? JSON.stringify(
        {
          skills,
          primary,
          modelVisible: primary.filter((skill) => skill.modelInvocable).map((skill) => skill.name),
          userInvoked: primary.filter((skill) => !skill.modelInvocable).map((skill) => skill.name),
          visibilitySource: "disable-model-invocation frontmatter",
          usage: Object.fromEntries(usage),
          logFiles,
          budget,
        },
        null,
        2,
      )
    : render(skills, primary, usage, logFiles);
  console.log(output);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
