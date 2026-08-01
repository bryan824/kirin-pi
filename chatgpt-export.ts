#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
	const pattern = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
	const match = pattern.exec(html);
	return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "") || undefined;
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (full, entity: string) => {
			if (entity[0] === "#") {
				const isHex = entity[1]?.toLowerCase() === "x";
				const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
				return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : full;
			}
			return ({ amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' } as Record<string, string>)[entity.toLowerCase()] ?? full;
		})
		.replace(/\u00a0/g, " ");
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
	return stripTags(fragment).replace(/\n{3,}/g, "\n\n").trimEnd();
}

function htmlToMarkdown(contentHtml: string): string {
	let text = contentHtml.replace(/<pre\b[\s\S]*?<code\b[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi, (_full, code) => {
		return `\n\n\`\`\`\n${htmlCodeToText(code)}\n\`\`\`\n\n`;
	});

	text = text
		.replace(/<script\b[\s\S]*?<\/script>/gi, "")
		.replace(/<style\b[\s\S]*?<\/style>/gi, "")
		.replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
		.replace(/<button\b[\s\S]*?<\/button>/gi, "")
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
		.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_full, code) => `\`${stripTags(code).trim()}\``)
		.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
		.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
		.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "_$1_")
		.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "_$1_")
		.replace(/<\/(div|section|article|ul|ol|blockquote|table|thead|tbody|tr)>/gi, "\n")
		.replace(/<[^>]+>/g, "");

	return decodeHtmlEntities(text)
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/g, ""))
		.join("\n")
		.replace(/\n{4,}/g, "\n\n\n")
		.replace(/[ \t]{2,}/g, " ")
		.trim();
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
	const rolePattern = /data-message-author-role=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
	const turns: Array<{ role: string; index: number }> = [];
	let match: RegExpExecArray | null;
	while ((match = rolePattern.exec(html))) turns.push({ role: match[1] ?? match[2] ?? match[3] ?? "unknown", index: match.index });

	const messages: ChatGptMessage[] = [];
	for (let index = 0; index < turns.length; index += 1) {
		const turn = turns[index];
		const block = html.slice(turn.index, turns[index + 1]?.index ?? html.length);
		const text = htmlToMarkdown(extractContent(block, turn.role));
		if (!text) continue;
		messages.push({
			role: turn.role,
			id: getAttribute(block, "data-message-id"),
			model: getAttribute(block, "data-message-model-slug"),
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
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, output, "utf8");
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
