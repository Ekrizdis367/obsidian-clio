import type { Quote, QuoteSourceMode } from "../types";
import { hashString } from "../utils/date";
import {
	extractMuseQuoteBlocks,
	type MuseQuoteBlock,
} from "../utils/muse-quote";

interface ParsedBlock {
	/** Raw inner lines of the blockquote, with the leading `>` stripped. */
	lines: string[];
	/** 0-based line of the first `>` line in the source file. */
	startLine: number;
	/** True when the first inner line started with `[!callout-name]`. */
	isCallout: boolean;
}

/**
 * Extracts every blockquote (and Obsidian-style callout) from a markdown
 * document. We deliberately avoid pulling in a real markdown parser - the
 * surface area we care about is small and a line-walker keeps the bundle
 * tiny.
 */
function extractBlocks(content: string): ParsedBlock[] {
	const lines = content.split(/\r?\n/);
	const blocks: ParsedBlock[] = [];
	let current: ParsedBlock | null = null;
	let inCodeFence = false;

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i] ?? "";
		// Skip code fences entirely - markdown inside them isn't a blockquote.
		if (/^\s*```/.test(raw)) {
			if (current) {
				blocks.push(current);
				current = null;
			}
			inCodeFence = !inCodeFence;
			continue;
		}
		if (inCodeFence) continue;

		const m = /^\s*>\s?(.*)$/.exec(raw);
		if (m) {
			const inner = m[1] ?? "";
			if (!current) {
				const isCallout = /^\s*\[![^\]]+\]/.test(inner);
				current = { lines: [inner], startLine: i, isCallout };
			} else {
				current.lines.push(inner);
			}
		} else if (current) {
			// A blank line or paragraph break ends the block. We treat any
			// non-blockquote line the same way.
			blocks.push(current);
			current = null;
		}
	}
	if (current) blocks.push(current);
	return blocks;
}

const ATTRIBUTION_PATTERNS: readonly RegExp[] = [
	// Em dash / en dash, optionally bold/italic-wrapped.
	/^\s*[*_]*[—–]+\s*(.+?)[*_]*\s*$/,
	// Two hyphens (common ASCII fallback for em-dash).
	/^\s*[*_]*--\s*(.+?)[*_]*\s*$/,
	// Single hyphen with a following space (e.g. "- Seneca"). The trailing
	// space requirement keeps us from matching list-item-like lines such as
	// "-Foo" or hyphenated words that happen to start a line.
	/^\s*[*_]*-\s+(.+?)[*_]*\s*$/,
	// "by Author" (case-insensitive).
	/^\s*[*_]*by\s+(.+?)[*_]*\s*$/i,
];

interface AttributionParts {
	author: string;
	source: string;
}

function parseAttribution(line: string): AttributionParts | null {
	for (const pattern of ATTRIBUTION_PATTERNS) {
		const m = pattern.exec(line);
		if (m && m[1]) {
			const raw = m[1].trim();
			// Split on the first comma so "— Author, Book Title" works.
			const commaIdx = raw.indexOf(",");
			if (commaIdx === -1) return { author: raw, source: "" };
			return {
				author: raw.slice(0, commaIdx).trim(),
				source: raw.slice(commaIdx + 1).trim(),
			};
		}
	}
	return null;
}

const TAG_REGEX = /(^|\s)#([A-Za-z0-9_/-]+)/g;

function extractTags(text: string): { stripped: string; tags: string[] } {
	const tags: string[] = [];
	const stripped = text.replace(TAG_REGEX, (_match, lead: string, tag: string) => {
		tags.push(tag);
		return lead;
	});
	return { stripped: stripped.trim(), tags };
}

function stripCalloutHeader(lines: string[]): { rest: string[]; calloutKind: string } {
	if (lines.length === 0) return { rest: [], calloutKind: "" };
	const first = lines[0] ?? "";
	const m = /^\s*\[!([^\]]+)\](?:[+-])?\s*(.*)$/.exec(first);
	if (!m) return { rest: lines, calloutKind: "" };
	const calloutKind = (m[1] ?? "").trim().toLowerCase();
	const inlineTitle = (m[2] ?? "").trim();
	const rest = lines.slice(1);
	if (inlineTitle) {
		// Title on the same line is body text - keep it as the first line.
		return { rest: [inlineTitle, ...rest], calloutKind };
	}
	return { rest, calloutKind };
}

const QUOTE_CALLOUT_KINDS = new Set([
	"quote",
	"cite",
	"citation",
	"epigraph",
]);

/**
 * Default marker the migration modal's "Mark as not a quote" button
 * appends to a blockquote. Obsidian's inline-comment syntax keeps it
 * invisible in reading mode at the top level of a note.
 */
export const MUSE_IGNORE_MARKER = "%%muse:ignore%%";

/**
 * HTML-comment form of the ignore marker. Used by the Templater drop
 * helpers because HTML comments are stripped reliably even inside
 * callouts (where `%%...%%` sometimes leaks through to reading mode).
 */
export const MUSE_IGNORE_HTML_MARKER = "<!-- muse:ignore -->";

/**
 * Token that any of the supported marker forms contain. Substring
 * detection lets the parser stay neutral about where the user (or a
 * helper) chose to put the marker - inline comment, HTML comment,
 * `# muse:ignore` comment line in a `muse-quote` block, etc.
 */
const MUSE_IGNORE_TOKEN = "muse:ignore";

export function blockHasIgnoreMarker(lines: readonly string[]): boolean {
	for (const line of lines) {
		if (line.includes(MUSE_IGNORE_TOKEN)) return true;
	}
	return false;
}

export interface ExtractedQuoteContent {
	text: string;
	author: string;
	source: string;
	tags: string[];
	/** Lower-case callout kind ("quote", "cite", ...) when the block was a callout. */
	calloutKind: string;
}

/**
 * Pull the text / author / source / tags out of a blockquote's inner
 * lines (the bit after the `>` prefix has been stripped). Returns null
 * when the block isn't a quote candidate at all - either the body is
 * empty or it's a callout with a non-quote kind like `[!note]`.
 *
 * Exported so the migration helper can re-use the exact same parsing
 * the indexer uses, instead of drifting into its own implementation.
 */
export function extractQuoteContent(
	innerLines: readonly string[],
	isCallout: boolean,
): ExtractedQuoteContent | null {
	const { rest, calloutKind } = stripCalloutHeader([...innerLines]);
	if (isCallout && calloutKind && !QUOTE_CALLOUT_KINDS.has(calloutKind)) {
		return null;
	}

	const lines = rest.map((l) => l.trimEnd());
	let attributionIdx = -1;
	let attribution: AttributionParts | null = null;
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i] ?? "";
		if (!line.trim()) continue;
		const parsed = parseAttribution(line);
		if (parsed) {
			attribution = parsed;
			attributionIdx = i;
		}
		break;
	}

	const bodyLines = (
		attributionIdx >= 0 ? lines.slice(0, attributionIdx) : lines
	)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	if (bodyLines.length === 0) return null;

	const joined = bodyLines.join(" ");
	const { stripped, tags } = extractTags(joined);
	const text = stripped.trim();
	if (!text) return null;

	return {
		text,
		author: attribution?.author ?? "",
		source: attribution?.source ?? "",
		tags,
		calloutKind,
	};
}

function blockToQuote(
	block: ParsedBlock,
	sourcePath: string,
	mode: QuoteSourceMode,
): Quote | null {
	if (blockHasIgnoreMarker(block.lines)) return null;
	if (block.isCallout) {
		if (mode === "blockquotes") return null;
	} else if (mode === "callouts") {
		return null;
	}

	const content = extractQuoteContent(block.lines, block.isCallout);
	if (!content) return null;

	const id = hashString(
		`${content.text}|${content.author}|${content.source}`,
	).toString(36);
	return {
		id,
		text: content.text,
		author: content.author,
		source: content.source,
		tags: content.tags,
		sourcePath,
		sourceLine: block.startLine,
	};
}

/**
 * Convert a parsed `muse-quote` block into a Quote.
 *
 * `muse-quote` blocks are explicit user-authored cards, so the parser is
 * more permissive than the blockquote path: missing fields are tolerated
 * and the only hard requirement is non-empty quote text.
 */
function museQuoteToQuote(
	block: MuseQuoteBlock,
	sourcePath: string,
): Quote | null {
	const text = (block.fields["quote"] ?? block.fields["text"] ?? "").trim();
	if (!text) return null;
	const author = (block.fields["author"] ?? "").trim();
	const source = (block.fields["source"] ?? "").trim();
	const tagsRaw = block.fields["tags"] ?? "";
	const tags = tagsRaw
		.split(",")
		.map((t) => t.trim().replace(/^#/, ""))
		.filter(Boolean);
	const id = hashString(`${text}|${author}|${source}`).toString(36);
	return {
		id,
		text,
		author,
		source,
		tags,
		sourcePath,
		sourceLine: block.startLine,
	};
}

/** Parse all quotes from a single markdown file. */
export function parseQuotesFromMarkdown(
	content: string,
	sourcePath: string,
	mode: QuoteSourceMode,
): Quote[] {
	const out: Quote[] = [];

	// `muse-quote` blocks are always indexed - they're explicit, opt-in,
	// and have no false-positive risk like bare blockquotes do.
	for (const block of extractMuseQuoteBlocks(content)) {
		const quote = museQuoteToQuote(block, sourcePath);
		if (quote) out.push(quote);
	}

	// Bare blockquotes / callouts are mode-gated. `muse-quote` mode opts
	// out of them entirely so prose blockquotes and code-snippet quotes
	// don't get scooped up.
	if (mode !== "muse-quote") {
		for (const block of extractBlocks(content)) {
			const quote = blockToQuote(block, sourcePath, mode);
			if (quote) out.push(quote);
		}
	}

	return out;
}
