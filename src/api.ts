import type {
	DailyFactRecord,
	DailyPromptRecord,
	DailyWordRecord,
	FeaturedArticleRecord,
	Intention,
	Quote,
	WordHistoryEntry,
} from "./types";
import type { QuoteStore } from "./quotes/store";
import type { WordManager } from "./words/manager";
import type { WikipediaManager } from "./wikipedia/manager";
import type {
	IntentionsManager,
	IntentionStatus,
} from "./intentions/manager";
import type { PromptManager } from "./prompts/manager";
import type { JournalManager } from "./journal/manager";
import { quoteOfTheDay, randomQuote } from "./quotes/selection";
import {
	factRecordToMarkdown,
	featuredArticleToMarkdown,
	intentionsToMarkdown,
	journalAcrossYearsToMarkdown,
	promptRecordToMarkdown,
	quoteToCalloutMarkdown,
	wordRecordToMarkdown,
} from "./utils/static-markdown";

/**
 * Public API for templater / dataview.
 *
 * Stable across patch releases - prefer extending it over breaking the
 * existing surface. Available at `app.plugins.plugins["clio"].api`.
 */
export interface ClioApi {
	getQuoteOfTheDay(): Quote | null;
	getRandomQuote(): Quote | null;
	getQuoteOfTheDayMarkdown(): string;
	getRandomQuoteMarkdown(): string;

	/** Today's word (waits for the dictionary lookup if pending). */
	getWordOfTheDay(): Promise<DailyWordRecord>;
	/** Static markdown snapshot of today's word; "" when unavailable. */
	getWordOfTheDayMarkdown(): Promise<string>;
	/** Most recent fetched word-of-the-day picks (newest first). */
	getRecentWords(limit?: number): WordHistoryEntry[];

	/** Today's on-this-day event from Wikipedia. */
	getFactOfTheDay(): Promise<DailyFactRecord>;
	/** Static markdown snapshot of today's "on this day" event. */
	getFactOfTheDayMarkdown(): Promise<string>;
	/** Today's Wikipedia featured article (text only - no image). */
	getFeaturedArticle(): Promise<FeaturedArticleRecord>;
	/** Static markdown snapshot of today's featured article. */
	getFeaturedArticleMarkdown(): Promise<string>;

	/** Today's reflection prompt. */
	getPromptOfTheDay(): Promise<DailyPromptRecord>;
	/** Static markdown snapshot of today's reflection prompt. */
	getPromptOfTheDayMarkdown(): Promise<string>;

	/** One-line journal entry for `date` (defaults to today). */
	getJournalEntry(date?: string): string;
	/** Save the one-line journal entry for `date` (defaults to today). */
	setJournalEntry(text: string, date?: string): Promise<void>;
	/** All non-empty journal entries from the same calendar day in past years. */
	getJournalAcrossYears(): {
		date: string;
		year: number;
		yearsAgo: number;
		text: string;
	}[];
	/** Static markdown snapshot of past-years journal entries for today. */
	getJournalAcrossYearsMarkdown(): string;

	refreshQuotes(): Promise<void>;
	getIntentions(): Intention[];
	/** Static markdown snapshot of today's intentions as a task list. */
	getIntentionsMarkdown(): string;
	getIntentionsForDate(date?: string): IntentionStatus[];
	setIntentionDone(id: string, done: boolean, date?: string): Promise<void>;
	getIntentionStreak(id: string, date?: string): number;
}

export function createApi(
	store: QuoteStore,
	manager: WordManager,
	wikipedia: WikipediaManager,
	intentions: IntentionsManager,
	prompts: PromptManager,
	journal: JournalManager,
): ClioApi {
	const dailyQuote = (): Quote | null => quoteOfTheDay(store.getAll());
	const aRandomQuote = (): Quote | null => randomQuote(store.getAll());
	return {
		getQuoteOfTheDay: dailyQuote,
		getRandomQuote: aRandomQuote,
		getQuoteOfTheDayMarkdown: () => {
			const q = dailyQuote();
			return q ? quoteToCalloutMarkdown(q) : "";
		},
		getRandomQuoteMarkdown: () => {
			const q = aRandomQuote();
			return q ? quoteToCalloutMarkdown(q) : "";
		},
		getWordOfTheDay: () => manager.getToday(),
		getWordOfTheDayMarkdown: async () =>
			wordRecordToMarkdown(await manager.getToday()),
		getRecentWords: (limit) => manager.getRecentHistory(limit),
		getFactOfTheDay: () => wikipedia.getFactToday(),
		getFactOfTheDayMarkdown: async () =>
			factRecordToMarkdown(await wikipedia.getFactToday()),
		getFeaturedArticle: () => wikipedia.getFeaturedArticleToday(),
		getFeaturedArticleMarkdown: async () =>
			featuredArticleToMarkdown(
				await wikipedia.getFeaturedArticleToday(),
			),
		getPromptOfTheDay: () => prompts.getToday(),
		getPromptOfTheDayMarkdown: async () =>
			promptRecordToMarkdown(await prompts.getToday()),
		getJournalEntry: (date) => journal.getEntry(date),
		setJournalEntry: (text, date) => journal.setEntry(text, date),
		getJournalAcrossYears: () => journal.getEntriesForMonthDay(),
		getJournalAcrossYearsMarkdown: () =>
			journalAcrossYearsToMarkdown(journal.getEntriesForMonthDay()),
		refreshQuotes: () => store.refresh(),
		getIntentions: () => intentions.getItems().map((it) => ({ ...it })),
		getIntentionsMarkdown: () =>
			intentionsToMarkdown(intentions.getItems()),
		getIntentionsForDate: (date) => intentions.statusFor(date),
		setIntentionDone: (id, done, date) =>
			intentions.setDone(id, done, date),
		getIntentionStreak: (id, date) => intentions.currentStreak(id, date),
	};
}
