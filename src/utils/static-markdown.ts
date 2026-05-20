/**
 * Static markdown renderers for each daily card.
 *
 * Used by the public {@link ClioApi} so Templater / Dataview users can
 * drop a self-contained snapshot of a card into a note with a single
 * API call - no live code block, no future re-render.
 *
 * Each helper emits a `clio-static` code block whose body is YAML with
 * the card's data baked in. The code block is rendered by
 * `src/ui/static-block.ts` using the same DOM and CSS classes as the
 * live cards (`.clio-quote-card`, `.clio-word-card`, etc.) so the drop
 * looks identical to the live block - except the data is frozen in the
 * file forever, so reopening the note tomorrow shows the same content.
 *
 * Every formatter returns an empty string when there's nothing to show
 * (feature disabled, fetch failed, no data yet) so call sites can
 * safely `?? ""` the result.
 */
import { stringifyYaml } from "obsidian";
import type {
	DailyFactRecord,
	DailyPromptRecord,
	DailyWordRecord,
	FeaturedArticleRecord,
	Intention,
	Quote,
} from "../types";

/**
 * Wrap a YAML body in a `clio-static` fenced code block. The fence
 * length adapts to the body so embedded backticks never break the
 * codeblock.
 *
 * Ends with a single `\n` (not a blank line) so a daily-note template
 * that concatenates several cards lands them on adjacent lines in the
 * source — no empty line between them. In Live Preview that empty line
 * would otherwise render as an editable, full-line-height gap between
 * cards; the visual breathing room between cards is left to CSS so
 * Reading mode and Live Preview stay in sync.
 */
function staticBlock(data: Record<string, unknown>): string {
	const yaml = stringifyYaml(data).trimEnd();
	const matches: string[] = yaml.match(/`+/g) ?? [];
	const longestRun = matches.reduce(
		(max: number, s: string) => Math.max(max, s.length),
		0,
	);
	const fence = "`".repeat(Math.max(3, longestRun + 1));
	return `${fence}clio-static\n${yaml}\n${fence}\n`;
}

/** Today's quote, frozen as a `clio-static` code block. */
export function quoteToCalloutMarkdown(quote: Quote): string {
	if (!quote?.text) return "";
	const data: Record<string, unknown> = {
		type: "quote",
		text: quote.text,
	};
	if (quote.author) data["author"] = quote.author;
	if (quote.source) data["source"] = quote.source;
	if (quote.tags?.length) data["tags"] = [...quote.tags];
	return staticBlock(data);
}

/** Word of the day, frozen as a `clio-static` code block. */
export function wordRecordToMarkdown(record: DailyWordRecord): string {
	if (!record?.word) return "";
	const data: Record<string, unknown> = {
		type: "word",
		word: record.word,
	};
	if (record.partOfSpeech) data["partOfSpeech"] = record.partOfSpeech;
	if (record.phonetic) data["phonetic"] = record.phonetic;
	if (record.definitions?.length) {
		data["definitions"] = [...record.definitions];
	}
	if (record.examples?.length) data["examples"] = [...record.examples];
	return staticBlock(data);
}

/** "On this day" event, frozen as a `clio-static` code block. */
export function factRecordToMarkdown(record: DailyFactRecord): string {
	if (!record?.text) return "";
	const data: Record<string, unknown> = {
		type: "fact",
		text: record.text,
	};
	if (record.year) data["year"] = record.year;
	if (record.source) data["source"] = record.source;
	if (record.sourceUrl) data["sourceUrl"] = record.sourceUrl;
	return staticBlock(data);
}

/** Today's featured Wikipedia article, frozen as a `clio-static` block. */
export function featuredArticleToMarkdown(
	record: FeaturedArticleRecord,
): string {
	if (!record?.title || !record?.extract) return "";
	const data: Record<string, unknown> = {
		type: "article",
		title: record.title,
		extract: record.extract,
	};
	if (record.sourceUrl) data["sourceUrl"] = record.sourceUrl;
	return staticBlock(data);
}

/** Reflection prompt, frozen as a `clio-static` code block. */
export function promptRecordToMarkdown(record: DailyPromptRecord): string {
	if (!record?.text) return "";
	return staticBlock({ type: "prompt", text: record.text });
}

/**
 * Today's intentions, frozen as a `clio-static` code block.
 *
 * Always emits a block so the card is visible in the daily note even
 * when the user hasn't configured any intentions yet - the renderer
 * shows a "Configure intentions in settings" placeholder for empty
 * lists. This mirrors the live `daily-intentions` block which also
 * always renders a card.
 */
export function intentionsToMarkdown(items: readonly Intention[]): string {
	return staticBlock({
		type: "intentions",
		items: items.map((it) => it.text),
	});
}

/** Past-year journal entries for today, frozen as a `clio-static` block. */
export function journalAcrossYearsToMarkdown(
	entries: readonly { year: number; yearsAgo: number; text: string }[],
): string {
	if (entries.length === 0) return "";
	return staticBlock({
		type: "journal-history",
		entries: entries.map((e) => ({
			year: e.year,
			yearsAgo: e.yearsAgo,
			text: e.text,
		})),
	});
}
