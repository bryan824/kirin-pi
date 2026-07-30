/**
 * ChatGPT Export Parser
 *
 * Parses locally saved ChatGPT/SingleFile HTML exports into compact Markdown or JSON
 * so future Pi sessions can recover recommendations from browser-saved conversations.
 */
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
	withFileMutationQueue,
	type ExtensionAPI,
	type TruncationResult,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_MAX_MESSAGES = 100;

type ChatGptExportFormat = "markdown" | "json";
type ChatGptRole = "user" | "assistant" | string;

interface ChatGptMessage {
	role: ChatGptRole;
	id?: string;
	model?: string;
	text: string;
}

interface ParsedChatGptExport {
	path: string;
	title?: string;
	sourceUrl?: string;
	savedDate?: string;
	messageCount: number;
	messages: ChatGptMessage[];
}

interface ChatGptExportDetails {
	path: string;
	format: ChatGptExportFormat;
	messageCount: number;
	title?: string;
	sourceUrl?: string;
	savedDate?: string;
	outputPath?: string;
	truncation?: TruncationResult;
}

const ChatGptExportParams = Type.Object({
	path: Type.String({
		description:
			"Path to a saved ChatGPT HTML export provided by the user. No default is configured because exports are local/private files.",
	}),
	format: Type.Optional(
		StringEnum(["markdown", "json"] as const, {
			description: "Output format. markdown is easiest for the LLM to read; json preserves message metadata.",
		}),
	),
	outputPath: Type.Optional(
		Type.String({
			description:
				"Optional path to write the full parsed output. If omitted and output is large, the full output is saved to a temp file.",
		}),
	),
	maxMessages: Type.Optional(
		Type.Integer({
			minimum: 1,
			description: "Maximum messages to include from the export. Defaults to the most recent 100 messages.",
		}),
	),
});

function normalizeInputPath(inputPath: string | undefined, cwd: string): string {
	const rawPath = inputPath?.trim().replace(/^@/, "");
	if (!rawPath) {
		throw new Error("parse_chatgpt_export requires a path to a user-provided saved ChatGPT HTML export.");
	}
	return path.resolve(cwd, rawPath);
}

function getAttribute(html: string, name: string): string | undefined {
	const pattern = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
	const match = pattern.exec(html);
	return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "") || undefined;
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (_full, entity: string) => {
			if (entity[0] === "#") {
				const isHex = entity[1]?.toLowerCase() === "x";
				const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
				return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _full;
			}

			const named: Record<string, string> = {
				amp: "&",
				apos: "'",
				gt: ">",
				lt: "<",
				nbsp: " ",
				quot: '"',
			};
			return named[entity.toLowerCase()] ?? _full;
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
	let text = contentHtml;

	// ChatGPT's SingleFile exports wrap CodeMirror code in large <pre> UI shells.
	text = text.replace(/<pre\b[\s\S]*?<code\b[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi, (_full, code) => {
		const codeText = htmlCodeToText(code);
		return `\n\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
	});

	// Remove UI-only fragments before turning remaining tags into Markdown.
	text = text
		.replace(/<script\b[\s\S]*?<\/script>/gi, "")
		.replace(/<style\b[\s\S]*?<\/style>/gi, "")
		.replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
		.replace(/<button\b[\s\S]*?<\/button>/gi, "")
		.replace(/<span\b[^>]*data-testid=(?:"webpage-citation-pill"|'webpage-citation-pill'|webpage-citation-pill)[\s\S]*?<\/span>\s*<\/span>/gi, "");

	text = text
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
		const isClosing = tag.startsWith(`</`);
		const isSelfClosing = tag.endsWith("/>");

		if (isClosing) {
			depth -= 1;
			if (depth === 0) {
				return block.slice(startIndex, tagPattern.lastIndex);
			}
		} else if (!isSelfClosing) {
			depth += 1;
		}
	}

	return undefined;
}

function extractAssistantContent(block: string): string | undefined {
	const match = /<div\b[^>]*class=(?:"[^"]*markdown[^"]*prose[^"]*"|'[^']*markdown[^']*prose[^']*')[^>]*>/i.exec(block);
	if (!match) return undefined;
	return extractBalancedElement(block, match.index, "div");
}

function extractUserContent(block: string): string | undefined {
	const match = /<div\b[^>]*class=(?:"[^"]*whitespace-pre-wrap[^"]*"|'[^']*whitespace-pre-wrap[^']*')[^>]*>/i.exec(block);
	if (!match) return undefined;
	return extractBalancedElement(block, match.index, "div");
}

function extractFallbackContent(block: string): string {
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
	while ((match = rolePattern.exec(html))) {
		turns.push({ role: match[1] ?? match[2] ?? match[3] ?? "unknown", index: match.index });
	}

	const messages: ChatGptMessage[] = [];
	for (let i = 0; i < turns.length; i += 1) {
		const turn = turns[i];
		const next = turns[i + 1];
		const block = html.slice(turn.index, next?.index ?? html.length);
		const contentHtml =
			turn.role === "assistant"
				? (extractAssistantContent(block) ?? extractFallbackContent(block))
				: (extractUserContent(block) ?? extractFallbackContent(block));
		const text = htmlToMarkdown(contentHtml);
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
		savedDate: savedDateMatch?.[1]?.trim(),
		messageCount: messages.length,
		messages,
	};
}

function limitMessages(parsed: ParsedChatGptExport, maxMessages?: number): ParsedChatGptExport {
	if (!Number.isFinite(maxMessages) || maxMessages === undefined || maxMessages <= 0) {
		return parsed;
	}
	const limit = Math.floor(maxMessages);
	if (parsed.messages.length <= limit) return parsed;
	return {
		...parsed,
		messageCount: parsed.messages.length,
		messages: parsed.messages.slice(Math.max(0, parsed.messages.length - limit)),
	};
}

export function renderMarkdown(parsed: ParsedChatGptExport): string {
	const lines: string[] = [];
	lines.push(`# ${parsed.title || "ChatGPT Export"}`);
	lines.push("");
	lines.push(`- Source file: ${parsed.path}`);
	if (parsed.sourceUrl) lines.push(`- Source URL: ${parsed.sourceUrl}`);
	if (parsed.savedDate) lines.push(`- Saved date: ${parsed.savedDate}`);
	lines.push(`- Messages parsed: ${parsed.messageCount}`);
	lines.push("");

	parsed.messages.forEach((message, index) => {
		const role = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : message.role;
		const model = message.model ? ` (${message.model})` : "";
		lines.push(`## ${index + 1}. ${role}${model}`);
		lines.push("");
		lines.push(message.text);
		lines.push("");
	});

	return lines.join("\n").trimEnd() + "\n";
}

async function writeOutputFile(outputPath: string, content: string, cwd: string): Promise<string> {
	const normalized = path.resolve(cwd, outputPath.replace(/^@/, ""));
	await mkdir(path.dirname(normalized), { recursive: true });
	await withFileMutationQueue(normalized, async () => {
		await writeFile(normalized, content, "utf8");
	});
	return normalized;
}

export default function chatGptExportExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "parse_chatgpt_export",
		label: "Parse ChatGPT Export",
		description: `Parse a saved ChatGPT HTML export into Markdown or JSON. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is written to a temp file when needed. Uses only Node built-ins plus Pi's extension API.`,
		promptSnippet: "Parse saved ChatGPT/SingleFile HTML exports into readable Markdown or JSON",
		promptGuidelines: [
			"Use parse_chatgpt_export when the user points to a saved ChatGPT HTML export or asks to recover prior recommendations from one.",
			"Ask the user for the local HTML export path before calling parse_chatgpt_export; it intentionally has no default path because exports are local/private files.",
		],
		parameters: ChatGptExportParams,
		constrainedSampling: { type: "json_schema", strict: "prefer" },

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (signal?.aborted) {
				return { content: [{ type: "text", text: "Cancelled" }], details: {} };
			}

			const sourcePath = normalizeInputPath(params.path, ctx.cwd);
			const format = params.format ?? "markdown";
			const rawHtml = await readFile(sourcePath, "utf8");
			const parsed = limitMessages(
				parseChatGptExportHtml(rawHtml, sourcePath),
				params.maxMessages ?? DEFAULT_MAX_MESSAGES,
			);
			const output = format === "json" ? JSON.stringify(parsed, null, 2) + "\n" : renderMarkdown(parsed);

			let outputPath = params.outputPath ? await writeOutputFile(params.outputPath, output, ctx.cwd) : undefined;
			const truncation = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
			let resultText = truncation.content;

			if (truncation.truncated && !outputPath) {
				const tempDir = await mkdtemp(path.join(tmpdir(), "pi-chatgpt-export-"));
				outputPath = await writeOutputFile(path.join(tempDir, `chatgpt-export.${format === "json" ? "json" : "md"}`), output, ctx.cwd);
			}

			if (truncation.truncated) {
				resultText += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`;
				resultText += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
				if (outputPath) resultText += ` Full output saved to: ${outputPath}`;
				resultText += "]";
			} else if (outputPath) {
				resultText += `\n\n[Full output saved to: ${outputPath}]`;
			}

			const details: ChatGptExportDetails = {
				path: sourcePath,
				format,
				messageCount: parsed.messageCount,
				title: parsed.title,
				sourceUrl: parsed.sourceUrl,
				savedDate: parsed.savedDate,
				outputPath,
				truncation: truncation.truncated ? truncation : undefined,
			};

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},
	});
}
