import { requestUrl } from "obsidian";
import type { FactCandidate } from "../types";

/**
 * Wikimedia REST feed endpoint. The `featured` route returns four
 * editorially curated payloads in a single call:
 *   - tfa:        today's featured article  (text only - we never surface the image)
 *   - image:      picture of the day        (intentionally ignored - safety)
 *   - mostread:   yesterday's most-read articles (unused for now)
 *   - onthisday:  curated "on this day" historical events
 *
 * The "image" payload is deliberately not parsed: Wikimedia's picture of
 * the day can include graphic / NSFW content with no warning, so the
 * plugin opts out of displaying any image from this endpoint at all.
 *
 * Docs: https://api.wikimedia.org/wiki/Feed_API/Reference/Featured_content
 */
const FEATURED_URL =
	"https://api.wikimedia.org/feed/v1/wikipedia/en/featured";

/**
 * Wikimedia asks API consumers to identify themselves; a generic but
 * informative UA is sufficient for low-volume use like ours.
 */
const USER_AGENT = "clio (Obsidian community plugin)";

/**
 * Parsed shape we need from a single Wikimedia "featured" call. Each
 * field is independently optional - missing pieces just disable the
 * corresponding card.
 */
export interface WikipediaFeed {
	onThisDay: FactCandidate[];
	featuredArticle: FeaturedArticle | null;
}

export interface FeaturedArticle {
	title: string;
	extract: string;
	sourceUrl: string;
}

/**
 * Fetch Wikipedia's curated daily feed for `date`. Returns null on any
 * network or parse failure - callers fall back to cached state.
 *
 * The date's month and day are read in **local time**, matching the
 * rest of the plugin which keys everything off the user's local day.
 */
export async function fetchWikipediaFeed(
	date: Date,
): Promise<WikipediaFeed | null> {
	const yyyy = String(date.getFullYear()).padStart(4, "0");
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const url = `${FEATURED_URL}/${yyyy}/${mm}/${dd}`;

	let response;
	try {
		response = await requestUrl({
			url,
			method: "GET",
			headers: {
				Accept: "application/json",
				"Api-User-Agent": USER_AGENT,
				"User-Agent": USER_AGENT,
			},
			throw: false,
		});
	} catch (err) {
		console.warn("[clio] wikipedia feed fetch failed", err);
		return null;
	}
	if (response.status !== 200) return null;

	const json: unknown = response.json;
	if (!isPlainObject(json)) return null;

	return {
		onThisDay: parseOnThisDay(json["onthisday"]),
		featuredArticle: parseFeaturedArticle(json["tfa"]),
	};
}

/* ---------- on this day ---------- */

interface RawPage {
	title?: unknown;
	titles?: { normalized?: unknown };
	content_urls?: {
		desktop?: { page?: unknown };
	};
}

interface RawEvent {
	text?: unknown;
	year?: unknown;
	pages?: unknown;
}

function parseOnThisDay(raw: unknown): FactCandidate[] {
	if (!Array.isArray(raw)) return [];
	const out: FactCandidate[] = [];
	for (const entry of raw) {
		const candidate = parseEvent(entry);
		if (candidate) out.push(candidate);
	}
	return out;
}

function parseEvent(raw: unknown): FactCandidate | null {
	if (!isPlainObject(raw)) return null;
	const e = raw as RawEvent;
	const text = typeof e.text === "string" ? e.text.trim() : "";
	if (!text) return null;
	const year = typeof e.year === "number" ? Math.trunc(e.year) : 0;

	const pages = Array.isArray(e.pages) ? (e.pages as RawPage[]) : [];
	const firstPage = pages[0];
	let pageTitle = "";
	let pageUrl = "";
	if (firstPage) {
		const normalized = firstPage.titles?.normalized;
		if (typeof normalized === "string") pageTitle = normalized;
		else if (typeof firstPage.title === "string") pageTitle = firstPage.title;

		const desktop = firstPage.content_urls?.desktop?.page;
		if (typeof desktop === "string") {
			pageUrl = desktop;
		} else if (typeof firstPage.title === "string") {
			pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(firstPage.title)}`;
		}
	}

	return {
		id: stableId(year, pageTitle || text),
		text,
		year,
		source: "Wikipedia",
		sourceUrl: pageUrl,
		permalink: pageUrl,
	};
}

/* ---------- featured article ---------- */

function parseFeaturedArticle(raw: unknown): FeaturedArticle | null {
	if (!isPlainObject(raw)) return null;
	const titles = isPlainObject(raw["titles"]) ? raw["titles"] : null;
	const normalized = titles ? stringOr(titles["normalized"], "") : "";
	const title = normalized || stringOr(raw["title"], "");
	if (!title) return null;
	const extract = stringOr(raw["extract"], "").trim();
	if (!extract) return null;

	const urls = isPlainObject(raw["content_urls"]) ? raw["content_urls"] : null;
	const desktop = urls && isPlainObject(urls["desktop"]) ? urls["desktop"] : null;
	const sourceUrl = desktop
		? stringOr(desktop["page"], "")
		: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

	return { title, extract, sourceUrl };
}

/* ---------- shared helpers ---------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

/**
 * Build a stable id from year + a label so we can dedupe across re-fetches
 * and remember dismissed entries even if Wikipedia tweaks the surrounding
 * text.
 */
function stableId(year: number, label: string): string {
	let h = 2166136261 >>> 0;
	const input = `${year}::${label}`;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return `${year}-${(h >>> 0).toString(36)}`;
}
