import type { Quote } from "../types";
import { todayLocalIso } from "../utils/date";
import { pickDeterministic, pickRandom } from "../utils/random";

/** Returns true when the quote has a non-empty author attribution. */
export function hasAuthor(quote: Quote): boolean {
	return quote.author.trim().length > 0;
}

/**
 * Apply user-configured selection filters. Currently the only filter is
 * `requireQuoteAuthor`, which excludes any blockquote without an
 * `— Author` line.
 */
export function applyQuoteFilters(
	quotes: readonly Quote[],
	settings: { requireQuoteAuthor: boolean },
): Quote[] {
	if (!settings.requireQuoteAuthor) return [...quotes];
	return quotes.filter(hasAuthor);
}

/**
 * Today's quote. Same input set + same date = same output, so the daily
 * note shows the same quote all day even if a re-render fires.
 */
export function quoteOfTheDay(quotes: readonly Quote[]): Quote | null {
	if (quotes.length === 0) return null;
	const sorted = [...quotes].sort((a, b) => a.id.localeCompare(b.id));
	return pickDeterministic(sorted, `quote::${todayLocalIso()}`);
}

/** A different quote each call. Used by the "Insert random quote" command. */
export function randomQuote(quotes: readonly Quote[]): Quote | null {
	return pickRandom(quotes);
}

/**
 * Render a quote back into a markdown blockquote string. Used by the
 * "Insert random quote" command and by exports.
 */
export function quoteToMarkdown(quote: Quote): string {
	const lines = [`> ${quote.text}`];
	const attribution = formatAttribution(quote);
	if (attribution) lines.push(`> — ${attribution}`);
	return lines.join("\n");
}

export function formatAttribution(quote: Quote): string {
	const parts: string[] = [];
	if (quote.author) parts.push(quote.author);
	if (quote.source) parts.push(quote.source);
	return parts.join(", ");
}
