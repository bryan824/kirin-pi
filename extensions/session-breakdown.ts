/**
 * /session-breakdown
 *
 * Modified for kirin-pi from Apache-2.0-licensed source.
 *
 * Interactive TUI that analyzes Pi's native session inventory and shows
 * last 7/30/90 days of:
 * - sessions/day
 * - messages/day
 * - tokens/day (if available)
 * - cost/day (if available)
 * - breakdown by model, directory, weekday and time of day
 *
 * Graph:
 * - GitHub-contributions-style calendar (weeks x weekdays)
 * - Hue: weighted mix of the view's popular keys (weighted by the selected metric)
 * - Brightness: selected metric per day (log-scaled)
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader, SessionManager } from "@earendil-works/pi-coding-agent";
import {
	Key,
	matchesKey,
	type Component,
	type TUI,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import os from "node:os";
import path from "node:path";
import { createReadStream } from "node:fs";
import readline from "node:readline";

type BreakdownView = "model" | "cwd" | "dow" | "tod";
type MeasurementMode = "sessions" | "messages" | "tokens";
type DimensionView = Exclude<BreakdownView, "model">;

interface Totals {
	sessions: number;
	messages: number;
	tokens: number;
	cost: number;
}

/** Totals per key (`provider/model`, cwd, weekday, time-of-day bucket) for each view. */
type ByView = Record<BreakdownView, Map<string, Totals>>;

const VIEWS: BreakdownView[] = ["model", "cwd", "dow", "tod"];
const DIMENSION_VIEWS: DimensionView[] = ["cwd", "dow", "tod"];
const DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TOD_BUCKETS: { key: string; label: string; from: number; to: number }[] = [
	{ key: "after-midnight", label: "After midnight (0–5)", from: 0, to: 5 },
	{ key: "morning", label: "Morning (6–11)", from: 6, to: 11 },
	{ key: "afternoon", label: "Afternoon (12–16)", from: 12, to: 16 },
	{ key: "evening", label: "Evening (17–21)", from: 17, to: 21 },
	{ key: "night", label: "Night (22–23)", from: 22, to: 23 },
];

function todBucketForHour(hour: number): string {
	return TOD_BUCKETS.find((b) => hour >= b.from && hour <= b.to)?.key ?? "after-midnight";
}

function todBucketLabel(key: string): string {
	return TOD_BUCKETS.find((b) => b.key === key)?.label ?? key;
}

interface ParsedSession {
	startedAt: Date;
	dayKeyLocal: string; // YYYY-MM-DD (local)
	total: Totals;
	models: Map<string, Totals>; // sessions=1 only for models the session actually used
	cwd: string | null;
	dow: string;
	tod: string;
}

interface Aggregate {
	total: Totals;
	by: ByView;
}

interface DayAgg extends Aggregate {
	date: Date; // local midnight
	dayKeyLocal: string;
}

interface RangeAgg extends Aggregate {
	days: DayAgg[];
	dayByKey: Map<string, DayAgg>;
}

interface RGB {
	r: number;
	g: number;
	b: number;
}

interface Palette {
	colors: Map<string, RGB>;
	ordered: string[];
}

interface BreakdownData {
	generatedAt: Date;
	ranges: Map<number, RangeAgg>;
	palettes: Record<BreakdownView, Palette>;
}

const RANGE_DAYS = [7, 30, 90] as const;

type BreakdownProgressPhase = "scan" | "parse" | "finalize";

interface BreakdownProgressState {
	phase: BreakdownProgressPhase;
	foundFiles: number;
	parsedFiles: number;
	totalFiles: number;
	currentFile?: string;
}

function setBorderedLoaderMessage(loader: BorderedLoader, message: string) {
	// BorderedLoader wraps a (Cancellable)Loader which supports setMessage(),
	// but it doesn't expose it publicly. Access the inner loader for progress updates.
	const inner = (loader as any)["loader"]; // eslint-disable-line @typescript-eslint/no-explicit-any
	if (inner && typeof inner.setMessage === "function") {
		inner.setMessage(message);
	}
}

// Dark-ish background and empty cell color (close to GitHub dark)
const DEFAULT_BG: RGB = { r: 13, g: 17, b: 23 };
const EMPTY_CELL_BG: RGB = { r: 22, g: 27, b: 34 };
const OTHER_COLOR: RGB = { r: 160, g: 160, b: 160 };

// Default palette (assigned to top models and directories)
const PALETTE: RGB[] = [
	{ r: 64, g: 196, b: 99 }, // green
	{ r: 47, g: 129, b: 247 }, // blue
	{ r: 163, g: 113, b: 247 }, // purple
	{ r: 255, g: 159, b: 10 }, // orange
	{ r: 244, g: 67, b: 54 }, // red
];

// Fixed palette for day-of-week: weekdays get cool tones, weekend gets warm
const DOW_PALETTE: RGB[] = [
	{ r: 47, g: 129, b: 247 },  // Mon – blue
	{ r: 64, g: 196, b: 99 },   // Tue – green
	{ r: 163, g: 113, b: 247 }, // Wed – purple
	{ r: 47, g: 175, b: 200 },  // Thu – teal
	{ r: 100, g: 200, b: 150 }, // Fri – mint
	{ r: 255, g: 159, b: 10 },  // Sat – orange
	{ r: 244, g: 67, b: 54 },   // Sun – red
];

// Fixed palette for time-of-day buckets, in TOD_BUCKETS order
const TOD_PALETTE: RGB[] = [
	{ r: 100, g: 60, b: 180 }, // after midnight – deep purple
	{ r: 255, g: 200, b: 50 }, // morning – golden yellow
	{ r: 64, g: 196, b: 99 },  // afternoon – green
	{ r: 47, g: 129, b: 247 }, // evening – blue
	{ r: 60, g: 40, b: 140 },  // night – dark indigo
];

const emptyTotals = (): Totals => ({ sessions: 0, messages: 0, tokens: 0, cost: 0 });
const emptyByView = (): ByView => ({ model: new Map(), cwd: new Map(), dow: new Map(), tod: new Map() });

function addTotals(into: Totals, from: Totals): void {
	into.sessions += from.sessions;
	into.messages += from.messages;
	into.tokens += from.tokens;
	into.cost += from.cost;
}

function totalsFor(map: Map<string, Totals>, key: string): Totals {
	let totals = map.get(key);
	if (!totals) map.set(key, (totals = emptyTotals()));
	return totals;
}

function clamp01(x: number): number {
	return Math.max(0, Math.min(1, x));
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
	return {
		r: Math.round(lerp(a.r, b.r, t)),
		g: Math.round(lerp(a.g, b.g, t)),
		b: Math.round(lerp(a.b, b.b, t)),
	};
}

function weightedMix(colors: Array<{ color: RGB; weight: number }>): RGB {
	let total = 0;
	let r = 0;
	let g = 0;
	let b = 0;
	for (const c of colors) {
		if (!Number.isFinite(c.weight) || c.weight <= 0) continue;
		total += c.weight;
		r += c.color.r * c.weight;
		g += c.color.g * c.weight;
		b += c.color.b * c.weight;
	}
	if (total <= 0) return EMPTY_CELL_BG;
	return { r: Math.round(r / total), g: Math.round(g / total), b: Math.round(b / total) };
}

function ansiFg(rgb: RGB, text: string): string {
	return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;
}

function dim(text: string): string {
	return `\x1b[2m${text}\x1b[0m`;
}

function bold(text: string): string {
	return `\x1b[1m${text}\x1b[0m`;
}

function formatCount(n: number): string {
	if (!Number.isFinite(n) || n === 0) return "0";
	if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
	return n.toLocaleString("en-US");
}

function formatUsd(cost: number): string {
	if (!Number.isFinite(cost)) return "$0.00";
	if (cost >= 1) return `$${cost.toFixed(2)}`;
	if (cost >= 0.1) return `$${cost.toFixed(3)}`;
	return `$${cost.toFixed(4)}`;
}

/**
 * Abbreviate a path for display. Strategy:
 * - Replace home dir with ~
 * - If still too long, keep first segment + last N segments with … in between
 * Examples:
 *   /Users/name/Projects/example  →  ~/Projects/example
 *   /Users/name/Projects/group/long-project  →  ~/…/group/long-project
 */
function abbreviatePath(p: string, maxWidth = 40): string {
	const home = os.homedir();
	let display = p;
	if (display.startsWith(home)) {
		display = "~" + display.slice(home.length);
	}
	if (display.length <= maxWidth) return display;

	const parts = display.split("/").filter(Boolean);
	// Always keep the first part (~ or root indicator) and try to keep as many trailing parts as possible
	if (parts.length <= 2) return display;

	const prefix = parts[0]; // typically "~"
	// Try keeping last N parts, increasing until it fits
	for (let keep = parts.length - 1; keep >= 1; keep--) {
		const tail = parts.slice(parts.length - keep);
		const candidate = prefix + "/…/" + tail.join("/");
		if (candidate.length <= maxWidth || keep === 1) return candidate;
	}
	return display;
}

function padRight(s: string, n: number): string {
	const delta = n - s.length;
	return delta > 0 ? s + " ".repeat(delta) : s;
}

function padLeft(s: string, n: number): string {
	const delta = n - s.length;
	return delta > 0 ? " ".repeat(delta) + s : s;
}

function toLocalDayKey(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function localMidnight(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDaysLocal(d: Date, days: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + days);
	return x;
}

function countDaysInclusiveLocal(start: Date, end: Date): number {
	// Avoid ms-based day math because DST transitions can make a “day” 23/25h in local time.
	let n = 0;
	for (let d = new Date(start); d <= end; d = addDaysLocal(d, 1)) n++;
	return n;
}

function mondayIndex(date: Date): number {
	// Mon=0 .. Sun=6
	return (date.getDay() + 6) % 7;
}

function modelKeyFromParts(provider?: unknown, model?: unknown): string | null {
	const p = typeof provider === "string" ? provider.trim() : "";
	const m = typeof model === "string" ? model.trim() : "";
	if (!p && !m) return null;
	if (!p) return m;
	if (!m) return p;
	return `${p}/${m}`;
}

function parseSessionStartFromFilename(name: string): Date | null {
	// Example: 2026-02-02T21-52-28-774Z_<uuid>.jsonl
	const m = name.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_/);
	if (!m) return null;
	const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
	const d = new Date(iso);
	return Number.isFinite(d.getTime()) ? d : null;
}

function extractProviderModelAndUsage(obj: any): { provider?: any; model?: any; modelId?: any; usage?: any } {
	// Session format varies across versions.
	// - Newer: { provider, model, usage } on the message wrapper
	// - Older: { message: { provider, model, usage } }
	const msg = obj?.message;
	return {
		provider: obj?.provider ?? msg?.provider,
		model: obj?.model ?? msg?.model,
		modelId: obj?.modelId ?? msg?.modelId,
		usage: obj?.usage ?? msg?.usage,
	};
}

function readNum(v: any): number {
	if (typeof v === "number") return Number.isFinite(v) ? v : 0;
	if (typeof v === "string") {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

function extractCostTotal(usage: any): number {
	const c = usage?.cost;
	return typeof c === "number" || typeof c === "string" ? readNum(c) : readNum(c?.total);
}

function extractTokensTotal(usage: any): number {
	// Usage format varies across providers and pi versions.
	// We try a few common shapes:
	// - { totalTokens } / { total_tokens } / { tokens: number | { total } }
	// - { promptTokens, completionTokens } / { prompt_tokens, completion_tokens }
	// - { inputTokens, outputTokens } / { input_tokens, output_tokens }
	if (!usage) return 0;

	const total =
		readNum(usage.totalTokens) ||
		readNum(usage.total_tokens) ||
		readNum(usage.tokens) ||
		readNum(usage.tokenCount) ||
		readNum(usage.token_count) ||
		readNum(usage.tokens?.total) ||
		readNum(usage.tokens?.totalTokens) ||
		readNum(usage.tokens?.total_tokens);
	if (total > 0) return total;

	const input = readNum(usage.promptTokens) || readNum(usage.prompt_tokens) || readNum(usage.inputTokens) || readNum(usage.input_tokens);
	const output =
		readNum(usage.completionTokens) || readNum(usage.completion_tokens) || readNum(usage.outputTokens) || readNum(usage.output_tokens);
	const sum = input + output;
	return sum > 0 ? sum : 0;
}

async function parseSessionFile(filePath: string, signal?: AbortSignal): Promise<ParsedSession | null> {
	let startedAt = parseSessionStartFromFilename(path.basename(filePath));
	let currentModel: string | null = null;
	let cwd: string | null = null;
	const total: Totals = { ...emptyTotals(), sessions: 1 };
	const models = new Map<string, Totals>();

	const addUsage = (model: string, usage: any) => {
		const tokens = extractTokensTotal(usage);
		const cost = extractCostTotal(usage);
		if (tokens > 0) {
			total.tokens += tokens;
			totalsFor(models, model).tokens += tokens;
		}
		if (cost > 0) {
			total.cost += cost;
			totalsFor(models, model).cost += cost;
		}
	};

	const stream = createReadStream(filePath, { encoding: "utf8" });
	const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

	try {
		for await (const line of rl) {
			if (signal?.aborted) return null;
			if (!line) continue;
			let obj: any;
			try {
				obj = JSON.parse(line);
			} catch {
				continue;
			}

			if (obj?.type === "session") {
				if (!startedAt && typeof obj?.timestamp === "string") {
					const d = new Date(obj.timestamp);
					if (Number.isFinite(d.getTime())) startedAt = d;
				}
				if (typeof obj?.cwd === "string" && obj.cwd.trim()) {
					cwd = obj.cwd.trim();
				}
				continue;
			}

			if (obj?.type === "model_change") {
				const mk = modelKeyFromParts(obj.provider, obj.modelId);
				if (mk) {
					currentModel = mk;
					totalsFor(models, mk).sessions = 1;
				}
				continue;
			}

			if (obj?.type === "compaction" || obj?.type === "branch_summary") {
				addUsage(currentModel ?? "summary", obj.usage);
				continue;
			}

			if (obj?.type !== "message" && obj?.type !== "usage") continue;

			const { provider, model, modelId, usage } = extractProviderModelAndUsage(obj);
			const mk =
				modelKeyFromParts(provider, model) ??
				modelKeyFromParts(provider, modelId) ??
				currentModel ??
				"unknown";
			const modelTotals = totalsFor(models, mk);
			modelTotals.sessions = 1;

			// Standalone usage (including unknown kinds) is not a conversation message.
			if (obj.type === "message") {
				total.messages += 1;
				modelTotals.messages += 1;
			}
			addUsage(mk, usage);
		}
	} finally {
		rl.close();
		stream.destroy();
	}

	if (!startedAt) return null;
	return {
		startedAt,
		dayKeyLocal: toLocalDayKey(startedAt),
		total,
		models,
		cwd,
		dow: DOW_NAMES[mondayIndex(startedAt)],
		tod: todBucketForHour(startedAt.getHours()),
	};
}

function buildRangeAgg(days: number, now: Date): RangeAgg {
	const start = addDaysLocal(localMidnight(now), -(days - 1));
	const range: RangeAgg = { days: [], dayByKey: new Map(), total: emptyTotals(), by: emptyByView() };
	for (let i = 0; i < days; i++) {
		const date = addDaysLocal(start, i);
		const day: DayAgg = { date, dayKeyLocal: toLocalDayKey(date), total: emptyTotals(), by: emptyByView() };
		range.days.push(day);
		range.dayByKey.set(day.dayKeyLocal, day);
	}
	return range;
}

function addSessionToRange(range: RangeAgg, session: ParsedSession): void {
	const day = range.dayByKey.get(session.dayKeyLocal);
	if (!day) return;

	for (const agg of [range, day]) {
		addTotals(agg.total, session.total);
		for (const [model, totals] of session.models) addTotals(totalsFor(agg.by.model, model), totals);
		for (const view of DIMENSION_VIEWS) {
			const key = session[view];
			if (key) addTotals(totalsFor(agg.by[view], key), session.total);
		}
	}
}

/** Keys with a positive metric value, largest first (stable for ties). */
function rankKeys(map: Map<string, Totals>, metric: keyof Totals): Array<{ key: string; value: number }> {
	return [...map.entries()]
		.map(([key, totals]) => ({ key, value: totals[metric] }))
		.filter((row) => row.value > 0)
		.sort((a, b) => b.value - a.value);
}

function choosePaletteFromLast30Days(range30: RangeAgg, view: "model" | "cwd", topN = 4): Palette {
	// Prefer cost if any cost exists, else tokens, else messages, else sessions.
	const map = range30.by[view];
	const costSum = [...map.values()].reduce((sum, totals) => sum + totals.cost, 0);
	const popularity: keyof Totals =
		costSum > 0 ? "cost" : range30.total.tokens > 0 ? "tokens" : range30.total.messages > 0 ? "messages" : "sessions";
	const ordered = rankKeys(map, popularity).slice(0, topN).map((x) => x.key);
	return { colors: new Map(ordered.map((key, i) => [key, PALETTE[i % PALETTE.length]])), ordered };
}

function fixedPalette(keys: string[], colors: RGB[]): Palette {
	return { colors: new Map(keys.map((key, i) => [key, colors[i]])), ordered: [...keys] };
}

function dayMixedColor(day: DayAgg, colorMap: Map<string, RGB>, mode: MeasurementMode, view: BreakdownView): RGB {
	// For dow, each day IS a single dow – use the dow color directly
	if (view === "dow") return colorMap.get(DOW_NAMES[mondayIndex(day.date)]) ?? OTHER_COLOR;

	let metric: MeasurementMode = "sessions";
	if (mode === "tokens") metric = day.total.tokens > 0 ? "tokens" : day.total.messages > 0 ? "messages" : "sessions";
	else if (mode === "messages") metric = day.total.messages > 0 ? "messages" : "sessions";

	const parts: Array<{ color: RGB; weight: number }> = [];
	let otherWeight = 0;
	for (const [key, totals] of day.by[view].entries()) {
		const c = colorMap.get(key);
		if (c) parts.push({ color: c, weight: totals[metric] });
		else otherWeight += totals[metric];
	}
	if (otherWeight > 0) parts.push({ color: OTHER_COLOR, weight: otherWeight });
	return weightedMix(parts);
}

function graphMetricForRange(range: RangeAgg, mode: MeasurementMode): { kind: MeasurementMode; denom: number } {
	// Fall back to a coarser metric when the requested one has no data.
	const order: MeasurementMode[] = mode === "tokens" ? ["tokens", "messages"] : mode === "messages" ? ["messages"] : [];
	for (const kind of order) {
		const max = Math.max(0, ...range.days.map((d) => d.total[kind]));
		if (max > 0) return { kind, denom: Math.log1p(max) };
	}
	return { kind: "sessions", denom: Math.log1p(Math.max(0, ...range.days.map((d) => d.total.sessions))) };
}

function calendarGrid(range: RangeAgg): { start: Date; end: Date; gridStart: Date; weeks: number } {
	const start = range.days[0].date;
	const end = range.days[range.days.length - 1].date;
	const gridStart = addDaysLocal(start, -mondayIndex(start));
	const gridEnd = addDaysLocal(end, 6 - mondayIndex(end));
	return { start, end, gridStart, weeks: Math.ceil(countDaysInclusiveLocal(gridStart, gridEnd) / 7) };
}

function renderGraphLines(
	range: RangeAgg,
	colorMap: Map<string, RGB>,
	mode: MeasurementMode,
	options: { cellWidth: number; gap: number },
	view: BreakdownView,
): string[] {
	const { start, end, gridStart, weeks } = calendarGrid(range);
	const cellWidth = Math.max(1, Math.floor(options.cellWidth));
	const gap = Math.max(0, Math.floor(options.gap));
	const block = "█".repeat(cellWidth);
	const gapStr = " ".repeat(gap);
	const metric = graphMetricForRange(range, mode);

	// Label only Mon/Wed/Fri like GitHub (saves space)
	const labelByRow = new Map<number, string>([
		[0, "Mon"],
		[2, "Wed"],
		[4, "Fri"],
	]);

	const lines: string[] = [];
	for (let row = 0; row < 7; row++) {
		const label = labelByRow.get(row);
		let line = label ? padRight(label, 3) + " " : "    ";

		for (let w = 0; w < weeks; w++) {
			const cellDate = addDaysLocal(gridStart, w * 7 + row);
			const colGap = w < weeks - 1 ? gapStr : "";
			if (cellDate < start || cellDate > end) {
				line += " ".repeat(cellWidth) + colGap;
				continue;
			}

			const day = range.dayByKey.get(toLocalDayKey(cellDate));
			const value = day?.total[metric.kind] ?? 0;
			if (!day || value <= 0) {
				line += ansiFg(EMPTY_CELL_BG, block) + colGap;
				continue;
			}

			const hue = dayMixedColor(day, colorMap, mode, view);
			const t = clamp01(metric.denom > 0 ? Math.log1p(value) / metric.denom : 0);
			const minVisible = 0.2;
			const rgb = mixRgb(DEFAULT_BG, hue, minVisible + (1 - minVisible) * t);
			line += ansiFg(rgb, block) + colGap;
		}

		lines.push(line);
	}

	return lines;
}

function displayModelName(modelKey: string): string {
	const idx = modelKey.indexOf("/");
	return idx === -1 ? modelKey : modelKey.slice(idx + 1);
}

const TABLES: Record<BreakdownView, { header: string; maxWidth: number; label: (key: string) => string; fixed?: string[]; empty?: string }> = {
	model: { header: "model", maxWidth: 52, label: (key) => key, empty: "(no model data found)" },
	cwd: { header: "directory", maxWidth: 42, label: (key) => abbreviatePath(key, 40), empty: "(no directory data found)" },
	dow: { header: "day", maxWidth: 5, label: (key) => key, fixed: DOW_NAMES },
	tod: { header: "time of day", maxWidth: 22, label: todBucketLabel, fixed: TOD_BUCKETS.map((b) => b.key) },
};

function renderTable(range: RangeAgg, kind: MeasurementMode, view: BreakdownView, maxRows = 8): string[] {
	const table = TABLES[view];
	const map = range.by[view];
	// Weekday and time-of-day tables always show every bucket in calendar order.
	const keys = table.fixed ?? rankKeys(map, kind).slice(0, maxRows).map((row) => row.key);
	const labels = keys.map(table.label);
	const total = range.total[kind];
	const valueWidth = kind === "tokens" ? 10 : 8;
	const keyWidth = table.fixed ? table.maxWidth : Math.min(table.maxWidth, Math.max(table.header.length, ...labels.map((l) => l.length)));

	const lines: string[] = [];
	lines.push(`${padRight(table.header, keyWidth)}  ${padLeft(kind, valueWidth)}  ${padLeft("cost", 10)}  ${padLeft("share", 6)}`);
	lines.push(`${"-".repeat(keyWidth)}  ${"-".repeat(valueWidth)}  ${"-".repeat(10)}  ${"-".repeat(6)}`);
	keys.forEach((key, i) => {
		const totals = map.get(key) ?? emptyTotals();
		const value = totals[kind];
		const share = total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
		lines.push(
			`${padRight(labels[i].slice(0, keyWidth), keyWidth)}  ${padLeft(formatCount(value), valueWidth)}  ${padLeft(formatUsd(totals.cost), 10)}  ${padLeft(share, 6)}`,
		);
	});
	if (keys.length === 0 && table.empty) lines.push(dim(table.empty));
	return lines;
}

function renderDowDistributionLines(range: RangeAgg, mode: MeasurementMode, dowColors: Map<string, RGB>, width: number): string[] {
	const kind = graphMetricForRange(range, mode).kind;
	const total = range.total[kind];
	const dayWidth = 3;
	const pctWidth = 4; // "100%"
	const valueWidth = kind === "tokens" ? 10 : 8;
	const showValue = width >= dayWidth + 1 + 10 + 1 + pctWidth + 1 + valueWidth;
	const fixedWidth = dayWidth + 1 + 1 + pctWidth + (showValue ? 1 + valueWidth : 0);
	const barWidth = Math.max(1, width - fixedWidth);

	return DOW_NAMES.map((dow) => {
		const value = range.by.dow.get(dow)?.[kind] ?? 0;
		const share = total > 0 ? value / total : 0;
		const filled = share > 0 ? Math.min(barWidth, Math.max(1, Math.round(share * barWidth))) : 0;
		const empty = Math.max(0, barWidth - filled);

		const filledBar = filled > 0 ? ansiFg(dowColors.get(dow) ?? OTHER_COLOR, "█".repeat(filled)) : "";
		const emptyBar = empty > 0 ? ansiFg(EMPTY_CELL_BG, "█".repeat(empty)) : "";
		const pct = padLeft(`${Math.round(share * 100)}%`, pctWidth);

		let line = `${padRight(dow, dayWidth)} ${filledBar}${emptyBar} ${pct}`;
		if (showValue) line += ` ${padLeft(formatCount(value), valueWidth)}`;
		return line;
	});
}

function rangeSummary(range: RangeAgg, days: number, mode: MeasurementMode): string {
	const { sessions, messages, tokens, cost } = range.total;
	const avg = sessions > 0 ? cost / sessions : 0;
	const costPart = cost > 0 ? `${formatUsd(cost)} · avg ${formatUsd(avg)}/session` : `$0.0000`;
	const metricPart =
		mode === "tokens" ? ` · ${formatCount(tokens)} tokens` : mode === "messages" ? ` · ${formatCount(messages)} messages` : "";
	return `Last ${days} days: ${formatCount(sessions)} sessions${metricPart} · ${costPart}`;
}

async function computeBreakdown(
	signal?: AbortSignal,
	onProgress?: (update: Partial<BreakdownProgressState>) => void,
): Promise<BreakdownData> {
	const now = new Date();
	const ranges = new Map<number, RangeAgg>();
	for (const d of RANGE_DAYS) ranges.set(d, buildRangeAgg(d, now));
	const start90 = ranges.get(90)!.days[0].date;

	onProgress?.({ phase: "scan", foundFiles: 0, parsedFiles: 0, totalFiles: 0, currentFile: undefined });

	const sessions = await SessionManager.listAll((found) => {
		onProgress?.({ phase: "scan", foundFiles: found });
	});
	const candidates = sessions
		.filter((session) => localMidnight(session.created) >= start90)
		.map((session) => session.path);

	const totalFiles = candidates.length;
	onProgress?.({
		phase: "parse",
		foundFiles: totalFiles,
		totalFiles,
		parsedFiles: 0,
		currentFile: totalFiles > 0 ? path.basename(candidates[0]!) : undefined,
	});

	let parsedFiles = 0;
	for (const filePath of candidates) {
		if (signal?.aborted) break;
		parsedFiles += 1;
		onProgress?.({ phase: "parse", parsedFiles, totalFiles, currentFile: path.basename(filePath) });

		const session = await parseSessionFile(filePath, signal);
		if (!session) continue;
		// Each range ignores sessions outside its own days.
		for (const range of ranges.values()) addSessionToRange(range, session);
	}

	onProgress?.({ phase: "finalize", currentFile: undefined });

	const range30 = ranges.get(30)!;
	const palettes: Record<BreakdownView, Palette> = {
		model: choosePaletteFromLast30Days(range30, "model"),
		cwd: choosePaletteFromLast30Days(range30, "cwd"),
		dow: fixedPalette(DOW_NAMES, DOW_PALETTE),
		tod: fixedPalette(TOD_BUCKETS.map((b) => b.key), TOD_PALETTE),
	};
	return { generatedAt: now, ranges, palettes };
}

const LEGEND_TITLES: Record<BreakdownView, string> = {
	model: "Top models (30d palette):",
	cwd: "Top directories (30d palette):",
	dow: "Time of day:",
	tod: "Time of day:",
};

function legendLabel(view: BreakdownView, key: string): string {
	if (view === "model") return displayModelName(key);
	if (view === "cwd") return abbreviatePath(key, 30);
	return view === "tod" ? todBucketLabel(key) : key;
}

class BreakdownComponent implements Component {
	private data: BreakdownData;
	private tui: TUI;
	private onDone: () => void;
	private rangeIndex = 1; // default 30d
	private measurement: MeasurementMode = "sessions";
	private view: BreakdownView = "model";
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(data: BreakdownData, tui: TUI, onDone: () => void) {
		this.data = data;
		this.tui = tui;
		this.onDone = onDone;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	handleInput(data: string): void {
		const key = data.toLowerCase();
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || key === "q") {
			this.onDone();
			return;
		}

		const cycle = <T,>(items: readonly T[], current: T, dir: number): T =>
			items[(Math.max(0, items.indexOf(current)) + items.length + dir) % items.length];

		if (matchesKey(data, Key.tab) || matchesKey(data, Key.shift("tab")) || key === "t") {
			const order: MeasurementMode[] = ["sessions", "messages", "tokens"];
			this.measurement = cycle(order, this.measurement, matchesKey(data, Key.shift("tab")) ? -1 : 1);
		} else if (matchesKey(data, Key.left) || key === "h") {
			this.rangeIndex = (this.rangeIndex + RANGE_DAYS.length - 1) % RANGE_DAYS.length;
		} else if (matchesKey(data, Key.right) || key === "l") {
			this.rangeIndex = (this.rangeIndex + 1) % RANGE_DAYS.length;
		} else if (matchesKey(data, Key.up) || matchesKey(data, Key.down) || key === "j" || key === "k") {
			this.view = cycle(VIEWS, this.view, matchesKey(data, Key.up) || key === "k" ? -1 : 1);
		} else if (["1", "2", "3"].includes(data)) {
			this.rangeIndex = Number(data) - 1;
		} else {
			return;
		}
		this.invalidate();
		this.tui.requestRender();
	}

	render(width: number): string[] {
		if (this.cachedWidth === width && this.cachedLines) return this.cachedLines;

		const selectedDays = RANGE_DAYS[this.rangeIndex];
		const range = this.data.ranges.get(selectedDays)!;
		const metric = graphMetricForRange(range, this.measurement);
		const palette = this.data.palettes[this.view];

		const tab = (selected: boolean, label: string): string => (selected ? bold(`[${label}]`) : dim(` ${label} `));
		const header =
			`${bold("Session breakdown")}  ` +
			RANGE_DAYS.map((days, idx) => tab(idx === this.rangeIndex, `${days}d`)).join("") +
			"  " +
			(
				[
					["sessions", "sess"],
					["messages", "msg"],
					["tokens", "tok"],
				] as const
			)
				.map(([mode, label]) => tab(mode === this.measurement, label))
				.join("") +
			"  " +
			VIEWS.map((view) => tab(view === this.view, view)).join("");

		// Legend for the current view; model and directory views also show an "other" bucket.
		const legendItems = palette.ordered.flatMap((key) => {
			const c = palette.colors.get(key);
			return c ? [`${ansiFg(c, "█")} ${legendLabel(this.view, key)}`] : [];
		});
		if (this.view === "model" || this.view === "cwd") legendItems.push(`${ansiFg(OTHER_COLOR, "█")} other`);

		const graphDescriptor = this.view === "dow" ? `share of ${metric.kind} by weekday` : `${metric.kind}/day`;
		const summary = rangeSummary(range, selectedDays, metric.kind) + dim(`   (graph: ${graphDescriptor})`);

		let graphLines: string[];
		if (this.view === "dow") {
			graphLines = renderDowDistributionLines(range, this.measurement, palette.colors, width);
		} else {
			const maxScale = selectedDays === 7 ? 4 : selectedDays === 30 ? 3 : 2;
			const weeks = calendarGrid(range).weeks;
			const leftMargin = 4; // "Mon " (or 4 spaces)
			const gap = 1;
			const graphArea = Math.max(1, width - leftMargin);
			// Each week column uses: cellWidth + gap. Last column also gets gap (fine; we truncate anyway).
			const idealCellWidth = Math.floor((graphArea + gap) / Math.max(1, weeks)) - gap;
			const cellWidth = Math.min(maxScale, Math.max(1, idealCellWidth));

			graphLines = renderGraphLines(range, palette.colors, this.measurement, { cellWidth, gap }, this.view);
		}
		const tableLines = renderTable(range, metric.kind, this.view);

		const lines: string[] = [];
		lines.push(truncateToWidth(header, width));
		lines.push(truncateToWidth(dim("←/→ range · ↑/↓ view · tab metric · q to close"), width));
		lines.push("");
		lines.push(truncateToWidth(summary, width));
		lines.push("");

		if (this.view === "dow") {
			for (const gl of graphLines) lines.push(truncateToWidth(gl, width));
		} else {
			// Render legend on the RIGHT of the graph if there is space.
			const graphWidth = Math.max(0, ...graphLines.map((l) => visibleWidth(l)));
			const sep = 2;
			const legendWidth = width - graphWidth - sep;
			const legendTitle = dim(LEGEND_TITLES[this.view]);

			if (legendWidth >= 22) {
				const legendBlock = [legendTitle, ...legendItems];
				// Fit into 7 rows (same as graph). If too many, show a final "+N more" line.
				const maxLegendRows = graphLines.length;
				let legendLines = legendBlock.slice(0, maxLegendRows);
				if (legendBlock.length > maxLegendRows) {
					const remaining = legendBlock.length - (maxLegendRows - 1);
					legendLines = [...legendBlock.slice(0, maxLegendRows - 1), dim(`+${remaining} more`)];
				}

				for (let i = 0; i < graphLines.length; i++) {
					const left = graphLines[i] + " ".repeat(Math.max(0, graphWidth - visibleWidth(graphLines[i])));
					const right = truncateToWidth(legendLines[i] ?? "", Math.max(0, legendWidth));
					lines.push(truncateToWidth(left + " ".repeat(sep) + right, width));
				}
			} else {
				// Fallback: graph only, then a compact legend below.
				for (const gl of graphLines) lines.push(truncateToWidth(gl, width));
				lines.push("");
				lines.push(truncateToWidth(legendTitle, width));
				for (const it of legendItems) lines.push(truncateToWidth(it, width));
			}
		}

		lines.push("");
		for (const tl of tableLines) lines.push(truncateToWidth(tl, width));

		this.cachedWidth = width;
		this.cachedLines = lines.map((l) => (visibleWidth(l) > width ? truncateToWidth(l, width) : l));
		return this.cachedLines;
	}
}

export default function sessionBreakdownExtension(pi: ExtensionAPI) {
	pi.registerCommand("session-breakdown", {
		description: "Interactive breakdown of last 7/30/90 days of Pi session usage (sessions/messages/tokens + cost by model)",
		handler: async (_args, ctx: ExtensionContext) => {
			if (ctx.mode !== "tui") {
				// Non-interactive fallback: just notify.
				const data = await computeBreakdown(undefined);
				const range = data.ranges.get(30)!;
				pi.sendMessage(
					{
						customType: "session-breakdown",
						content: `Session breakdown (non-interactive)\n${rangeSummary(range, 30, "sessions")}`,
						display: true,
					},
					{ triggerTurn: false },
				);
				return;
			}

			let aborted = false;
			const data = await ctx.ui.custom<BreakdownData | null>((tui, theme, _kb, done) => {
				const baseMessage = "Analyzing sessions (last 90 days)…";
				const loader = new BorderedLoader(tui, theme, baseMessage);

				const startedAt = Date.now();
				const progress: BreakdownProgressState = {
					phase: "scan",
					foundFiles: 0,
					parsedFiles: 0,
					totalFiles: 0,
					currentFile: undefined,
				};

				const renderMessage = (): string => {
					const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
					if (progress.phase === "scan") {
						return `${baseMessage}  scanning (${formatCount(progress.foundFiles)} files) · ${elapsed}s`;
					}
					if (progress.phase === "parse") {
						return `${baseMessage}  parsing (${formatCount(progress.parsedFiles)}/${formatCount(progress.totalFiles)}) · ${elapsed}s`;
					}
					return `${baseMessage}  finalizing · ${elapsed}s`;
				};

				// Update every 0.5s so long-running scans show some visible progress.
				setBorderedLoaderMessage(loader, renderMessage());
				const intervalId = setInterval(() => setBorderedLoaderMessage(loader, renderMessage()), 500);

				loader.onAbort = () => {
					aborted = true;
					clearInterval(intervalId);
					done(null);
				};

				computeBreakdown(loader.signal, (update) => Object.assign(progress, update))
					.then((d) => {
						clearInterval(intervalId);
						if (!aborted) done(d);
					})
					.catch((err) => {
						clearInterval(intervalId);
						console.error("session-breakdown: failed to analyze sessions", err);
						if (!aborted) done(null);
					});

				return loader;
			});

			if (!data) {
				ctx.ui.notify(aborted ? "Cancelled" : "Failed to analyze sessions", aborted ? "info" : "error");
				return;
			}

			await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
				return new BreakdownComponent(data, tui, done);
			});
		},
	});
}
