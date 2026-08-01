/** Pi adapter for the shared ChatGPT export parser. */
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
import {
	DEFAULT_MAX_MESSAGES,
	limitMessages,
	normalizeInputPath,
	parseChatGptExportHtml,
	renderExport,
	type ChatGptExportFormat,
} from "../chatgpt-export.ts";

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
		description: "Path to a saved ChatGPT HTML export provided by the user. No default is configured because exports are local/private files.",
	}),
	format: Type.Optional(StringEnum(["markdown", "json"] as const, {
		description: "Output format. markdown is easiest for the LLM to read; json preserves message metadata.",
	})),
	outputPath: Type.Optional(Type.String({
		description: "Optional path to write the full parsed output. If omitted and output is large, the full output is saved to a temp file.",
	})),
	maxMessages: Type.Optional(Type.Integer({
		minimum: 1,
		description: "Maximum messages to include. Defaults to the most recent 100 messages.",
	})),
}, { additionalProperties: false });

async function writeOutputFile(outputPath: string, content: string, cwd: string): Promise<string> {
	const normalized = path.resolve(cwd, outputPath.replace(/^@/, ""));
	await mkdir(path.dirname(normalized), { recursive: true });
	await withFileMutationQueue(normalized, async () => writeFile(normalized, content, "utf8"));
	return normalized;
}

export default function chatGptExportExtension(pi: ExtensionAPI) {
	pi.registerTool({
		name: "parse_chatgpt_export",
		label: "Parse ChatGPT Export",
		description: `Parse a saved ChatGPT HTML export into Markdown or JSON. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is written to a temp file when needed.`,
		promptSnippet: "Parse saved ChatGPT/SingleFile HTML exports into readable Markdown or JSON",
		promptGuidelines: [
			"Use parse_chatgpt_export when the user points to a saved ChatGPT HTML export or asks to recover prior recommendations from one.",
			"Ask the user for the local HTML export path before calling parse_chatgpt_export; it intentionally has no default path because exports are local/private files.",
		],
		parameters: ChatGptExportParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (signal?.aborted) return { content: [{ type: "text", text: "Cancelled" }], details: {} };

			const sourcePath = normalizeInputPath(params.path, ctx.cwd);
			const format = params.format ?? "markdown";
			const parsed = limitMessages(
				parseChatGptExportHtml(await readFile(sourcePath, "utf8"), sourcePath),
				params.maxMessages ?? DEFAULT_MAX_MESSAGES,
			);
			const output = renderExport(parsed, format);
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
			return { content: [{ type: "text", text: resultText }], details };
		},
	});
}
