import { App, TFile, TFolder } from "obsidian";
import type { ClioSettings } from "../settings";
import {
	CLIO_IGNORE_MARKER,
	blockHasIgnoreMarker,
	extractQuoteContent,
} from "./parser";
import { formatClioQuoteBlock } from "./inbox";
import {
	isClioQuoteFenceLang,
	parseClioQuoteFields,
} from "../utils/clio-quote";

export type CandidateKind = "blockquote" | "clio-quote";

/**
 * A single block in the vault that the migration helper wants to
 * surface for review. There are two flavors:
 *
 *  - `blockquote`: a `>` blockquote or quote-callout that hasn't been
 *    structured yet. Conversion replaces it with a `clio-quote` block.
 *  - `clio-quote`: an existing `clio-quote` block whose `quote:` field
 *    still contains inline attribution like `"..." — Author`.
 *    Conversion rewrites it with the author/source split into their
 *    own fields.
 */
export interface QuoteCandidate {
	file: TFile;
	kind: CandidateKind;
	/** 0-based line index of the block's first line. */
	startLine: number;
	/** 0-based line index of the block's last line, inclusive. */
	endLine: number;
	/** Raw original lines of the block, exactly as they live in the file. */
	rawLines: string[];
	/** True only for blockquote callouts (`> [!quote]` etc.). */
	isCallout: boolean;
	/** Extracted quote text (after stripping callout/attribution). */
	text: string;
	author: string;
	source: string;
	tags: string[];
}

interface RawBlock {
	startLine: number;
	endLine: number;
	rawLines: string[];
	innerLines: string[];
	isCallout: boolean;
}

/**
 * Walk a markdown document and pull out every contiguous blockquote
 * (including Obsidian callouts), tracking the exact raw lines so the
 * converter can replace them precisely.
 *
 * Skips fenced code blocks - we don't want to mistake a `> ` inside a
 * code example for a real blockquote.
 */
function scanRawBlockquotes(content: string): RawBlock[] {
	const lines = content.split(/\r?\n/);
	const blocks: RawBlock[] = [];
	let current: RawBlock | null = null;
	let inCodeFence = false;

	const flush = (endLine: number): void => {
		if (!current) return;
		current.endLine = endLine;
		blocks.push(current);
		current = null;
	};

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i] ?? "";
		if (/^\s*```/.test(raw)) {
			flush(i - 1);
			inCodeFence = !inCodeFence;
			continue;
		}
		if (inCodeFence) continue;

		const m = /^\s*>\s?(.*)$/.exec(raw);
		if (m) {
			const inner = m[1] ?? "";
			if (!current) {
				current = {
					startLine: i,
					endLine: i,
					rawLines: [raw],
					innerLines: [inner],
					isCallout: /^\s*\[![^\]]+\]/.test(inner),
				};
			} else {
				current.rawLines.push(raw);
				current.innerLines.push(inner);
			}
		} else {
			flush(i - 1);
		}
	}
	flush(lines.length - 1);
	return blocks;
}

/** Marker that suppresses migration prompts for a `clio-quote` block. */
const CLIO_QUOTE_KEEP_MARKER_RE =
	/^\s*#\s*(?:clio|almanac|muse):keep\s*$/i;

function clioQuoteBlockHasKeepMarker(rawLines: readonly string[]): boolean {
	for (const line of rawLines) {
		if (CLIO_QUOTE_KEEP_MARKER_RE.test(line)) return true;
		if (line.includes(CLIO_IGNORE_MARKER)) return true;
	}
	return false;
}

interface RawClioQuoteBlock {
	startLine: number;
	endLine: number;
	rawLines: string[];
	innerLines: string[];
}

/**
 * Variant of `extractClioQuoteBlocks` that also tracks the raw lines
 * and the closing fence's line number, so the converter can replace
 * the entire fenced block precisely.
 */
function scanRawClioQuoteBlocks(content: string): RawClioQuoteBlock[] {
	const lines = content.split(/\r?\n/);
	const blocks: RawClioQuoteBlock[] = [];
	const fenceRe = /^\s*```\s*(\S*)\s*$/;
	let blockStart = -1;
	let buffer: string[] = [];
	let inOtherFence = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const fence = fenceRe.exec(line);

		if (blockStart >= 0) {
			if (fence) {
				blocks.push({
					startLine: blockStart,
					endLine: i,
					rawLines: lines.slice(blockStart, i + 1),
					innerLines: buffer,
				});
				blockStart = -1;
				buffer = [];
			} else {
				buffer.push(line);
			}
			continue;
		}

		if (inOtherFence) {
			if (fence) inOtherFence = false;
			continue;
		}

		if (fence) {
			const lang = fence[1] ?? "";
			if (isClioQuoteFenceLang(lang)) {
				blockStart = i;
				buffer = [];
			} else {
				inOtherFence = true;
			}
		}
	}
	return blocks;
}

/**
 * Scan every in-scope markdown file for migration candidates.
 *
 * Two passes:
 *  1. Bare blockquotes / quote-callouts that aren't structured yet.
 *  2. Existing `clio-quote` blocks where the `quote:` field still
 *     carries inline attribution that could be split into a real
 *     `author:` / `source:` pair.
 *
 * Candidates are sorted by file ascending, then by line **descending**
 * within each file. That lets the converter apply edits in the order
 * the user sees them without invalidating later candidates' line
 * numbers (each conversion may add or remove lines).
 */
export async function scanForBlockquoteQuotes(
	app: App,
	settings: ClioSettings,
): Promise<QuoteCandidate[]> {
	const files = collectFiles(app, settings.quoteFolders);
	const out: QuoteCandidate[] = [];
	for (const file of files) {
		const content = await app.vault.cachedRead(file);

		for (const block of scanRawBlockquotes(content)) {
			if (blockHasIgnoreMarker(block.innerLines)) continue;
			const parsed = extractQuoteContent(
				block.innerLines,
				block.isCallout,
			);
			if (!parsed) continue;
			let { text, author, source } = parsed;
			// The line-level parser only catches attribution on its own
			// line (`> — Author`). For migration we're more aggressive
			// and also try to peel attribution off the end of a single-
			// line blockquote like `> "..." — Author`. Users can still
			// edit anything we get wrong in the modal.
			if (!author) {
				const inline = extractInlineAttribution(text);
				if (inline) {
					text = inline.body;
					author = inline.author;
					source = inline.source || source;
				}
			}
			out.push({
				file,
				kind: "blockquote",
				startLine: block.startLine,
				endLine: block.endLine,
				rawLines: block.rawLines,
				isCallout: block.isCallout,
				text,
				author,
				source,
				tags: parsed.tags,
			});
		}

		for (const block of scanRawClioQuoteBlocks(content)) {
			if (clioQuoteBlockHasKeepMarker(block.rawLines)) continue;
			const fields = parseClioQuoteFields(block.innerLines);
			const author = (fields["author"] ?? "").trim();
			// Only flag clio-quote blocks where the user hasn't already
			// supplied an author - we don't want to second-guess
			// intentional edits.
			if (author) continue;
			const text = (fields["quote"] ?? fields["text"] ?? "").trim();
			if (!text) continue;
			const inline = extractInlineAttribution(text);
			if (!inline) continue;
			out.push({
				file,
				kind: "clio-quote",
				startLine: block.startLine,
				endLine: block.endLine,
				rawLines: block.rawLines,
				isCallout: false,
				text: inline.body,
				author: inline.author,
				source: inline.source || (fields["source"] ?? "").trim(),
				tags: parseTagsField(fields["tags"] ?? ""),
			});
		}
	}
	out.sort((a, b) => {
		const cmp = a.file.path.localeCompare(b.file.path);
		if (cmp !== 0) return cmp;
		return b.startLine - a.startLine;
	});
	return out;
}

function parseTagsField(raw: string): string[] {
	return raw
		.split(",")
		.map((t) => t.trim().replace(/^#/, ""))
		.filter(Boolean);
}

const INLINE_ATTRIBUTION_PATTERNS: readonly RegExp[] = [
	// em-dash / en-dash: `body — Author` or `body – Author`
	/^(.{4,}?)\s+[—–]+\s+(.+?)\s*$/,
	// double-hyphen ASCII: `body -- Author`
	/^(.{4,}?)\s+--\s+(.+?)\s*$/,
	// single-hyphen with surrounding spaces: `body - Author` (kept last
	// because it's the most ambiguous - hyphenated phrases inside a
	// quote shouldn't fool us).
	/^(.{4,}?)\s+-\s+(.+?)\s*$/,
];

interface InlineAttribution {
	body: string;
	author: string;
	source: string;
}

/**
 * Detect a trailing `... — Author[, Source]` clause on a one-line quote.
 *
 * Returns null when no plausible boundary is found. Uses a generous
 * minimum body length to keep things like `1 - Foo` from being misread
 * as `body=1, author=Foo`.
 */
function extractInlineAttribution(text: string): InlineAttribution | null {
	for (const re of INLINE_ATTRIBUTION_PATTERNS) {
		const m = re.exec(text);
		if (!m) continue;
		const rawBody = (m[1] ?? "").trim();
		const after = (m[2] ?? "").trim();
		if (!rawBody || !after) continue;
		const body = stripWrappingQuotes(rawBody);
		if (!body) continue;
		const commaIdx = after.indexOf(",");
		const author =
			commaIdx === -1 ? after : after.slice(0, commaIdx).trim();
		const source =
			commaIdx === -1 ? "" : after.slice(commaIdx + 1).trim();
		return { body, author, source };
	}
	return null;
}

/** Trim a single layer of matching ASCII or curly quote marks. */
function stripWrappingQuotes(value: string): string {
	const first = value.charAt(0);
	const last = value.charAt(value.length - 1);
	const opens = ['"', "'", "\u201c", "\u2018"];
	const closes = ['"', "'", "\u201d", "\u2019"];
	if (opens.includes(first) && closes.includes(last) && value.length > 1) {
		return value.slice(1, -1).trim();
	}
	return value;
}

export type ConvertResult =
	| { ok: true }
	| { ok: false; reason: "file-changed" | "missing" };

/**
 * Optional user edits applied at conversion time. Anything left
 * undefined falls back to the candidate's auto-detected value.
 */
export interface ConvertOverrides {
	text?: string;
	author?: string;
	source?: string;
	tags?: string[];
}

/**
 * Replace a candidate's lines with a freshly formatted `clio-quote`
 * block. Re-reads the file to verify the original lines are still in
 * place; bails when the file has been edited so we don't scribble over
 * the user's changes.
 */
export async function convertCandidate(
	app: App,
	candidate: QuoteCandidate,
	overrides: ConvertOverrides = {},
): Promise<ConvertResult> {
	const file = app.vault.getAbstractFileByPath(candidate.file.path);
	if (!(file instanceof TFile)) return { ok: false, reason: "missing" };

	const content = await app.vault.read(file);
	const lines = content.split(/\r?\n/);

	for (let i = 0; i < candidate.rawLines.length; i++) {
		if (lines[candidate.startLine + i] !== candidate.rawLines[i]) {
			return { ok: false, reason: "file-changed" };
		}
	}

	const block = formatClioQuoteBlock({
		text: overrides.text ?? candidate.text,
		author: overrides.author ?? candidate.author,
		source: overrides.source ?? candidate.source,
		tags: overrides.tags ?? candidate.tags,
	});
	const before = lines.slice(0, candidate.startLine);
	const after = lines.slice(candidate.endLine + 1);
	const next = [...before, ...block.split("\n"), ...after].join("\n");
	await app.vault.modify(file, next);
	return { ok: true };
}

/**
 * Mark a candidate so the migration scanner (and, for blockquotes,
 * the quote indexer) permanently skips it.
 *
 *  - **Blockquote**: appends `%%clio:ignore%%` (an Obsidian inline
 *    comment) to the last line. Invisible in reading mode. The quote
 *    indexer also respects this marker, so a marked blockquote stops
 *    showing up in the daily / random pickers.
 *  - **clio-quote** block: inserts a `# clio:keep` comment line right
 *    after the opening fence. The fields parser already ignores
 *    `#`-prefixed lines, so it doesn't change how the block renders.
 *    Indexing isn't affected - the block is still a real quote.
 */
export async function markCandidateIgnored(
	app: App,
	candidate: QuoteCandidate,
): Promise<ConvertResult> {
	const file = app.vault.getAbstractFileByPath(candidate.file.path);
	if (!(file instanceof TFile)) return { ok: false, reason: "missing" };

	const content = await app.vault.read(file);
	const lines = content.split(/\r?\n/);

	for (let i = 0; i < candidate.rawLines.length; i++) {
		if (lines[candidate.startLine + i] !== candidate.rawLines[i]) {
			return { ok: false, reason: "file-changed" };
		}
	}

	if (candidate.kind === "blockquote") {
		const lastIdx = candidate.endLine;
		const lastLine = lines[lastIdx] ?? "";
		if (!lastLine.includes(CLIO_IGNORE_MARKER)) {
			lines[lastIdx] = `${lastLine.trimEnd()} ${CLIO_IGNORE_MARKER}`;
		}
	} else {
		// Insert a comment line just after the opening fence. Bail out
		// if the marker is somehow already present (no-op write would
		// still move modify timestamps unnecessarily).
		if (!clioQuoteBlockHasKeepMarker(candidate.rawLines)) {
			lines.splice(candidate.startLine + 1, 0, "# clio:keep");
		}
	}

	await app.vault.modify(file, lines.join("\n"));
	return { ok: true };
}

function collectFiles(app: App, folders: readonly string[]): TFile[] {
	if (folders.length === 0) {
		return app.vault.getMarkdownFiles();
	}
	const out: TFile[] = [];
	const seen = new Set<string>();
	for (const path of folders) {
		const node = app.vault.getAbstractFileByPath(path);
		if (node instanceof TFolder) {
			collectFolder(node, out, seen);
		} else if (node instanceof TFile && node.extension === "md") {
			if (!seen.has(node.path)) {
				out.push(node);
				seen.add(node.path);
			}
		}
	}
	return out;
}

function collectFolder(
	folder: TFolder,
	out: TFile[],
	seen: Set<string>,
): void {
	for (const child of folder.children) {
		if (child instanceof TFolder) {
			collectFolder(child, out, seen);
		} else if (child instanceof TFile && child.extension === "md") {
			if (!seen.has(child.path)) {
				out.push(child);
				seen.add(child.path);
			}
		}
	}
}

/**
 * Build a `clio-quote` block string from a candidate, used by the
 * migration modal's preview pane so users can see exactly what will
 * land in the file before they commit. Accepts the same overrides
 * shape as {@link convertCandidate} so the preview tracks live edits.
 */
export function previewClioQuoteBlock(
	candidate: QuoteCandidate,
	overrides: ConvertOverrides = {},
): string {
	return formatClioQuoteBlock({
		text: overrides.text ?? candidate.text,
		author: overrides.author ?? candidate.author,
		source: overrides.source ?? candidate.source,
		tags: overrides.tags ?? candidate.tags,
	});
}
