import { requestUrl } from "obsidian";
import type { CachedDefinition } from "../types";

const ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en/";

interface RawDefinition {
	definition?: unknown;
	example?: unknown;
}

interface RawMeaning {
	partOfSpeech?: unknown;
	definitions?: unknown;
}

interface RawPhonetic {
	text?: unknown;
}

interface RawEntry {
	word?: unknown;
	phonetic?: unknown;
	phonetics?: unknown;
	meanings?: unknown;
}

/**
 * Fetch a single word definition from dictionaryapi.dev. Returns null if
 * the word is unknown to the API or the request fails - callers fall back
 * to displaying the word with a "no definition available" hint.
 *
 * The API is free and unauthenticated, so we send no identifying headers
 * beyond a plain user-agent. We pass `throw: false` so a 404 on a word the
 * API doesn't recognise doesn't blow up.
 */
export async function fetchDefinition(
	word: string,
): Promise<CachedDefinition | null> {
	const cleaned = word.trim().toLowerCase();
	if (!cleaned) return null;
	const url = `${ENDPOINT}${encodeURIComponent(cleaned)}`;
	let response;
	try {
		response = await requestUrl({
			url,
			method: "GET",
			headers: {
				Accept: "application/json",
				"User-Agent": "muse",
			},
			throw: false,
		});
	} catch (err) {
		console.warn("[muse] dictionary fetch failed", cleaned, err);
		return null;
	}
	if (response.status !== 200) return null;
	const json: unknown = response.json;
	const entries = Array.isArray(json) ? (json as RawEntry[]) : [];
	if (entries.length === 0) return null;
	return parseEntries(cleaned, entries);
}

function parseEntries(
	requestedWord: string,
	entries: RawEntry[],
): CachedDefinition | null {
	const definitions: string[] = [];
	const examples: string[] = [];
	let phonetic = "";
	let partOfSpeech = "";
	let canonicalWord = requestedWord;

	for (const entry of entries) {
		if (typeof entry.word === "string" && entry.word) {
			canonicalWord = entry.word;
		}
		if (!phonetic && typeof entry.phonetic === "string") {
			phonetic = entry.phonetic;
		}
		if (!phonetic && Array.isArray(entry.phonetics)) {
			for (const p of entry.phonetics as RawPhonetic[]) {
				if (typeof p?.text === "string" && p.text) {
					phonetic = p.text;
					break;
				}
			}
		}
		const meanings = Array.isArray(entry.meanings)
			? (entry.meanings as RawMeaning[])
			: [];
		for (const meaning of meanings) {
			const pos =
				typeof meaning.partOfSpeech === "string"
					? meaning.partOfSpeech
					: "";
			if (!partOfSpeech && pos) partOfSpeech = pos;
			const defs = Array.isArray(meaning.definitions)
				? (meaning.definitions as RawDefinition[])
				: [];
			for (const d of defs) {
				if (typeof d.definition === "string" && d.definition.trim()) {
					definitions.push(d.definition.trim());
				}
				if (typeof d.example === "string" && d.example.trim()) {
					examples.push(d.example.trim());
				}
			}
		}
	}

	if (definitions.length === 0) return null;

	return {
		word: canonicalWord,
		phonetic,
		partOfSpeech,
		// Cap at 3 definitions/examples to keep the cache - and the UI - small.
		definitions: definitions.slice(0, 3),
		examples: examples.slice(0, 3),
	};
}
