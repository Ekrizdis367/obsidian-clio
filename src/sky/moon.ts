/**
 * Moon-phase calculations. Pure functions, no network calls. Accurate
 * to ~1 day, which is plenty for the casual "what's the moon doing
 * tonight" card we're building.
 *
 * Reference: classic synodic-month formula, Naval Observatory mean.
 */

export interface MoonPhase {
	/** Days since last new moon (0 .. ~29.53). */
	age: number;
	/** Illuminated fraction, 0..1. */
	illumination: number;
	/** Human-readable phase name. */
	name: string;
	/** Emoji glyph for quick visual scanning. */
	emoji: string;
	/** True when the moon is moving toward full. */
	waxing: boolean;
}

const SYNODIC_MONTH_DAYS = 29.530588853;

/** Reference new moon: 2000-01-06 18:14 UTC. */
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

export function calculateMoonPhase(date: Date): MoonPhase {
	const diffDays = (date.getTime() - REFERENCE_NEW_MOON_MS) / 86_400_000;
	const phase = ((diffDays % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) %
		SYNODIC_MONTH_DAYS;
	const fraction = phase / SYNODIC_MONTH_DAYS;
	// Standard illumination model: 0.5 - 0.5*cos(2π * phase fraction)
	const illumination = 0.5 - 0.5 * Math.cos(2 * Math.PI * fraction);
	const waxing = fraction < 0.5;
	const { name, emoji } = labelForFraction(fraction);
	return {
		age: phase,
		illumination,
		name,
		emoji,
		waxing,
	};
}

/**
 * Bucket the synodic fraction into the eight named phases. The boundary
 * windows around the four cardinal phases (new/first/full/last) are
 * narrow on purpose so that, e.g., "Full moon" really means within ~1
 * day of full.
 */
function labelForFraction(fraction: number): { name: string; emoji: string } {
	// Cardinal phase windows are ±0.0185 (≈half a day) around each quarter.
	const w = 0.0185;
	if (fraction < w || fraction > 1 - w) return { name: "New moon", emoji: "🌑" };
	if (Math.abs(fraction - 0.25) < w)
		return { name: "First quarter", emoji: "🌓" };
	if (Math.abs(fraction - 0.5) < w) return { name: "Full moon", emoji: "🌕" };
	if (Math.abs(fraction - 0.75) < w)
		return { name: "Last quarter", emoji: "🌗" };
	if (fraction < 0.25) return { name: "Waxing crescent", emoji: "🌒" };
	if (fraction < 0.5) return { name: "Waxing gibbous", emoji: "🌔" };
	if (fraction < 0.75) return { name: "Waning gibbous", emoji: "🌖" };
	return { name: "Waning crescent", emoji: "🌘" };
}
