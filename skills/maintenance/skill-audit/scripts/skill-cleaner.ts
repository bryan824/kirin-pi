#!/usr/bin/env bun
// Read-only filesystem inventory and recorded Pi/Claude usage evidence.
// This is not a host resource loader, tokenizer, or model-compliance measurement.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

type Issue = { path: string; reason: string };
type Skill = {
  name: string; baseName: string; description: string; path: string; realPath: string;
  root: string; scope: string; modelInvocable: boolean; enabled: null;
  descChars: number; lineChars: number; bodyChars: number; bodyHash: string; bodyKey: string;
};
type Usage = { command: number; load: number; skillResult: number; readRequest: number; fileRead: number; referenceRequest: number; referenceRead: number };
type Records = { parsed: number; malformed: number; messages: number; unsupported: number; unclassifiedToolCalls: number; unmatchedResults: number };
const emptyUsage = (): Usage => ({ command: 0, load: 0, skillResult: 0, readRequest: 0, fileRead: 0, referenceRequest: 0, referenceRead: 0 });
const emptyRecords = (): Records => ({ parsed: 0, malformed: 0, messages: 0, unsupported: 0, unclassifiedToolCalls: 0, unmatchedResults: 0 });
const errorReason = (error: any) => String(error.code ?? error.message ?? error);
const singleLine = (text: string) => text.replace(/\s+/g, " ").trim();
const expandHome = (text: string, home = os.homedir()) => text.replace(/^~(?=$|\/)/, home);

export function parseFrontmatter(file: string) {
  const text = fs.readFileSync(file, "utf8");
  const match = /^\uFEFF?---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  const metadata = Bun.YAML.parse(match[1]!) as Record<string, unknown>;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Frontmatter must be a mapping.");
  for (const key of ["name", "description"]) {
    if (metadata[key] !== undefined && typeof metadata[key] !== "string") throw new Error(`Frontmatter ${key} must be text.`);
  }
  if (metadata["disable-model-invocation"] !== undefined && typeof metadata["disable-model-invocation"] !== "boolean") {
    throw new Error("disable-model-invocation must be a boolean.");
  }
  return {
    name: typeof metadata.name === "string" ? singleLine(metadata.name) : undefined,
    description: typeof metadata.description === "string" ? singleLine(metadata.description) : undefined,
    disableModelInvocation: metadata["disable-model-invocation"] === true,
    body: text.slice(match[0].length),
  };
}

function walkFiles(root: string, predicate: (file: string) => boolean, maxDepth: number, issues: Issue[], followLinks: boolean): string[] {
  const files: string[] = [], seen = new Set<string>();
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) { issues.push({ path: dir, reason: "depth-limit" }); return; }
    try {
      const real = fs.realpathSync(dir);
      if (seen.has(real)) { issues.push({ path: dir, reason: "alias-or-cycle" }); return; }
      seen.add(real);
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const file = path.join(dir, entry.name);
        try {
          if (entry.isSymbolicLink() && !followLinks) { issues.push({ path: file, reason: "symlink-not-followed" }); continue; }
          const kind = entry.isSymbolicLink() ? fs.statSync(file) : entry;
          if (kind.isDirectory()) walk(file, depth + 1);
          else if (kind.isFile() && predicate(file)) files.push(file);
        } catch (error) { issues.push({ path: file, reason: errorReason(error) }); }
      }
    } catch (error) { issues.push({ path: dir, reason: errorReason(error) }); }
  }
  walk(root, 0);
  return files;
}

export function discoverRoots(baseHome = os.homedir(), providedRoots: string[] = [], exclusive = false, issues: Issue[] = [], scanProjects = false): string[] {
  const roots = new Map<string, string>();
  const add = (input: string, explicit = false) => {
    const root = path.resolve(expandHome(input, baseHome));
    try {
      const real = fs.realpathSync(root);
      if (!fs.statSync(real).isDirectory()) throw new Error("not a directory");
      const previous = roots.get(real);
      if (!previous || root.length < previous.length) roots.set(real, root);
    } catch (error: any) { if (explicit || error.code !== "ENOENT") issues.push({ path: root, reason: errorReason(error) }); }
  };
  for (const root of providedRoots) add(root, true);
  if (!exclusive) {
    for (const relative of [".agents/skills", ".claude/skills", ".pi/agent/skills"]) add(path.join(baseHome, relative));
    for (const relative of ["skills", ".agents/skills", ".pi/skills"]) add(path.resolve(relative));
    if (scanProjects) {
      const projects = path.join(baseHome, "Projects");
      try {
        for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
          if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
          for (const relative of ["skills", ".agents/skills", ".pi/skills"]) add(path.join(projects, entry.name, relative));
        }
      } catch (error: any) { if (error.code !== "ENOENT") issues.push({ path: projects, reason: errorReason(error) }); }
    }
  }
  return [...roots.values()].sort();
}

function rootScope(root: string): string {
  const normalized = root.replaceAll("\\", "/");
  if (normalized.includes("/.agents/skills")) return "agents";
  if (normalized.includes("/.claude/skills")) return "claude";
  if (normalized.includes("/.pi/agent/skills") || normalized.includes("/.pi/skills")) return "pi";
  if (root === path.resolve("skills") || /\/Projects\/[^/]+\/skills(\/|$)/.test(normalized)) return "repo";
  return "extra";
}

function normalizeWords(text: string): string {
  return text.toLowerCase().replace(/[`"'’().,;:!?/\\[\]{}_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function discoverSkills(roots: string[], issues: Issue[] = []): Skill[] {
  const skills = new Map<string, Skill>();
  for (const root of roots) {
    for (const file of walkFiles(root, (file) => path.basename(file) === "SKILL.md", 10, issues, true)) {
      try {
        const parsed = parseFrontmatter(file);
        if (!parsed) throw new Error("missing frontmatter");
        const name = parsed.name || path.basename(path.dirname(file));
        const description = parsed.description ?? "";
        const realPath = fs.realpathSync(file);
        if (skills.has(realPath)) continue;
        const skill: Skill = {
          name, baseName: name, description, path: file, realPath, root, scope: rootScope(root),
          modelInvocable: !parsed.disableModelInvocation, enabled: null,
          descChars: [...description].length, lineChars: 0, bodyChars: [...parsed.body].length,
          bodyHash: createHash("sha256").update(parsed.body).digest("hex"), bodyKey: normalizeWords(parsed.body),
        };
        skill.lineChars = [...`${renderSkillLine(skill, description)}\n`].length;
        skills.set(realPath, skill);
      } catch (error) { issues.push({ path: file, reason: errorReason(error) }); }
    }
  }
  return [...skills.values()];
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item), group = groups.get(name) ?? [];
    group.push(item); groups.set(name, group);
  }
  return groups;
}

// A comparison convention only: not host precedence, ownership, or deletion authority.
function comparisonPriority(skill: Skill): number {
  return ["repo", "pi", "agents", "claude", "extra"].indexOf(skill.scope);
}
function comparisonBase(skills: Skill[], budgetRoot: string): Skill {
  return [...skills].sort((a, b) => {
    const preferred = (skill: Skill) => skill.path.startsWith(budgetRoot + path.sep) || skill.realPath.startsWith(budgetRoot + path.sep);
    return Number(preferred(b)) - Number(preferred(a)) || comparisonPriority(a) - comparisonPriority(b) || a.path.localeCompare(b.path);
  })[0]!;
}

export function walkRecentFiles(root: string, cutoffMs: number, issues: Issue[] = [], maxDepth = 8): string[] {
  // A directory's mtime says nothing about edits to its descendants. Do not prune it.
  // Unlike skill inventory, log walking does not follow child symlinks into new scopes.
  return walkFiles(root, (file) => file.endsWith(".jsonl"), maxDepth, issues, false).filter((file) => {
    try { return fs.statSync(file).mtimeMs >= cutoffMs; }
    catch (error) { issues.push({ path: file, reason: errorReason(error) }); return false; }
  });
}

function readTarget(file: unknown, cwd: string | undefined, knownPaths: Map<string, string>) {
  if (typeof file !== "string") return undefined;
  const normalized = file.replace(/^@/, "").replaceAll("\\", "/");
  const absolute = normalized.startsWith("/") || /^[a-z]:\//i.test(normalized);
  const resolved = path.posix.normalize(!absolute && cwd ? `${cwd.replaceAll("\\", "/")}/${normalized}` : normalized);
  if (path.posix.basename(resolved) === "SKILL.md") {
    const name = knownPaths.get(resolved) ?? /(?:^|\/)([^/]+)\/SKILL\.md$/.exec(resolved)?.[1];
    return name ? { name, kind: "fileRead" as const } : undefined;
  }
  // Attribute Markdown reference reads only inside an inventoried skill directory.
  if (resolved.endsWith(".md")) {
    const owners = [...knownPaths].filter(([file]) => resolved.startsWith(path.posix.dirname(file) + "/"))
      .sort(([a], [b]) => b.length - a.length);
    if (owners[0]) return { name: owners[0][1], kind: "referenceRead" as const };
  }
}

// Only structured messages count. Tool-result pairing distinguishes a requested
// read from a successful result. Counts are recorded signals, not model invocations.
export function parsePiSkillUsage(text: string, records = emptyRecords(), knownPaths = new Map<string, string>()): Map<string, Usage> {
  const usage = new Map<string, Usage>();
  const pending = new Map<string, { name: string; kind: "fileRead" | "referenceRead" | "skillResult" }>();
  let cwd: string | undefined;
  const bump = (name: string, key: keyof Usage) => {
    const normalized = name.split(":").at(-1)!.toLowerCase();
    const counts = usage.get(normalized) ?? emptyUsage();
    counts[key]++; usage.set(normalized, counts);
  };
  const result = (id: unknown, error: unknown) => {
    if (typeof id !== "string") return;
    const request = pending.get(id);
    if (!request) { records.unmatchedResults++; return; }
    pending.delete(id);
    if (error === undefined || error === false) bump(request.name, request.kind);
  };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let row: any;
    try { row = JSON.parse(line); records.parsed++; }
    catch { records.malformed++; continue; }
    if (!row || typeof row !== "object" || Array.isArray(row)) { records.unsupported++; continue; }
    if (typeof row.cwd === "string") cwd = row.cwd;
    const message = row.message ?? row;
    if (!message || !["user", "assistant", "toolResult"].includes(message.role)) { records.unsupported++; continue; }
    records.messages++;
    const content = typeof message.content === "string" ? [{ type: "text", text: message.content }] : Array.isArray(message.content) ? message.content : [];
    if (message.role === "toolResult") { result(message.toolCallId, message.isError); continue; }
    if (message.role === "user") {
      for (const block of content) {
        if (block?.type === "tool_result") { result(block.tool_use_id, block.is_error); continue; }
        if (block?.type !== "text" || typeof block.text !== "string") continue;
        const text = block.text.trim();
        const command = /^\/skill:([a-z0-9:_-]+)(?:\s|$)/i.exec(text)
          ?? /^\/([a-z0-9:_-]+)(?:\s|$)/i.exec(text)
          ?? /^(?:<command-message>[^<]*<\/command-message>\s*)?<command-name>\/([a-z0-9:_-]+)<\/command-name>/i.exec(text);
        if (command) bump(command[1]!, "command");
        const load = /^<skill\s+name="([a-z0-9:_-]+)"\s+location="[^"]+">[\s\S]*<\/skill>(?:\s|$)/i.exec(text);
        if (load) bump(load[1]!, "load");
      }
      continue;
    }
    for (const block of content) {
      if (!block || !["toolCall", "tool_use"].includes(block.type) || typeof block.name !== "string") continue;
      const args = block.arguments ?? block.input;
      if (!args || typeof args !== "object" || Array.isArray(args)) { records.unclassifiedToolCalls++; continue; }
      let target: { name: string; kind: "fileRead" | "referenceRead" | "skillResult" } | undefined;
      if (block.name.toLowerCase() === "read") {
        target = readTarget(args.path ?? args.file_path, typeof message.cwd === "string" ? message.cwd : cwd, knownPaths);
        if (target) bump(target.name, target.kind === "fileRead" ? "readRequest" : "referenceRequest");
        else records.unclassifiedToolCalls++;
      } else if (block.type === "tool_use" && block.name === "Skill" && typeof args.skill === "string") {
        target = { name: args.skill, kind: "skillResult" };
      } else records.unclassifiedToolCalls++;
      if (target && typeof block.id === "string") pending.set(block.id, target);
    }
  }
  return usage;
}

export function scanUsage(skills: Skill[], files: string[], maxBytes: number) {
  const usage = new Map(skills.map((skill) => [skill.baseName.toLowerCase(), emptyUsage()]));
  const paths = new Map(skills.flatMap((skill) => [skill.path, skill.realPath].map((file) => [file.replaceAll("\\", "/"), skill.baseName] as const)));
  const records = emptyRecords();
  const scannedFiles: string[] = [], skippedFiles: Issue[] = [], errorFiles: Issue[] = [];
  let bytesRead = 0;
  for (const file of files) {
    try {
      if (maxBytes === 0) { skippedFiles.push({ path: file, reason: "byte-limit" }); continue; }
      const fd = fs.openSync(file, "r");
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile()) throw new Error("not a regular file");
        if (stat.size > 150 * 1024 * 1024) { skippedFiles.push({ path: file, reason: "oversized" }); continue; }
        if (bytesRead + stat.size > maxBytes) { skippedFiles.push({ path: file, reason: "byte-limit" }); continue; }
        // Bound the actual read, even when a live session file grows after stat.
        const buffer = Buffer.alloc(stat.size);
        let length = 0;
        while (length < buffer.length) {
          const read = fs.readSync(fd, buffer, length, buffer.length - length, null);
          if (!read) break;
          length += read;
          bytesRead += read;
        }
        if (length !== stat.size || fs.fstatSync(fd).size !== stat.size) {
          skippedFiles.push({ path: file, reason: "changed-during-read" }); continue;
        }
        scannedFiles.push(file);
        for (const [name, counts] of parsePiSkillUsage(buffer.toString("utf8"), records, paths)) {
          const total = usage.get(name);
          if (total) for (const key of Object.keys(counts) as (keyof Usage)[]) total[key] += counts[key];
        }
      } finally { fs.closeSync(fd); }
    } catch (error) { errorFiles.push({ path: file, reason: errorReason(error) }); }
  }
  return { usage, eligibleFiles: files.length, scannedFiles, skippedFiles, errorFiles, bytesRead, records };
}

export function compactDescription(description: string, maxChars = 110): string {
  let draft = singleLine(description)
    .replace(/^Use this skill alongside ([A-Za-z0-9_.:-]+) when the task involves /i, "$1 + workflow: ")
    .replace(/^Use this skill whenever /i, "")
    .replace(/^Use this skill when /i, "")
    .replace(/^Use when /i, "")
    .replace(/^Trigger whenever the user asks to /i, "")
    .replace(/^This is the preferred workflow skill whenever /i, "")
    .replace(/\bthe user wants to\b/gi, "").replace(/\s+/g, " ").trim();
  const sentence = draft.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  if (sentence && sentence.length >= 35) draft = sentence;
  if ([...draft].length <= maxChars) return draft;
  const prefix = [...draft].slice(0, maxChars - 3).join("");
  const boundary = Math.max(prefix.lastIndexOf(";"), prefix.lastIndexOf(","), prefix.lastIndexOf(" "));
  return `${prefix.slice(0, boundary >= maxChars * 0.6 ? boundary : prefix.length).trimEnd()}...`;
}

function renderSkillLine(skill: Skill, description: string): string {
  return `- ${skill.name}:${description ? ` ${description}` : ""} (file: ${skill.path})`;
}
export function tokenCost(text: string, charsPerToken = 4): number {
  return Math.ceil([...text].length / charsPerToken);
}
export function skillBudget(skills: Skill[], charsPerToken = 4, contextTokens: number | null = null, budgetPercent = 1, model = "unspecified") {
  const full = skills.reduce((sum, skill) => sum + tokenCost(renderSkillLine(skill, skill.description) + "\n", charsPerToken), 0);
  const minimum = skills.reduce((sum, skill) => sum + tokenCost(renderSkillLine(skill, "") + "\n", charsPerToken), 0);
  const budgetTokens = contextTokens === null ? null : Math.floor(contextTokens * budgetPercent / 100);
  return {
    kind: "hypothetical listing estimate, not a native prompt/context measurement", model,
    contextTokens, contextSource: contextTokens === null ? "unknown" : "--context-tokens (user-supplied scenario)",
    charsPerToken, costRule: "ceil(Unicode code points / charsPerToken), per listing line",
    unbudgetedFullTokens: full, minimumTokens: minimum, budgetPercent, budgetTokens,
    remainingBudgetTokens: budgetTokens === null ? null : budgetTokens - full,
  };
}

function words(text: string): Set<string> { return new Set(normalizeWords(text).split(" ").filter((word) => word.length >= 2)); }
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function render(report: ReturnType<typeof analyze>): string {
  const { skills, primary, budget, logScan, inventoryIssues, logDiscoveryIssues } = report;
  const lines = ["# Skill Cleaner Report", "", `generated: ${report.generated}`, `months: ${report.months}`,
    `inventory_source: ${report.inventorySource}`, `effective_selection: ${report.effectiveSelection}`,
    "Package/CLI/trust overrides are not reconstructed. Project .claude/skills and package skill roots require explicit --root scope.",
    `comparison_root: ${report.budgetRoot} (not host precedence or ownership)`,
    `skills: ${skills.length} physical files, ${primary.length} name groups, ${report.modelVisible.length} listing-eligible by frontmatter, ${report.userInvoked.length} hidden from discovery by frontmatter`,
    `log_scope: ${report.logScope}`, `log_files_eligible: ${logScan.eligibleFiles}`,
    `log_files_scanned: ${logScan.scannedFiles.length}`, `log_files_skipped: ${logScan.skippedFiles.length}`,
    `log_files_error: ${logScan.errorFiles.length}`, `log_bytes_read: ${logScan.bytesRead}`,
    `log_records: ${JSON.stringify(logScan.records)}`, "",
    "## Listing Estimate (not actual context or behavioral validation)", "",
    `cost_rule: ${budget.costRule}; ratio=${budget.charsPerToken}`,
    `full_listing_tokens_estimate: ${budget.unbudgetedFullTokens}`, `minimum_no_description_tokens_estimate: ${budget.minimumTokens}`,
    `context_tokens: ${budget.contextTokens ?? "unknown"}`, `context_source: ${budget.contextSource}`,
    `scenario_budget_tokens: ${budget.budgetTokens ?? "not specified"}`, `scenario_remaining_tokens: ${budget.remainingBudgetTokens ?? "unknown"}`,
    "No native truncation/selection algorithm is simulated.",
    `direct_body_tokens_estimate_if_all_comparison_bodies_read: ${report.payloadEvidence.directBodies.estimatedTokens}`,
    `references: ${report.payloadEvidence.references}`, `inherited_context: ${report.payloadEvidence.inheritedContext}`,
    `repeated_injection: ${report.payloadEvidence.repeatedInjection}`, "",
    "## Hidden from Discovery (not inaccessible)", ""];
  for (const skill of primary.filter((skill) => !skill.modelInvocable)) lines.push(`- ${skill.name}: ${skill.path}`);
  if (!report.userInvoked.length) lines.push("- none");
  lines.push("", "## Description Candidates", "");
  const long = primary.filter((skill) => (report.includeAll || skill.modelInvocable) && (skill.descChars >= 110 || skill.lineChars >= 180))
    .sort((a, b) => b.descChars - a.descChars);
  for (const skill of long.slice(0, 30)) lines.push(`- ${skill.name}: ${skill.path}`, `  current: ${skill.description}`, `  draft (review required): ${compactDescription(skill.description)}`);
  if (!long.length) lines.push("- none");
  if (long.length > 30) lines.push(`- ${long.length - 30} further description candidates; full definitions in --json`);
  lines.push("", "## Source/Deploy Drift (inventoried definitions only)", "");
  let differences = 0;
  for (const [name, copies] of groupBy(skills, (skill) => skill.baseName.toLowerCase())) {
    const definition = (skill: Skill) => JSON.stringify([skill.bodyHash, skill.description, skill.modelInvocable]);
    if (new Set(copies.map(definition)).size < 2) continue;
    differences++;
    const base = comparisonBase(copies, report.budgetRoot);
    lines.push(`- ${name}`, `  comparison-base (heuristic): ${base.path}`);
    for (const skill of copies) {
      if (definition(skill) === definition(base)) continue;
      lines.push(`  differs: ${skill.path}; body-word similarity=${Math.round(jaccard(words(base.bodyKey), words(skill.bodyKey)) * 100)}% (not identity)`);
    }
  }
  if (!differences) lines.push("- no differing inventoried definitions; omitted deployments are not certified");
  lines.push("", "## No Observed Use (not evidence of disuse)", "", report.usageAttribution);
  if (logScan.records.messages === 0) lines.push("- no applicable message evidence; do not infer unused skills");
  else {
    const missing = primary.filter((skill) => skill.modelInvocable && Object.values(report.usage[skill.baseName.toLowerCase()] ?? emptyUsage()).every((count) => count === 0));
    for (const skill of missing.slice(0, 80)) lines.push(`- ${skill.name}: ${skill.path}`);
    if (!missing.length) lines.push("- none among the compared names");
    if (missing.length > 80) lines.push(`- ${missing.length - 80} further names with no observed use; full definitions and usage in --json`);
  }
  lines.push("", "## Coverage Issues", "");
  const issues = [...inventoryIssues, ...logDiscoveryIssues, ...logScan.skippedFiles, ...logScan.errorFiles];
  for (const issue of issues.slice(0, 80)) lines.push(`- ${issue.reason}: ${issue.path}`);
  if (!issues.length) lines.push("- no I/O issues in the selected scope; runtime selection remains unknown");
  if (issues.length > 80) lines.push(`- ${issues.length - 80} further issues; use --json for all`);
  lines.push("", "## Root Summary", "");
  for (const [root, files] of groupBy(skills, (skill) => skill.root)) lines.push(`- ${root}: ${files.length} physical skills`);
  return lines.join("\n");
}

const HELP = `Usage: bun skill-cleaner.ts [options]
  --root PATH (repeatable) --root-only  Limit inventory to explicit skill roots
  --budget-root PATH                  Choose a comparison base, not host precedence
  --no-logs                           Do not read session logs
  --log-root PATH (repeatable)         Replace default Pi/Claude log roots
  --months N --max-log-mb N            Recency window and total read budget (zero allowed)
  --chars-per-token N                  Approximate Unicode characters per token (default 4)
  --context-tokens N --budget-percent N  Optional hypothetical context budget
  --model LABEL                       Label for that scenario, not active model discovery
  --scan-projects                     Also inventory skill roots under ~/Projects
  --all --json --help
No configuration, collected history, or native loader is written. Unknown selection stays unknown.`;

function analyze(options: { roots: string[]; rootOnly: boolean; budgetRoot: string; noLogs: boolean; logRoots: string[]; months: number; maxBytes: number; ratio: number; contextTokens: number | null; budgetPercent: number; model: string; scanProjects: boolean; includeAll: boolean }) {
  const inventoryIssues: Issue[] = [], logDiscoveryIssues: Issue[] = [];
  const roots = discoverRoots(os.homedir(), options.roots, options.rootOnly, inventoryIssues, options.scanProjects);
  const skills = discoverSkills(roots, inventoryIssues);
  const primary = [...groupBy(skills, (skill) => skill.baseName.toLowerCase()).values()]
    .map((group) => comparisonBase(group, options.budgetRoot)).sort((a, b) => a.name.localeCompare(b.name));
  const logRoots = options.logRoots.length ? options.logRoots : [path.join(os.homedir(), ".pi/agent/sessions"), path.join(os.homedir(), ".claude/projects")].filter(fs.existsSync);
  const files = options.noLogs ? [] : [...new Set(logRoots.flatMap((root) => walkRecentFiles(path.resolve(expandHome(root)), Date.now() - options.months * 31 * 24 * 60 * 60 * 1000, logDiscoveryIssues)))].sort();
  const scanned = scanUsage(skills, files, options.maxBytes);
  const { usage, ...logScan } = scanned;
  return {
    generated: new Date().toISOString(), months: options.months, roots, skills, primary,
    inventorySource: "filesystem inventory; canonical aliases coalesced",
    effectiveSelection: "unknown (no live/exported host inventory supplied)",
    visibilitySource: "frontmatter eligibility only, not effective loading",
    modelVisible: primary.filter((skill) => skill.modelInvocable).map((skill) => skill.name),
    userInvoked: primary.filter((skill) => !skill.modelInvocable).map((skill) => skill.name),
    payloadEvidence: {
      discovery: "frontmatter eligibility and estimated listing only; actual injected discovery unknown",
      directBodies: { characters: primary.reduce((sum, skill) => sum + skill.bodyChars, 0), estimatedTokens: primary.reduce((sum, skill) => sum + Math.ceil(skill.bodyChars / options.ratio), 0) },
      references: "referenceRequest/referenceRead counts only for known skill directories; payload cost not measured",
      repeatedInjection: "load counts serialized body envelopes; skillResult counts successful Skill results separately; duplication and retained context unknown",
      inheritedContext: "unknown; summaries, forks and cached context are not reconstructed",
    },
    usageAttribution: "Name-level recorded signals across inventoried copies, not proof that the comparison copy was loaded. User commands, body envelopes (load), Skill results, body requests/results and reference requests/results remain separate. Bash/search/other indirect reads and unsupported records are not usage proof; partial reads need not contain a whole body.",
    usage: Object.fromEntries(usage), logFiles: files, logScan,
    logScope: options.noLogs ? "disabled" : logRoots,
    inventoryIssues, logDiscoveryIssues, budgetRoot: options.budgetRoot, includeAll: options.includeAll,
    budget: skillBudget(primary.filter((skill) => options.includeAll || skill.modelInvocable), options.ratio, options.contextTokens, options.budgetPercent, options.model),
  };
}

function main() {
  const { values } = parseArgs({ options: {
    root: { type: "string", multiple: true }, "root-only": { type: "boolean" },
    "budget-root": { type: "string" }, "no-logs": { type: "boolean" }, "log-root": { type: "string", multiple: true },
    months: { type: "string", default: "3" }, "max-log-mb": { type: "string", default: "300" },
    "chars-per-token": { type: "string", default: "4" }, "context-tokens": { type: "string" },
    "budget-percent": { type: "string", default: "1" }, model: { type: "string", default: "unspecified" },
    "scan-projects": { type: "boolean" }, all: { type: "boolean" }, json: { type: "boolean" }, help: { type: "boolean", short: "h" },
  } });
  if (values.help) { console.log(HELP); return; }
  const number = (value: string, name: string, zero = false) => {
    const parsed = Number(value);
    if (!value.trim() || !Number.isFinite(parsed) || (zero ? parsed < 0 : parsed <= 0)) throw new Error(`${name} must be ${zero ? "nonnegative" : "positive"} and finite.`);
    return parsed;
  };
  if (values["root-only"] && !values.root?.length) throw new Error("--root-only requires at least one --root <path>");
  for (const root of [...(values.root ?? []), ...(values["log-root"] ?? [])]) {
    if (!root.trim()) throw new Error("Explicit root paths must be nonempty.");
  }
  const report = analyze({
    roots: values.root ?? [], rootOnly: values["root-only"] ?? false,
    budgetRoot: path.resolve(expandHome(values["budget-root"] ?? path.join(os.homedir(), ".agents/skills"))),
    noLogs: values["no-logs"] ?? false, logRoots: values["log-root"] ?? [],
    months: number(values.months!, "--months", true), maxBytes: number(values["max-log-mb"]!, "--max-log-mb", true) * 1024 * 1024,
    ratio: number(values["chars-per-token"]!, "--chars-per-token"),
    contextTokens: values["context-tokens"] === undefined ? null : number(values["context-tokens"], "--context-tokens"),
    budgetPercent: number(values["budget-percent"]!, "--budget-percent"), model: values.model!,
    scanProjects: values["scan-projects"] ?? false, includeAll: values.all ?? false,
  });
  console.log(values.json ? JSON.stringify(report, null, 2) : render(report));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try { main(); }
  catch (error) { console.error(`skill-cleaner: ${errorReason(error)}`); process.exitCode = 2; }
}
