#!/usr/bin/env bun
import { mkdir, open, readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";

export const DEFAULT_MAX_MESSAGES = 100;

export type ChatGptExportFormat = "markdown" | "json";
export interface ChatGptMessage {
	role: string;
	id?: string;
	model?: string;
	text: string;
}

export interface ParsedChatGptExport {
	path: string;
	title?: string;
	sourceUrl?: string;
	savedDate?: string;
	messageCount: number;
	messages: ChatGptMessage[];
}

export function normalizeInputPath(inputPath: string | undefined, cwd: string): string {
	const rawPath = inputPath?.trim().replace(/^@/, "");
	if (!rawPath) throw new Error("A saved ChatGPT HTML export path is required.");
	return path.resolve(cwd, rawPath);
}

function getAttribute(html: string, name: string): string | undefined {
	for (const match of html.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
		if (match[1].toLowerCase() === name.toLowerCase()) {
			return decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "") || undefined;
		}
	}
	return undefined;
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (full, entity: string) => {
			if (entity[0] === "#") {
				const isHex = entity[1]?.toLowerCase() === "x";
				const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
				return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : full;
			}
			return ({ amp: "&", apos: "'", gt: ">", lt: "<", nbsp: "\u00a0", quot: '"' } as Record<string, string>)[entity.toLowerCase()] ?? full;
		});
}

function stripTags(fragment: string): string {
	return decodeHtmlEntities(
		fragment
			.replace(/<br\s*\/?\s*>/gi, "\n")
			.replace(/<[^>]+>/g, "")
			.replace(/[ \t]+\n/g, "\n"),
	);
}

function inlineMarkdown(fragment: string): string {
	return stripTags(
		fragment
			.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_full, code) => `\`${stripTags(code).trim()}\``)
			.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
			.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
			.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "_$1_")
			.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "_$1_"),
	)
		.replace(/\s+/g, " ")
		.trim();
}

function htmlCodeToText(fragment: string): string {
	// Strip export markup before decoding: decoded literal HTML is code, not tags.
	return decodeHtmlEntities(fragment.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, ""));
}

function codeFence(text: string, minimum: number): string {
	return "`".repeat((text.match(/`+/g) ?? []).reduce((size, run) => Math.max(size, run.length + 1), minimum));
}

function htmlToMarkdown(contentHtml: string): string {
	const code: string[] = [];
	const nonce = randomUUID();
	const protect = (value: string) => `\uE000${nonce}:${code.push(value) - 1}\uE001`;
	// Restore code only after prose cleanup, so whitespace and decoded entities survive.
	let text = contentHtml
		.replace(/<script\b[\s\S]*?<\/script>/gi, "")
		.replace(/<style\b[\s\S]*?<\/style>/gi, "")
		.replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
		.replace(/<button\b[\s\S]*?<\/button>/gi, "")
		.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_full, inner: string) => {
			const value = htmlCodeToText(/<code\b[^>]*>([\s\S]*?)<\/code>/i.exec(inner)?.[1] ?? inner);
			const fence = codeFence(value, 3);
			return `\n\n${protect(`${fence}\n${value}${value.endsWith("\n") ? "" : "\n"}${fence}`)}\n\n`;
		})
		.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_full, inner: string) => {
			const value = htmlCodeToText(inner);
			if (!value) return "";
			const fence = codeFence(value, 1);
			const pad = /^`|`$|^ | $/.test(value) && /[^ ]/.test(value) ? " " : "";
			return protect(`${fence}${pad}${value}${pad}${fence}`);
		});

	text = text
		.replace(/<span\b[^>]*data-testid=(?:"webpage-citation-pill"|'webpage-citation-pill'|webpage-citation-pill)[\s\S]*?<\/span>\s*<\/span>/gi, "")
		.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_full, inner) => `\n# ${inlineMarkdown(inner)}\n\n`)
		.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_full, inner) => `\n## ${inlineMarkdown(inner)}\n\n`)
		.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_full, inner) => `\n### ${inlineMarkdown(inner)}\n\n`)
		.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, (_full, inner) => `\n#### ${inlineMarkdown(inner)}\n\n`)
		.replace(/<hr\b[^>]*>/gi, "\n---\n")
		.replace(/<li\b[^>]*>/gi, "\n- ")
		.replace(/<\/li>/gi, "")
		.replace(/<br\s*\/?\s*>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<p\b[^>]*>/gi, "")
		.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
		.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
		.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "_$1_")
		.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "_$1_")
		.replace(/<\/(div|section|article|ul|ol|blockquote|table|thead|tbody|tr)>/gi, "\n")
		.replace(/<[^>]+>/g, "");

	return decodeHtmlEntities(text)
		.replace(/\u00a0/g, " ")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, ""))
		.join("\n")
		.replace(/\n{4,}/g, "\n\n\n")
		.replace(/[ \t]{2,}/g, " ")
		.trim()
		.replace(new RegExp(`\uE000${nonce}:(\\d+)\uE001`, "g"), (_full, index) => code[Number(index)]!);
}

function extractBalancedElement(block: string, startIndex: number, tagName: string): string | undefined {
	const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
	tagPattern.lastIndex = startIndex;
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = tagPattern.exec(block))) {
		const tag = match[0];
		if (tag.startsWith("</")) {
			depth -= 1;
			if (depth === 0) return block.slice(startIndex, tagPattern.lastIndex);
		} else if (!tag.endsWith("/>")) {
			depth += 1;
		}
	}
	return undefined;
}

function extractContent(block: string, role: string): string {
	const className = role === "assistant" ? "markdown[^\"']*prose" : "whitespace-pre-wrap";
	const match = new RegExp(`<div\\b[^>]*class=(?:"[^"]*${className}[^"]*"|'[^']*${className}[^']*')[^>]*>`, "i").exec(block);
	if (match) return extractBalancedElement(block, match.index, "div") ?? block;
	const actionIndex = block.search(/aria-label=(?:"Response actions"|'Response actions'|"Your message actions"|'Your message actions')/i);
	return actionIndex >= 0 ? block.slice(0, actionIndex) : block;
}

export function parseChatGptExportHtml(html: string, sourcePath: string): ParsedChatGptExport {
	const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
	const sourceUrlMatch = /url:\s*(\S+)/i.exec(html);
	const savedDateMatch = /saved date:\s*([^\n\r<]+)/i.exec(html);
	// Read roles only from real opening tags, not code text, quoted attributes or scripts.
	html = html.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, "");
	const tagPattern = /<[a-z][\w:-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
	const turns: Array<{ role: string; index: number; tag: string }> = [];
	let match: RegExpExecArray | null;
	while ((match = tagPattern.exec(html))) {
		const role = getAttribute(match[0], "data-message-author-role");
		if (role) turns.push({ role, index: match.index, tag: match[0] });
	}

	const messages: ChatGptMessage[] = [];
	for (let index = 0; index < turns.length; index += 1) {
		const turn = turns[index];
		const block = html.slice(turn.index, turns[index + 1]?.index ?? html.length);
		const text = htmlToMarkdown(extractContent(block, turn.role));
		if (!text) continue;
		messages.push({
			role: turn.role,
			id: getAttribute(turn.tag, "data-message-id"),
			model: getAttribute(turn.tag, "data-message-model-slug"),
			text,
		});
	}

	return {
		path: sourcePath,
		title: titleMatch ? inlineMarkdown(titleMatch[1]) : undefined,
		sourceUrl: sourceUrlMatch?.[1],
		savedDate: savedDateMatch?.[1]?.replace(/\s*-->$/, "").trim(),
		messageCount: messages.length,
		messages,
	};
}

export function limitMessages(parsed: ParsedChatGptExport, maxMessages?: number): ParsedChatGptExport {
	if (!Number.isFinite(maxMessages) || maxMessages === undefined || maxMessages <= 0) return parsed;
	const limit = Math.floor(maxMessages);
	return parsed.messages.length <= limit
		? parsed
		: { ...parsed, messages: parsed.messages.slice(-limit) };
}

export function renderMarkdown(parsed: ParsedChatGptExport): string {
	const lines = [`# ${parsed.title || "ChatGPT Export"}`, "", `- Source file: ${parsed.path}`];
	if (parsed.sourceUrl) lines.push(`- Source URL: ${parsed.sourceUrl}`);
	if (parsed.savedDate) lines.push(`- Saved date: ${parsed.savedDate}`);
	lines.push(`- Messages parsed: ${parsed.messageCount}`, "");
	parsed.messages.forEach((message, index) => {
		const role = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : message.role;
		lines.push(`## ${index + 1}. ${role}${message.model ? ` (${message.model})` : ""}`, "", message.text, "");
	});
	return `${lines.join("\n").trimEnd()}\n`;
}

export function renderExport(parsed: ParsedChatGptExport, format: ChatGptExportFormat): string {
	return format === "json" ? `${JSON.stringify(parsed, null, 2)}\n` : renderMarkdown(parsed);
}

export async function writeExportOutput(sourcePath: string, outputPath: string, content: string): Promise<void> {
	const source = await stat(sourcePath);
	const isInput = (info: { dev: number; ino: number }) => info.dev === source.dev && info.ino === source.ino;
	const existing = await stat(outputPath).catch((error) => {
		if (error.code !== "ENOENT") throw error;
		return undefined;
	});
	if (existing && isInput(existing)) throw new Error("Output must not overwrite the input export (including file aliases).");
	await mkdir(path.dirname(outputPath), { recursive: true });
	// Open without truncation, then check the actual file before writing. A changed
	// symlink cannot redirect the later write onto an unchecked input inode.
	const output = await open(outputPath, "a");
	try {
		if (isInput(await output.stat())) throw new Error("Output must not overwrite the input export (including file aliases).");
		await output.truncate(0);
		await output.writeFile(content, "utf8");
	} finally { await output.close(); }
}

export async function runCli(argv = process.argv.slice(2), cwd = process.cwd()): Promise<string> {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			format: { type: "string", default: "markdown" },
			output: { type: "string" },
			"max-messages": { type: "string", default: String(DEFAULT_MAX_MESSAGES) },
		},
	});
	if (positionals.length !== 1) throw new Error("Usage: chatgpt-export <html-path> [--format markdown|json] [--max-messages N] [--output path]");
	if (values.format !== "markdown" && values.format !== "json") throw new Error("--format must be markdown or json.");
	const maxMessages = Number(values["max-messages"]);
	if (!Number.isInteger(maxMessages) || maxMessages < 1) throw new Error("--max-messages must be a positive integer.");

	const sourcePath = normalizeInputPath(positionals[0], cwd);
	const parsed = limitMessages(parseChatGptExportHtml(await readFile(sourcePath, "utf8"), sourcePath), maxMessages);
	const output = renderExport(parsed, values.format);
	if (!values.output) return output;
	const outputPath = path.resolve(cwd, values.output.replace(/^@/, ""));
	await writeExportOutput(sourcePath, outputPath, output);
	return `Saved ${outputPath}\n`;
}

if (import.meta.main) {
	runCli()
		.then((output) => process.stdout.write(output))
		.catch((error) => {
			process.stderr.write(`chatgpt-export: ${error.message}\n`);
			process.exitCode = 1;
		});
}
