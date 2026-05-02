import { Events } from "obsidian";
import type { MuseSettings } from "../settings";
import type {
	DailyFactRecord,
	FactCandidate,
	FeaturedArticleRecord,
} from "../types";
import { parseLocalIsoDate, todayLocalIso } from "../utils/date";
import { fetchWikipediaFeed, type WikipediaFeed } from "./api";

export interface WikipediaManagerHost {
	getSettings(): MuseSettings;
	save(): Promise<void>;
}

/**
 * Single manager for everything we pull from Wikipedia's daily feed:
 *
 *   - on-this-day events  (always-on if `fetchFacts`)
 *   - today's featured article  (opt-in, text-only)
 *
 * The Wikimedia "featured" endpoint returns several payloads in one
 * response, so we fetch *once* per day and serve both cards from the
 * cached result. Re-rolls of the on-this-day pool cycle locally.
 *
 * The "picture of the day" payload from the same endpoint is *not*
 * surfaced - it can include graphic / NSFW content with no warning.
 * The featured-article thumbnail is dropped for the same reason.
 */
export class WikipediaManager extends Events {
	/**
	 * In-flight fetch promise so concurrent calls (e.g. three cards
	 * mounted in the same note) share a single network request.
	 */
	private inflight: {
		date: string;
		promise: Promise<WikipediaFeed | null>;
	} | null = null;

	/**
	 * Per-feed in-flight refreshes. Without these, each re-render
	 * caused by a `"changed"` event would kick off a fresh refresh,
	 * overwrite the previous stub, and re-trigger `"changed"` again -
	 * thrashing forever and never showing real content.
	 */
	private inflightFact: { date: string; promise: Promise<DailyFactRecord> } | null = null;
	private inflightFeatured:
		| { date: string; promise: Promise<FeaturedArticleRecord> }
		| null = null;

	constructor(private readonly host: WikipediaManagerHost) {
		super();
	}

	/* -------------------- on-this-day events -------------------- */

	async getFactToday(): Promise<DailyFactRecord> {
		const today = todayLocalIso();
		const state = this.host.getSettings().state.fact;
		if (
			state.today &&
			state.today.date === today &&
			state.today.fetched &&
			state.today.text
		) {
			return state.today;
		}
		if (this.inflightFact && this.inflightFact.date === today) {
			return this.inflightFact.promise;
		}
		const promise = this.rollFact(today, { strategy: "first" }).finally(() => {
			if (this.inflightFact?.date === today) this.inflightFact = null;
		});
		this.inflightFact = { date: today, promise };
		return promise;
	}

	async rollFact(
		date: string,
		opts: { strategy: "first" | "next" } = { strategy: "first" },
	): Promise<DailyFactRecord> {
		const settings = this.host.getSettings();
		const previousId = settings.state.fact.today?.id ?? "";

		const stub = makeStubFact(date);
		settings.state.fact.today = stub;
		// Note: no trigger("changed") here - the stub is just a placeholder
		// for "we're working on it". Triggering would re-enter render and
		// recursively kick off another rollFact before this one finishes.

		if (!settings.fetchFacts) {
			stub.fetched = true;
			stub.fetchError = "fetch-disabled";
			await this.host.save();
			this.trigger("changed");
			return stub;
		}

		try {
			const pool = await this.ensurePool(date);
			if (pool.length === 0) {
				stub.fetched = true;
				stub.fetchError = "no-result";
				await this.host.save();
				this.trigger("changed");
				return stub;
			}

			const dismissed = settings.respectDismissedFacts
				? new Set(settings.state.fact.dismissed)
				: new Set<string>();
			const chosen = pickCandidate(
				pool,
				dismissed,
				opts.strategy,
				previousId,
			);

			Object.assign(stub, factFromCandidate(chosen, date));
			await this.host.save();
			this.trigger("changed");
			return stub;
		} catch (err) {
			console.warn("[muse] fact roll failed", err);
			stub.fetched = true;
			stub.fetchError = err instanceof Error ? err.message : "unknown";
			await this.host.save();
			this.trigger("changed");
			return stub;
		}
	}

	async dismissFact(): Promise<DailyFactRecord> {
		const settings = this.host.getSettings();
		const current = settings.state.fact.today;
		if (
			current?.id &&
			settings.respectDismissedFacts &&
			!settings.state.fact.dismissed.includes(current.id)
		) {
			settings.state.fact.dismissed = [
				...settings.state.fact.dismissed,
				current.id,
			];
		}
		const date = current?.date ?? todayLocalIso();
		return this.rollFact(date, { strategy: "next" });
	}

	async clearDismissedFacts(): Promise<void> {
		const settings = this.host.getSettings();
		if (settings.state.fact.dismissed.length === 0) return;
		settings.state.fact.dismissed = [];
		await this.host.save();
		this.trigger("changed");
	}

	/* -------------------- featured article -------------------- */

	async getFeaturedArticleToday(): Promise<FeaturedArticleRecord> {
		const today = todayLocalIso();
		const settings = this.host.getSettings();
		const cached = settings.state.featuredArticle;
		if (cached && cached.date === today && cached.fetched && cached.title) {
			return cached;
		}
		if (this.inflightFeatured && this.inflightFeatured.date === today) {
			return this.inflightFeatured.promise;
		}
		const promise = this.refreshFeaturedArticle(today).finally(() => {
			if (this.inflightFeatured?.date === today)
				this.inflightFeatured = null;
		});
		this.inflightFeatured = { date: today, promise };
		return promise;
	}

	private async refreshFeaturedArticle(
		date: string,
	): Promise<FeaturedArticleRecord> {
		const settings = this.host.getSettings();
		const stub: FeaturedArticleRecord = {
			date,
			title: "",
			extract: "",
			sourceUrl: "",
			fetched: false,
			fetchError: "",
		};
		settings.state.featuredArticle = stub;
		// Note: no trigger("changed") on the placeholder - see rollFact.

		if (!settings.fetchFacts) {
			stub.fetched = true;
			stub.fetchError = "fetch-disabled";
			await this.host.save();
			this.trigger("changed");
			return stub;
		}

		try {
			const feed = await this.fetchFeed(date);
			if (!feed?.featuredArticle) {
				stub.fetched = true;
				stub.fetchError = "no-result";
				await this.host.save();
				this.trigger("changed");
				return stub;
			}
			Object.assign(stub, {
				title: feed.featuredArticle.title,
				extract: feed.featuredArticle.extract,
				sourceUrl: feed.featuredArticle.sourceUrl,
				fetched: true,
				fetchError: "",
			} satisfies Partial<FeaturedArticleRecord>);
			await this.host.save();
			this.trigger("changed");
			return stub;
		} catch (err) {
			console.warn("[muse] featured article fetch failed", err);
			stub.fetched = true;
			stub.fetchError = err instanceof Error ? err.message : "unknown";
			await this.host.save();
			this.trigger("changed");
			return stub;
		}
	}

	/* -------------------- shared fetch + cache -------------------- */

	private async ensurePool(date: string): Promise<FactCandidate[]> {
		const settings = this.host.getSettings();
		const cached = settings.state.fact.pool;
		if (cached.date === date && cached.items.length > 0) {
			return cached.items;
		}
		const feed = await this.fetchFeed(date);
		const items = feed?.onThisDay ?? [];
		settings.state.fact.pool = { date, items };
		return items;
	}

	/**
	 * De-duplicated network fetch for the Wikimedia featured feed. If a
	 * fetch for the same date is already in-flight, returns its promise.
	 */
	private async fetchFeed(date: string): Promise<WikipediaFeed | null> {
		if (this.inflight && this.inflight.date === date) {
			return this.inflight.promise;
		}
		const localDate = parseLocalIsoDate(date) ?? new Date();
		const promise = fetchWikipediaFeed(localDate).finally(() => {
			if (this.inflight?.date === date) this.inflight = null;
		});
		this.inflight = { date, promise };
		return promise;
	}
}

function makeStubFact(date: string): DailyFactRecord {
	return {
		date,
		id: "",
		text: "",
		year: 0,
		source: "",
		sourceUrl: "",
		permalink: "",
		fetched: false,
		fetchError: "",
	};
}

function factFromCandidate(
	candidate: FactCandidate,
	date: string,
): DailyFactRecord {
	return {
		date,
		id: candidate.id,
		text: candidate.text,
		year: candidate.year,
		source: candidate.source,
		sourceUrl: candidate.sourceUrl,
		permalink: candidate.permalink,
		fetched: true,
		fetchError: "",
	};
}

function pickCandidate(
	pool: FactCandidate[],
	dismissed: Set<string>,
	strategy: "first" | "next",
	previousId: string,
): FactCandidate {
	const eligible = pool.filter((c) => !dismissed.has(c.id));
	const list = eligible.length > 0 ? eligible : pool;
	if (strategy === "first") {
		return list[0] ?? pool[0]!;
	}
	const currentIdx = list.findIndex((c) => c.id === previousId);
	const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % list.length;
	return list[nextIdx] ?? list[0] ?? pool[0]!;
}
