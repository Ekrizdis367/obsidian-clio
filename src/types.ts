/**
 * A quote extracted from somewhere in the vault.
 *
 * The id is content-derived (a stable hash of text+author+source) so that
 * favorites/dismissed flags survive a re-scan even when files are edited.
 */
export interface Quote {
	id: string;
	text: string;
	author: string;
	source: string;
	tags: string[];
	/** Vault-relative path of the file the quote was found in. */
	sourcePath: string;
	/** Line number (0-based) in the source file where the blockquote begins. */
	sourceLine: number;
}

/**
 * Word-of-the-day data for a single day.
 *
 * Stored in `data.json` so the same word is shown all day even if the user
 * is offline. `definitions` and `examples` are populated lazily by a
 * dictionaryapi.dev lookup; both default to empty arrays before the first
 * fetch succeeds.
 */
export interface DailyWordRecord {
	/** ISO `YYYY-MM-DD` for the local day this record represents. */
	date: string;
	word: string;
	phonetic: string;
	partOfSpeech: string;
	definitions: string[];
	examples: string[];
	/** True once we've finished a network attempt (success or 404). */
	fetched: boolean;
	/** Recorded for diagnostics; never displayed to the user. */
	fetchError: string;
}

/**
 * Persistent state for the word-of-the-day feature. Kept in `data.json`.
 *
 * `today` is the most recently selected word. `cache` keys are lowercase
 * words and values are the raw API payloads we care about, so a re-roll on
 * the same day or repeated surfacing of a word doesn't re-hit the network.
 */
export interface WordState {
	today: DailyWordRecord | null;
	cache: Record<string, CachedDefinition>;
	/** Lowercase words the user has dismissed; never re-shown. */
	dismissed: string[];
	/**
	 * Most recent word-of-the-day picks (newest last). Populated only when
	 * the recap feature is enabled. Capped at ~30 entries so the file stays
	 * small.
	 */
	history: WordHistoryEntry[];
}

export interface CachedDefinition {
	word: string;
	phonetic: string;
	partOfSpeech: string;
	definitions: string[];
	examples: string[];
}

/**
 * What counts as a quote when scanning vault notes.
 *
 * `clio-quote` code blocks are **always** indexed regardless of mode -
 * they're explicit and unambiguous. The mode controls whether bare
 * blockquotes / callouts are *also* indexed:
 *
 *  - `clio-quote`  : only `clio-quote` blocks (zero false positives, recommended)
 *  - `blockquotes` : clio-quote blocks + bare `> ...` blockquotes
 *  - `callouts`    : clio-quote blocks + `> [!quote]` callouts
 *  - `both`        : clio-quote blocks + bare blockquotes + callouts
 */
export type QuoteSourceMode =
	| "clio-quote"
	| "blockquotes"
	| "callouts"
	| "both";

/**
 * "On this day" fact for a single day, sourced from Wikipedia.
 *
 * Stored in `data.json` so the same fact is shown all day even when the
 * user is offline. `fetched` flips to true once we've completed a network
 * attempt - successful or otherwise - so the UI knows whether to keep
 * showing the loading spinner.
 */
export interface DailyFactRecord {
	/** ISO `YYYY-MM-DD` for the local day this record represents. */
	date: string;
	/** Stable id derived from year + first linked Wikipedia page. */
	id: string;
	/** The event description, as written by Wikipedia editors. */
	text: string;
	/** Year the event occurred. 0 when unknown. */
	year: number;
	/** Always "Wikipedia" for now; kept as a field so the source can swap later. */
	source: string;
	/** URL of the primary linked Wikipedia article. */
	sourceUrl: string;
	/** Same as `sourceUrl` for now; kept for forward-compatibility. */
	permalink: string;
	/** True once a network attempt has finished (success or failure). */
	fetched: boolean;
	/** Recorded for diagnostics; never displayed to the user. */
	fetchError: string;
}

/**
 * One candidate "on this day" event. The Wikimedia feed returns several of
 * these per date; we cache the whole list so re-rolls don't re-hit the API.
 */
export interface FactCandidate {
	id: string;
	text: string;
	year: number;
	source: string;
	sourceUrl: string;
	permalink: string;
}

/**
 * Cached pool of candidate events for a given day. Cleared when the local
 * date rolls over, so each new day causes exactly one network fetch.
 */
export interface FactPool {
	/** ISO `YYYY-MM-DD` when this pool was fetched. */
	date: string;
	items: FactCandidate[];
}

/**
 * Persistent state for the fact-of-the-day feature. Kept in `data.json`.
 *
 * `today` is the active record on display. `pool` is the full set of
 * candidates we fetched for the current day - re-rolls cycle through it
 * locally and never need a fresh API call.
 */
export interface FactState {
	today: DailyFactRecord | null;
	pool: FactPool;
	/** Candidate ids the user has dismissed; never re-shown. */
	dismissed: string[];
}

/**
 * Cached "today's featured article" payload from Wikimedia.
 *
 * Text-only by design - the source article's lead image is *not* stored
 * or rendered, since Wikipedia featured articles can include sensitive
 * imagery without warning. See `wikipedia/api.ts` for context.
 */
export interface FeaturedArticleRecord {
	date: string;
	title: string;
	extract: string;
	sourceUrl: string;
	fetched: boolean;
	fetchError: string;
}

/**
 * One reflection prompt the user can be served on a given day.
 * Stable id lets us track dismissals + history across re-fetches.
 */
export interface Prompt {
	id: string;
	text: string;
}

/**
 * Persistent state for daily reflection prompts.
 */
export interface PromptState {
	today: DailyPromptRecord | null;
	dismissed: string[];
}

export interface DailyPromptRecord {
	date: string;
	id: string;
	text: string;
}

/** State for the one-line-a-day journal feature. */
export interface JournalState {
	/** ISO date (`YYYY-MM-DD`) -> single-line entry. */
	entries: Record<string, string>;
}

/** Cached previous word-of-the-day picks for the recap card. */
export interface WordHistoryEntry {
	date: string;
	word: string;
	partOfSpeech: string;
	definitions: string[];
}

/**
 * One of the user's daily intentions (max 4 are configured at any time).
 * Tracking history is keyed by the stable `id`, so renaming the text leaves
 * the streak/completion data intact.
 */
export interface Intention {
	id: string;
	text: string;
}

/**
 * Configuration + persistent history for the daily intentions feature.
 *
 * `history` is keyed by local ISO date (`YYYY-MM-DD`), then by intention id;
 * only `true` values are stored so the file stays small.
 */
export interface IntentionsState {
	items: Intention[];
	history: Record<string, Record<string, boolean>>;
}
