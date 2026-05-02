import { hashString } from "./date";

/**
 * Mulberry32 - a small, fast, well-distributed PRNG. Given the same seed
 * it always produces the same stream, which is what we want for "today's"
 * picks staying stable across reloads on the same day.
 */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function next(): number {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Pick a deterministic element from an array given a string seed.
 *
 * Returns null only when the array is empty - callers can rely on a
 * non-null result whenever they have at least one item.
 */
export function pickDeterministic<T>(items: readonly T[], seed: string): T | null {
	if (items.length === 0) return null;
	const rng = mulberry32(hashString(seed));
	const index = Math.floor(rng() * items.length);
	return items[Math.min(index, items.length - 1)] ?? null;
}

/** Pick a uniformly random element from an array, or null if empty. */
export function pickRandom<T>(items: readonly T[]): T | null {
	if (items.length === 0) return null;
	const index = Math.floor(Math.random() * items.length);
	return items[Math.min(index, items.length - 1)] ?? null;
}
