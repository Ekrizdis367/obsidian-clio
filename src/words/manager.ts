import { Events } from "obsidian";
import { MAX_WORD_HISTORY, type ClioSettings } from "../settings";
import type {
	CachedDefinition,
	DailyWordRecord,
	WordHistoryEntry,
} from "../types";
import { todayLocalIso, hashString } from "../utils/date";
import { mulberry32 } from "../utils/random";
import { fetchDefinition } from "./api";
import { buildWordList } from "./wordlist";

export interface WordManagerHost {
	getSettings(): ClioSettings;
	save(): Promise<void>;
}

/**
 * Selects "today's word" deterministically from the configured word list,
 * caches definitions, and exposes events so views can re-render when the
 * word changes (date rollover, manual reroll, dismissal).
 */
export class WordManager extends Events {
	constructor(private readonly host: WordManagerHost) {
		super();
	}

	/**
	 * Resolves to the active record for today. Initialises a stub record if
	 * none exists, then triggers a (background) fetch when definitions are
	 * still empty and fetching is enabled.
	 */
	async getToday(): Promise<DailyWordRecord> {
		const today = todayLocalIso();
		const state = this.host.getSettings().state.word;
		if (state.today && state.today.date === today) {
			if (
				!state.today.fetched &&
				this.host.getSettings().fetchDefinitions
			) {
				void this.populateDefinitions(state.today);
			}
			return state.today;
		}
		return this.rollForDate(today);
	}

	/**
	 * Pick (or re-pick) the word for a given date and persist. Re-rolling
	 * twice on the same day is fine - the deterministic seed includes a
	 * `roll` counter that increments each time.
	 */
	async rollForDate(date: string, rerollCount = 0): Promise<DailyWordRecord> {
		const settings = this.host.getSettings();
		const list = buildWordList(
			settings.customWordList,
			settings.replaceBuiltInWordList,
		);
		const dismissed = settings.respectDismissedWords
			? new Set(settings.state.word.dismissed.map((s) => s.toLowerCase()))
			: new Set<string>();
		const candidates = list.filter((w) => !dismissed.has(w.toLowerCase()));
		const pool = candidates.length > 0 ? candidates : list;

		const seed = `word::${date}::${rerollCount}`;
		const rng = mulberry32(hashString(seed));
		const chosen =
			pool.length > 0
				? (pool[Math.floor(rng() * pool.length)] ?? pool[0] ?? "")
				: "";
		const cached = chosen ? settings.state.word.cache[chosen.toLowerCase()] : null;
		const record: DailyWordRecord = cached
			? {
					date,
					word: cached.word || chosen,
					phonetic: cached.phonetic,
					partOfSpeech: cached.partOfSpeech,
					definitions: [...cached.definitions],
					examples: [...cached.examples],
					fetched: true,
					fetchError: "",
				}
			: {
					date,
					word: chosen,
					phonetic: "",
					partOfSpeech: "",
					definitions: [],
					examples: [],
					fetched: false,
					fetchError: "",
				};

		settings.state.word.today = record;
		await this.host.save();
		this.trigger("changed");
		if (!record.fetched && settings.fetchDefinitions && record.word) {
			void this.populateDefinitions(record);
		} else if (record.fetched && record.word) {
			recordHistory(this.host.getSettings(), record);
			await this.host.save();
		}
		return record;
	}

	/**
	 * Returns the most recent fetched words (newest first), at most `limit`.
	 * Empty when history tracking is disabled or nothing has been recorded.
	 */
	getRecentHistory(limit = 7): WordHistoryEntry[] {
		const settings = this.host.getSettings();
		if (!settings.trackWordHistory) return [];
		const items = settings.state.word.history.slice();
		items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
		return items.slice(0, limit);
	}

	async clearHistory(): Promise<void> {
		const settings = this.host.getSettings();
		if (settings.state.word.history.length === 0) return;
		settings.state.word.history = [];
		await this.host.save();
		this.trigger("changed");
	}

	/** Skip the current word: dismiss it (if respect-dismissed) and re-roll. */
	async dismissCurrent(): Promise<DailyWordRecord> {
		const settings = this.host.getSettings();
		const current = settings.state.word.today;
		const word = current?.word.toLowerCase() ?? "";
		if (word && !settings.state.word.dismissed.includes(word)) {
			settings.state.word.dismissed = [
				...settings.state.word.dismissed,
				word,
			];
		}
		const date = current?.date ?? todayLocalIso();
		// Re-roll counter advances each call so we don't get the same pick.
		const counter = (settings.state.word.dismissed.length + 1) % 1024;
		return this.rollForDate(date, counter);
	}

	/** Clear the dismissed list - useful from settings. */
	async clearDismissed(): Promise<void> {
		const settings = this.host.getSettings();
		if (settings.state.word.dismissed.length === 0) return;
		settings.state.word.dismissed = [];
		await this.host.save();
		this.trigger("changed");
	}

	private async populateDefinitions(record: DailyWordRecord): Promise<void> {
		try {
			const definition = await fetchDefinition(record.word);
			if (!definition) {
				record.fetched = true;
				record.fetchError = "no-result";
				await this.host.save();
				this.trigger("changed");
				return;
			}
			Object.assign(record, {
				word: definition.word,
				phonetic: definition.phonetic,
				partOfSpeech: definition.partOfSpeech,
				definitions: [...definition.definitions],
				examples: [...definition.examples],
				fetched: true,
				fetchError: "",
			} satisfies Partial<DailyWordRecord>);
			cacheDefinition(this.host.getSettings(), definition);
			recordHistory(this.host.getSettings(), record);
			await this.host.save();
			this.trigger("changed");
		} catch (err) {
			console.warn("[clio] populateDefinitions failed", err);
			record.fetched = true;
			record.fetchError = err instanceof Error ? err.message : "unknown";
			await this.host.save();
			this.trigger("changed");
		}
	}
}

function cacheDefinition(
	settings: ClioSettings,
	definition: CachedDefinition,
): void {
	const key = definition.word.toLowerCase();
	settings.state.word.cache[key] = {
		word: definition.word,
		phonetic: definition.phonetic,
		partOfSpeech: definition.partOfSpeech,
		definitions: [...definition.definitions],
		examples: [...definition.examples],
	};
}

/**
 * Append a daily word to the recap history (if tracking is enabled).
 * Replaces any existing entry for the same date so re-rolls don't pollute
 * the recap with duplicates, and trims to MAX_WORD_HISTORY entries.
 */
function recordHistory(
	settings: ClioSettings,
	record: DailyWordRecord,
): void {
	if (!settings.trackWordHistory) return;
	if (!record.word || record.definitions.length === 0) return;
	const filtered = settings.state.word.history.filter(
		(h) => h.date !== record.date,
	);
	filtered.push({
		date: record.date,
		word: record.word,
		partOfSpeech: record.partOfSpeech,
		definitions: [...record.definitions],
	});
	settings.state.word.history = filtered.slice(-MAX_WORD_HISTORY);
}
