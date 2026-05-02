import { CUSTOM_LOCATION_CODE } from "./sky/locations";
import type {
	FactState,
	FeaturedArticleRecord,
	Intention,
	IntentionsState,
	JournalState,
	PromptState,
	QuoteSourceMode,
	WordState,
} from "./types";

/** Hard cap on how many intentions a user can configure. */
export const MAX_INTENTIONS = 4;

/** Most word-of-the-day entries we keep in the recap history. */
export const MAX_WORD_HISTORY = 30;

export interface MuseSettings {
	/**
	 * Vault-relative folder paths to scan for quotes. Empty array = scan the
	 * entire vault.
	 */
	quoteFolders: string[];
	/**
	 * Where new quotes get appended by the "Add quote" command. Created
	 * automatically if it doesn't exist.
	 */
	quotesInboxPath: string;
	/**
	 * What we treat as a quote in addition to `muse-quote` code blocks
	 * (which are always indexed). See {@link QuoteSourceMode} for the
	 * full matrix.
	 */
	quoteSource: QuoteSourceMode;
	/**
	 * When set, prefix the daily quote with the user's local sunrise -
	 * effectively rotates the quote at a more natural "start of day"
	 * boundary instead of midnight.
	 */
	rotateAtMidnight: boolean;
	/** Lowercased words the user has favorited (for the library view filter). */
	favoriteQuoteIds: string[];
	/**
	 * When true, only quotes that have an `— Author` attribution line are
	 * eligible for the daily/random pickers and the insert commands.
	 * Bare blockquotes without attribution are skipped. The library view
	 * still shows everything so users can curate.
	 */
	requireQuoteAuthor: boolean;
	/**
	 * If true, fetch definitions from the public dictionary API. Off by
	 * default would be fine but the feature is the whole point - we ship it
	 * on with a clear toggle.
	 */
	fetchDefinitions: boolean;
	/**
	 * Custom advanced word list, one per line. Empty = use the built-in.
	 * Words are lower-cased, deduplicated, and merged with the built-in
	 * unless `replaceBuiltInWordList` is true.
	 */
	customWordList: string;
	replaceBuiltInWordList: boolean;
	/**
	 * Whether to skip showing words the user has dismissed (via the "skip"
	 * button on the word block). When false, dismissed words can re-appear.
	 */
	respectDismissedWords: boolean;
	/**
	 * If true, fetch the on-this-day events feed from Wikimedia.
	 * Disable to keep the feature offline-only.
	 */
	fetchFacts: boolean;
	/** Whether to skip on-this-day events the user has dismissed. */
	respectDismissedFacts: boolean;
	/**
	 * Wikipedia's "Today's featured article" card (text only). Off by
	 * default; piggybacks on the same Wikimedia fetch as on-this-day so
	 * it costs nothing extra.
	 */
	showFeaturedArticle: boolean;
	/** Custom reflection prompts, one per line. Empty = use built-in. */
	customPrompts: string;
	/** When true, only custom prompts are used. */
	replaceBuiltInPrompts: boolean;
	/** Whether to skip prompts the user has dismissed. */
	respectDismissedPrompts: boolean;
	/**
	 * Vault folder containing daily notes. Used by the
	 * journal-on-this-day feature. Empty = scan the entire vault.
	 */
	dailyNotesFolder: string;
	/**
	 * Filename format for daily notes. Supports `YYYY`, `YY`, `MM`, `M`,
	 * `DD`, `D` tokens. Defaults match Obsidian's core daily-notes plugin.
	 */
	dailyNotesFormat: string;
	/** Show the moon-phase + sunrise/sunset card. Off by default. */
	showSky: boolean;
	/**
	 * Selected country (ISO 3166-1 alpha-2 code) used to derive lat/lon from
	 * the bundled location dataset. `null` means "not selected"; the special
	 * value `"_custom"` (see {@link locations.CUSTOM_LOCATION_CODE}) means the
	 * user is overriding via raw coordinates.
	 */
	skyCountryCode: string | null;
	/** Selected region (state/province) within the country, if applicable. */
	skyRegionCode: string | null;
	/** Latitude in degrees (-90 to 90). Required for sunrise/sunset. */
	skyLatitude: number | null;
	/** Longitude in degrees (-180 to 180). Required for sunrise/sunset. */
	skyLongitude: number | null;
	/** Track word-of-the-day history so the recap card has data. */
	trackWordHistory: boolean;
	/**
	 * The 1-4 things the user wants to do every day, plus their completion
	 * history. See `IntentionsState` for shape details.
	 */
	intentions: IntentionsState;
	/** Persistent state - bundled in the same `data.json` round-trip. */
	state: MuseState;
}

export interface MuseState {
	word: WordState;
	fact: FactState;
	featuredArticle: FeaturedArticleRecord | null;
	prompt: PromptState;
	journal: JournalState;
}

export const DEFAULT_STATE: MuseState = {
	word: {
		today: null,
		cache: {},
		dismissed: [],
		history: [],
	},
	fact: {
		today: null,
		pool: { date: "", items: [] },
		dismissed: [],
	},
	featuredArticle: null,
	prompt: {
		today: null,
		dismissed: [],
	},
	journal: {
		entries: {},
	},
};

export const DEFAULT_SETTINGS: MuseSettings = {
	quoteFolders: [],
	quotesInboxPath: "Quotes.md",
	quoteSource: "muse-quote",
	rotateAtMidnight: true,
	favoriteQuoteIds: [],
	requireQuoteAuthor: true,
	fetchDefinitions: true,
	customWordList: "",
	replaceBuiltInWordList: false,
	respectDismissedWords: true,
	fetchFacts: true,
	respectDismissedFacts: true,
	showFeaturedArticle: false,
	customPrompts: "",
	replaceBuiltInPrompts: false,
	respectDismissedPrompts: true,
	dailyNotesFolder: "",
	dailyNotesFormat: "YYYY-MM-DD",
	showSky: false,
	skyCountryCode: null,
	skyRegionCode: null,
	skyLatitude: null,
	skyLongitude: null,
	trackWordHistory: false,
	intentions: { items: [], history: {} },
	state: DEFAULT_STATE,
};

export function mergeSettings(
	raw: Partial<MuseSettings> | null,
): MuseSettings {
	const base: MuseSettings = {
		...DEFAULT_SETTINGS,
		quoteFolders: [],
		favoriteQuoteIds: [],
		intentions: { items: [], history: {} },
		state: {
			word: {
				today: null,
				cache: {},
				dismissed: [],
				history: [],
			},
			fact: {
				today: null,
				pool: { date: "", items: [] },
				dismissed: [],
			},
			featuredArticle: null,
			prompt: {
				today: null,
				dismissed: [],
			},
			journal: {
				entries: {},
			},
		},
	};
	if (!raw) return base;

	return {
		...base,
		...raw,
		quoteFolders: Array.isArray(raw.quoteFolders)
			? raw.quoteFolders
					.filter((s): s is string => typeof s === "string")
					.map((s) => s.trim())
					.filter(Boolean)
			: base.quoteFolders,
		quotesInboxPath:
			typeof raw.quotesInboxPath === "string" &&
			raw.quotesInboxPath.trim()
				? raw.quotesInboxPath.trim()
				: base.quotesInboxPath,
		quoteSource: parseQuoteSource(raw.quoteSource, base.quoteSource),
		rotateAtMidnight:
			typeof raw.rotateAtMidnight === "boolean"
				? raw.rotateAtMidnight
				: base.rotateAtMidnight,
		favoriteQuoteIds: Array.isArray(raw.favoriteQuoteIds)
			? raw.favoriteQuoteIds.filter((s): s is string => typeof s === "string")
			: base.favoriteQuoteIds,
		requireQuoteAuthor:
			typeof raw.requireQuoteAuthor === "boolean"
				? raw.requireQuoteAuthor
				: base.requireQuoteAuthor,
		fetchDefinitions:
			typeof raw.fetchDefinitions === "boolean"
				? raw.fetchDefinitions
				: base.fetchDefinitions,
		customWordList:
			typeof raw.customWordList === "string"
				? raw.customWordList
				: base.customWordList,
		replaceBuiltInWordList:
			typeof raw.replaceBuiltInWordList === "boolean"
				? raw.replaceBuiltInWordList
				: base.replaceBuiltInWordList,
		respectDismissedWords:
			typeof raw.respectDismissedWords === "boolean"
				? raw.respectDismissedWords
				: base.respectDismissedWords,
		fetchFacts:
			typeof raw.fetchFacts === "boolean"
				? raw.fetchFacts
				: base.fetchFacts,
		respectDismissedFacts:
			typeof raw.respectDismissedFacts === "boolean"
				? raw.respectDismissedFacts
				: base.respectDismissedFacts,
		showFeaturedArticle:
			typeof raw.showFeaturedArticle === "boolean"
				? raw.showFeaturedArticle
				: base.showFeaturedArticle,
		customPrompts:
			typeof raw.customPrompts === "string"
				? raw.customPrompts
				: base.customPrompts,
		replaceBuiltInPrompts:
			typeof raw.replaceBuiltInPrompts === "boolean"
				? raw.replaceBuiltInPrompts
				: base.replaceBuiltInPrompts,
		respectDismissedPrompts:
			typeof raw.respectDismissedPrompts === "boolean"
				? raw.respectDismissedPrompts
				: base.respectDismissedPrompts,
		dailyNotesFolder:
			typeof raw.dailyNotesFolder === "string"
				? raw.dailyNotesFolder.trim()
				: base.dailyNotesFolder,
		dailyNotesFormat:
			typeof raw.dailyNotesFormat === "string" &&
			raw.dailyNotesFormat.trim()
				? raw.dailyNotesFormat.trim()
				: base.dailyNotesFormat,
		showSky:
			typeof raw.showSky === "boolean" ? raw.showSky : base.showSky,
		skyCountryCode: parseSkyCountryCode(raw, base.skyCountryCode),
		skyRegionCode:
			typeof raw.skyRegionCode === "string" && raw.skyRegionCode.trim()
				? raw.skyRegionCode.trim()
				: base.skyRegionCode,
		skyLatitude:
			typeof raw.skyLatitude === "number" &&
			Number.isFinite(raw.skyLatitude)
				? raw.skyLatitude
				: base.skyLatitude,
		skyLongitude:
			typeof raw.skyLongitude === "number" &&
			Number.isFinite(raw.skyLongitude)
				? raw.skyLongitude
				: base.skyLongitude,
		trackWordHistory:
			typeof raw.trackWordHistory === "boolean"
				? raw.trackWordHistory
				: base.trackWordHistory,
		intentions: parseIntentions(raw.intentions),
		state: mergeState(raw.state),
	};
}

/**
 * Validate the persisted `quoteSource` value, also migrating the
 * short-lived `widgets` value (used in an early prototype of this
 * feature) to the final `muse-quote` name.
 */
function parseQuoteSource(
	raw: unknown,
	fallback: QuoteSourceMode,
): QuoteSourceMode {
	if (raw === "widgets") return "muse-quote";
	if (
		raw === "muse-quote" ||
		raw === "blockquotes" ||
		raw === "callouts" ||
		raw === "both"
	) {
		return raw;
	}
	return fallback;
}

function parseSkyCountryCode(
	raw: Partial<MuseSettings>,
	fallback: string | null,
): string | null {
	if (typeof raw.skyCountryCode === "string" && raw.skyCountryCode.trim()) {
		return raw.skyCountryCode.trim();
	}
	const lat =
		typeof raw.skyLatitude === "number" && Number.isFinite(raw.skyLatitude)
			? raw.skyLatitude
			: null;
	const lon =
		typeof raw.skyLongitude === "number" && Number.isFinite(raw.skyLongitude)
			? raw.skyLongitude
			: null;
	if (lat !== null && lon !== null) return CUSTOM_LOCATION_CODE;
	return fallback;
}

function parseIntentions(raw: unknown): IntentionsState {
	const obj = isPlainObject(raw) ? raw : {};
	const itemsRaw = Array.isArray(obj["items"]) ? obj["items"] : [];
	const items: Intention[] = [];
	for (const it of itemsRaw) {
		if (!isPlainObject(it)) continue;
		const id = stringOr(it["id"], "").trim();
		if (!id) continue;
		items.push({ id, text: stringOr(it["text"], "") });
		if (items.length >= MAX_INTENTIONS) break;
	}
	const historyRaw = isPlainObject(obj["history"]) ? obj["history"] : {};
	const history: Record<string, Record<string, boolean>> = {};
	for (const [date, map] of Object.entries(historyRaw)) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
		if (!isPlainObject(map)) continue;
		const inner: Record<string, boolean> = {};
		for (const [id, done] of Object.entries(map)) {
			if (done === true) inner[id] = true;
		}
		if (Object.keys(inner).length > 0) history[date] = inner;
	}
	return { items, history };
}

function mergeState(raw: unknown): MuseState {
	const stateRaw = isPlainObject(raw) ? raw : {};
	const wordRaw = isPlainObject(stateRaw["word"]) ? stateRaw["word"] : {};
	const todayRaw = isPlainObject(wordRaw["today"]) ? wordRaw["today"] : null;
	const cacheRaw = isPlainObject(wordRaw["cache"]) ? wordRaw["cache"] : {};
	const dismissedRaw = Array.isArray(wordRaw["dismissed"])
		? wordRaw["dismissed"]
		: [];

	return {
		word: {
			today: todayRaw
				? {
						date: stringOr(todayRaw["date"], ""),
						word: stringOr(todayRaw["word"], ""),
						phonetic: stringOr(todayRaw["phonetic"], ""),
						partOfSpeech: stringOr(todayRaw["partOfSpeech"], ""),
						definitions: stringArray(todayRaw["definitions"]),
						examples: stringArray(todayRaw["examples"]),
						fetched: typeof todayRaw["fetched"] === "boolean"
							? todayRaw["fetched"]
							: false,
						fetchError: stringOr(todayRaw["fetchError"], ""),
					}
				: null,
			cache: parseCache(cacheRaw),
			dismissed: dismissedRaw.filter(
				(s): s is string => typeof s === "string",
			),
			history: parseWordHistory(wordRaw["history"]),
		},
		fact: parseFactState(stateRaw["fact"]),
		featuredArticle: parseFeaturedArticle(stateRaw["featuredArticle"]),
		prompt: parsePromptState(stateRaw["prompt"]),
		journal: parseJournalState(stateRaw["journal"]),
	};
}

function parseWordHistory(raw: unknown): import("./types").WordHistoryEntry[] {
	if (!Array.isArray(raw)) return [];
	const out: import("./types").WordHistoryEntry[] = [];
	for (const it of raw) {
		if (!isPlainObject(it)) continue;
		const date = stringOr(it["date"], "");
		const word = stringOr(it["word"], "");
		if (!date || !word) continue;
		out.push({
			date,
			word,
			partOfSpeech: stringOr(it["partOfSpeech"], ""),
			definitions: stringArray(it["definitions"]),
		});
	}
	return out.slice(-MAX_WORD_HISTORY);
}

function parseFeaturedArticle(
	raw: unknown,
): import("./types").FeaturedArticleRecord | null {
	if (!isPlainObject(raw)) return null;
	const title = stringOr(raw["title"], "");
	const date = stringOr(raw["date"], "");
	if (!title || !date) return null;
	return {
		date,
		title,
		extract: stringOr(raw["extract"], ""),
		sourceUrl: stringOr(raw["sourceUrl"], ""),
		fetched:
			typeof raw["fetched"] === "boolean" ? raw["fetched"] : false,
		fetchError: stringOr(raw["fetchError"], ""),
	};
}

function parsePromptState(raw: unknown): import("./types").PromptState {
	const obj = isPlainObject(raw) ? raw : {};
	const todayRaw = isPlainObject(obj["today"]) ? obj["today"] : null;
	const dismissedRaw = Array.isArray(obj["dismissed"])
		? obj["dismissed"]
		: [];
	return {
		today: todayRaw
			? {
					date: stringOr(todayRaw["date"], ""),
					id: stringOr(todayRaw["id"], ""),
					text: stringOr(todayRaw["text"], ""),
				}
			: null,
		dismissed: dismissedRaw.filter((s): s is string => typeof s === "string"),
	};
}

function parseJournalState(raw: unknown): import("./types").JournalState {
	const obj = isPlainObject(raw) ? raw : {};
	const entriesRaw = isPlainObject(obj["entries"]) ? obj["entries"] : {};
	const entries: Record<string, string> = {};
	for (const [date, value] of Object.entries(entriesRaw)) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
		if (typeof value !== "string") continue;
		const trimmed = value.trim();
		if (trimmed) entries[date] = trimmed;
	}
	return { entries };
}

function parseFactState(raw: unknown): FactState {
	const obj = isPlainObject(raw) ? raw : {};
	const todayRaw = isPlainObject(obj["today"]) ? obj["today"] : null;
	const dismissedRaw = Array.isArray(obj["dismissed"])
		? obj["dismissed"]
		: [];
	const poolRaw = isPlainObject(obj["pool"]) ? obj["pool"] : {};

	return {
		today: todayRaw
			? {
					date: stringOr(todayRaw["date"], ""),
					id: stringOr(todayRaw["id"], ""),
					text: stringOr(todayRaw["text"], ""),
					year: typeof todayRaw["year"] === "number" ? todayRaw["year"] : 0,
					source: stringOr(todayRaw["source"], ""),
					sourceUrl: stringOr(todayRaw["sourceUrl"], ""),
					permalink: stringOr(todayRaw["permalink"], ""),
					fetched:
						typeof todayRaw["fetched"] === "boolean"
							? todayRaw["fetched"]
							: false,
					fetchError: stringOr(todayRaw["fetchError"], ""),
				}
			: null,
		pool: parseFactPool(poolRaw),
		dismissed: dismissedRaw.filter((s): s is string => typeof s === "string"),
	};
}

function parseFactPool(raw: Record<string, unknown>): {
	date: string;
	items: import("./types").FactCandidate[];
} {
	const itemsRaw = Array.isArray(raw["items"]) ? raw["items"] : [];
	const items: import("./types").FactCandidate[] = [];
	for (const it of itemsRaw) {
		if (!isPlainObject(it)) continue;
		const id = stringOr(it["id"], "").trim();
		const text = stringOr(it["text"], "").trim();
		if (!id || !text) continue;
		items.push({
			id,
			text,
			year: typeof it["year"] === "number" ? it["year"] : 0,
			source: stringOr(it["source"], ""),
			sourceUrl: stringOr(it["sourceUrl"], ""),
			permalink: stringOr(it["permalink"], ""),
		});
	}
	return {
		date: stringOr(raw["date"], ""),
		items,
	};
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((s): s is string => typeof s === "string");
}

function parseCache(
	cacheRaw: Record<string, unknown>,
): Record<string, import("./types").CachedDefinition> {
	const out: Record<string, import("./types").CachedDefinition> = {};
	for (const [key, value] of Object.entries(cacheRaw)) {
		if (!isPlainObject(value)) continue;
		out[key] = {
			word: stringOr(value["word"], key),
			phonetic: stringOr(value["phonetic"], ""),
			partOfSpeech: stringOr(value["partOfSpeech"], ""),
			definitions: stringArray(value["definitions"]),
			examples: stringArray(value["examples"]),
		};
	}
	return out;
}
