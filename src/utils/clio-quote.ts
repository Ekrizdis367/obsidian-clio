/**
 * Shared parser for the `clio-quote` code-block format used to author
 * structured quotes inside notes.
 *
 * Format:
 * ```clio-quote
 * quote: Some quote text, possibly
 *   wrapping over multiple lines.
 * author: Author Name
 * source: Optional source / book / talk
 * tags: tag1, tag2
 * ```
 *
 * Field rules:
 *  - `key: value` pairs, one per line. Keys are case-insensitive.
 *  - Lines that don't start a new `key:` are appended to the previous
 *    field's value with a single space separator (lets `quote:` wrap).
 *  - Blank lines reset the wrap target. Lines starting with `#` are
 *    treated as comments (handy for documenting templates).
 */
export type ClioQuoteFields = Record<string, string>;

/** Canonical fence language; older names are accepted for legacy notes. */
export const CLIO_QUOTE_FENCE_LANG = "clio-quote";
const LEGACY_QUOTE_FENCE_LANGS = new Set(["muse-quote", "almanac-quote"]);

export function isClioQuoteFenceLang(lang: string): boolean {
	const lower = lang.toLowerCase();
	return lower === CLIO_QUOTE_FENCE_LANG || LEGACY_QUOTE_FENCE_LANGS.has(lower);
}

const KEY_RE = /^([A-Za-z][\w-]*)\s*:/;

export function parseClioQuoteFields(
	lines: readonly string[],
): ClioQuoteFields {
	const fields: ClioQuoteFields = {};
	let currentKey: string | null = null;

	for (const raw of lines) {
		const trimmed = raw.trim();
		if (!trimmed) {
			currentKey = null;
			continue;
		}
		if (trimmed.startsWith("#")) continue;

		const keyMatch = KEY_RE.exec(trimmed);
		if (keyMatch && keyMatch[1]) {
			const key = keyMatch[1].toLowerCase();
			const value = trimmed.slice(keyMatch[0].length).trim();
			fields[key] = value;
			currentKey = key;
		} else if (currentKey) {
			const prev = fields[currentKey] ?? "";
			fields[currentKey] = prev ? `${prev} ${trimmed}` : trimmed;
		}
	}

	return fields;
}

/** Parse a fenced clio-quote block's source string (everything between ``` lines). */
export function parseClioQuoteSource(source: string): ClioQuoteFields {
	return parseClioQuoteFields(source.split(/\r?\n/));
}

export interface ClioQuoteBlock {
	fields: ClioQuoteFields;
	/** 0-based line of the opening ``` fence in the source file. */
	startLine: number;
}

/**
 * Walk a markdown document and pull out every `clio-quote` fenced block.
 *
 * We track fence state so a `clio-quote` example mentioned inside another
 * code block (e.g. a tutorial note) is correctly skipped instead of
 * being parsed as a real block.
 */
export function extractClioQuoteBlocks(content: string): ClioQuoteBlock[] {
	const lines = content.split(/\r?\n/);
	const blocks: ClioQuoteBlock[] = [];
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
					fields: parseClioQuoteFields(buffer),
					startLine: blockStart,
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
