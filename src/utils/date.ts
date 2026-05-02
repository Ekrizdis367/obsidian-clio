/** Format a `Date` as `YYYY-MM-DD` in the user's local timezone. */
export function formatLocalIsoDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * Parse a `YYYY-MM-DD` string into a local Date at midnight. Returns null
 * for malformed input so callers can fall back to "today".
 */
export function parseLocalIsoDate(s: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]) - 1;
	const d = Number(m[3]);
	const dt = new Date(y, mo, d);
	if (Number.isNaN(dt.getTime())) return null;
	return dt;
}

/** Today's local ISO date string, computed each call so it stays accurate. */
export function todayLocalIso(): string {
	return formatLocalIsoDate(new Date());
}

/**
 * Stable 32-bit integer derived from any string. Uses an FNV-1a-style
 * hash because we just need determinism, not cryptographic strength.
 */
export function hashString(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}
