/**
 * Symbolic / astrological calculations for the Sky card.
 *
 * Tropical (Western) zodiac for Sun & Moon signs, sidereal (Vedic
 * Lahiri) for nakshatras, and a static table of Mercury retrograde
 * windows. All math is local and approximate - within ~0.5° for moon
 * longitude, plenty to place the moon in the right zodiac sign (30°
 * wide) and the right nakshatra (~13.3° wide).
 *
 * References:
 * - Meeus, "Astronomical Algorithms", ch. 47 (moon position).
 * - Lahiri ayanamsha for tropical → sidereal conversion.
 * - Mercury retrograde dates from public ephemerides.
 */

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DEG = Math.PI / 180;

/** Days (incl. fraction) since J2000.0 (2000-01-01 12:00 UTC). */
function daysSinceJ2000(date: Date): number {
	return (date.getTime() - J2000_MS) / 86_400_000;
}

function norm360(x: number): number {
	return ((x % 360) + 360) % 360;
}

/* ----------------------------- Zodiac signs ----------------------------- */

export type ZodiacElement = "Fire" | "Earth" | "Air" | "Water";
export type ZodiacModality = "Cardinal" | "Fixed" | "Mutable";

export interface ZodiacSign {
	index: number;
	name: string;
	glyph: string;
	element: ZodiacElement;
	modality: ZodiacModality;
}

const ZODIAC: readonly ZodiacSign[] = [
	{ index: 0, name: "Aries", glyph: "♈", element: "Fire", modality: "Cardinal" },
	{ index: 1, name: "Taurus", glyph: "♉", element: "Earth", modality: "Fixed" },
	{ index: 2, name: "Gemini", glyph: "♊", element: "Air", modality: "Mutable" },
	{ index: 3, name: "Cancer", glyph: "♋", element: "Water", modality: "Cardinal" },
	{ index: 4, name: "Leo", glyph: "♌", element: "Fire", modality: "Fixed" },
	{ index: 5, name: "Virgo", glyph: "♍", element: "Earth", modality: "Mutable" },
	{ index: 6, name: "Libra", glyph: "♎", element: "Air", modality: "Cardinal" },
	{ index: 7, name: "Scorpio", glyph: "♏", element: "Water", modality: "Fixed" },
	{
		index: 8,
		name: "Sagittarius",
		glyph: "♐",
		element: "Fire",
		modality: "Mutable",
	},
	{
		index: 9,
		name: "Capricorn",
		glyph: "♑",
		element: "Earth",
		modality: "Cardinal",
	},
	{ index: 10, name: "Aquarius", glyph: "♒", element: "Air", modality: "Fixed" },
	{ index: 11, name: "Pisces", glyph: "♓", element: "Water", modality: "Mutable" },
];

function signFromLongitude(longitude: number): ZodiacSign {
	const idx = Math.floor(norm360(longitude) / 30) % 12;
	const sign = ZODIAC[idx];
	if (!sign) throw new Error(`Invalid zodiac index: ${idx}`);
	return sign;
}

export interface ZodiacReading {
	sign: ZodiacSign;
	/** Apparent ecliptic longitude (deg, tropical). */
	longitude: number;
}

/* ----------------------------- Sun & Moon ------------------------------ */

/** Sun's apparent ecliptic longitude in degrees (tropical). */
function sunLongitude(date: Date): number {
	const d = daysSinceJ2000(date);
	const L = 280.46646 + 0.9856474 * d;
	const g = (357.52911 + 0.9856003 * d) * DEG;
	return norm360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

/**
 * Moon's apparent ecliptic longitude in degrees (tropical), using the
 * five largest periodic terms from Meeus. Accuracy ~0.5°.
 */
function moonLongitude(date: Date): number {
	const d = daysSinceJ2000(date);
	const L = 218.3164477 + 13.17639648 * d;
	const Mp = (134.9633964 + 13.06499295 * d) * DEG; // moon's anomaly
	const D = (297.8501921 + 12.19074912 * d) * DEG; // mean elongation
	const M = (357.5291092 + 0.98560028 * d) * DEG; // sun's anomaly
	const lambda =
		L +
		6.289 * Math.sin(Mp) -
		1.274 * Math.sin(Mp - 2 * D) -
		0.658 * Math.sin(2 * D) +
		0.214 * Math.sin(2 * Mp) -
		0.186 * Math.sin(M);
	return norm360(lambda);
}

export function sunSign(date: Date = new Date()): ZodiacReading {
	const lon = sunLongitude(date);
	return { sign: signFromLongitude(lon), longitude: lon };
}

export function moonSign(date: Date = new Date()): ZodiacReading {
	const lon = moonLongitude(date);
	return { sign: signFromLongitude(lon), longitude: lon };
}

/* -------------------------- Mercury (Keplerian) ------------------------- */

/**
 * Orbital elements at J2000.0 with per-Julian-century rates. Values
 * come from JPL's "Keplerian Elements for Approximate Positions of the
 * Major Planets" table, valid 1800-2050 with ~1° accuracy for inner
 * planets. That's plenty for zodiac placement (signs are 30° wide).
 */
interface OrbitalElements {
	readonly a: number; // semi-major axis, AU
	readonly aRate: number;
	readonly e: number; // eccentricity
	readonly eRate: number;
	readonly I: number; // inclination, deg
	readonly IRate: number;
	readonly L: number; // mean longitude, deg
	readonly LRate: number;
	readonly longPeri: number; // longitude of perihelion, deg
	readonly longPeriRate: number;
	readonly longNode: number; // longitude of ascending node, deg
	readonly longNodeRate: number;
}

const MERCURY_ORBIT: OrbitalElements = {
	a: 0.38709927,
	aRate: 0.00000037,
	e: 0.20563593,
	eRate: 0.00001906,
	I: 7.00497902,
	IRate: -0.00594749,
	L: 252.2503235,
	LRate: 149472.67411175,
	longPeri: 77.45779628,
	longPeriRate: 0.16047689,
	longNode: 48.33076593,
	longNodeRate: -0.12534081,
};

const EARTH_ORBIT: OrbitalElements = {
	a: 1.00000261,
	aRate: 0.00000562,
	e: 0.01671123,
	eRate: -0.00004392,
	I: -0.00001531,
	IRate: -0.01294668,
	L: 100.46457166,
	LRate: 35999.37244981,
	longPeri: 102.93768193,
	longPeriRate: 0.32327364,
	longNode: 0,
	longNodeRate: 0,
};

/** Iteratively solve Kepler's equation M = E - e·sin(E). */
function solveKepler(M: number, e: number): number {
	let E = M;
	for (let i = 0; i < 10; i++) {
		const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
		E -= dE;
		if (Math.abs(dE) < 1e-8) break;
	}
	return E;
}

/** Heliocentric ecliptic position (AU) of a body with given elements. */
function heliocentricPosition(
	el: OrbitalElements,
	T: number,
): { x: number; y: number; z: number } {
	const a = el.a + el.aRate * T;
	const e = el.e + el.eRate * T;
	const I = (el.I + el.IRate * T) * DEG;
	const L = norm360(el.L + el.LRate * T);
	const longPeri = el.longPeri + el.longPeriRate * T;
	const longNode = el.longNode + el.longNodeRate * T;

	let M = norm360(L - longPeri);
	if (M > 180) M -= 360;
	const E = solveKepler(M * DEG, e);

	const xp = a * (Math.cos(E) - e);
	const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

	const omega = (longPeri - longNode) * DEG;
	const Omega = longNode * DEG;
	const cosw = Math.cos(omega);
	const sinw = Math.sin(omega);
	const cosO = Math.cos(Omega);
	const sinO = Math.sin(Omega);
	const cosI = Math.cos(I);
	const sinI = Math.sin(I);

	const x =
		(cosw * cosO - sinw * sinO * cosI) * xp +
		(-sinw * cosO - cosw * sinO * cosI) * yp;
	const y =
		(cosw * sinO + sinw * cosO * cosI) * xp +
		(-sinw * sinO + cosw * cosO * cosI) * yp;
	const z = sinw * sinI * xp + cosw * sinI * yp;

	return { x, y, z };
}

/** Mercury's geocentric ecliptic longitude (deg, tropical). */
function mercuryLongitude(date: Date): number {
	const T = daysSinceJ2000(date) / 36525;
	const mercury = heliocentricPosition(MERCURY_ORBIT, T);
	const earth = heliocentricPosition(EARTH_ORBIT, T);
	const dx = mercury.x - earth.x;
	const dy = mercury.y - earth.y;
	return norm360(Math.atan2(dy, dx) / DEG);
}

export function mercurySign(date: Date = new Date()): ZodiacReading {
	const lon = mercuryLongitude(date);
	return { sign: signFromLongitude(lon), longitude: lon };
}

/* ------------------------------ Nakshatra ------------------------------ */

const NAKSHATRAS: readonly { name: string; ruler: string }[] = [
	{ name: "Ashwini", ruler: "Ketu" },
	{ name: "Bharani", ruler: "Venus" },
	{ name: "Krittika", ruler: "Sun" },
	{ name: "Rohini", ruler: "Moon" },
	{ name: "Mrigashira", ruler: "Mars" },
	{ name: "Ardra", ruler: "Rahu" },
	{ name: "Punarvasu", ruler: "Jupiter" },
	{ name: "Pushya", ruler: "Saturn" },
	{ name: "Ashlesha", ruler: "Mercury" },
	{ name: "Magha", ruler: "Ketu" },
	{ name: "Purva Phalguni", ruler: "Venus" },
	{ name: "Uttara Phalguni", ruler: "Sun" },
	{ name: "Hasta", ruler: "Moon" },
	{ name: "Chitra", ruler: "Mars" },
	{ name: "Swati", ruler: "Rahu" },
	{ name: "Vishakha", ruler: "Jupiter" },
	{ name: "Anuradha", ruler: "Saturn" },
	{ name: "Jyeshtha", ruler: "Mercury" },
	{ name: "Mula", ruler: "Ketu" },
	{ name: "Purva Ashadha", ruler: "Venus" },
	{ name: "Uttara Ashadha", ruler: "Sun" },
	{ name: "Shravana", ruler: "Moon" },
	{ name: "Dhanishta", ruler: "Mars" },
	{ name: "Shatabhisha", ruler: "Rahu" },
	{ name: "Purva Bhadrapada", ruler: "Jupiter" },
	{ name: "Uttara Bhadrapada", ruler: "Saturn" },
	{ name: "Revati", ruler: "Mercury" },
];

const NAKSHATRA_SIZE = 360 / 27;

/**
 * Lahiri ayanamsha (degrees) approximated linearly from J2000.0. The
 * IAU value at J2000 was ~23.85°, increasing at the precession rate
 * (~50.27 arcsec/yr ≈ 0.01396°/yr). Plenty for nakshatra placement.
 */
function lahiriAyanamsha(date: Date): number {
	const years = (date.getTime() - Date.UTC(2000, 0, 1)) / 31_557_600_000;
	return 23.85 + 0.01396 * years;
}

export interface NakshatraReading {
	index: number;
	name: string;
	ruler: string;
	/** Sidereal moon longitude (deg, Lahiri). */
	siderealLongitude: number;
}

export function moonNakshatra(date: Date = new Date()): NakshatraReading {
	const sidereal = norm360(moonLongitude(date) - lahiriAyanamsha(date));
	const idx = Math.floor(sidereal / NAKSHATRA_SIZE) % 27;
	const item = NAKSHATRAS[idx];
	if (!item) throw new Error(`Invalid nakshatra index: ${idx}`);
	return {
		index: idx,
		name: item.name,
		ruler: item.ruler,
		siderealLongitude: sidereal,
	};
}

/* -------------------------- Mercury retrograde -------------------------- */

/**
 * Mercury retrograde windows, UTC start/end dates inclusive. Sourced
 * from public ephemerides; covers 2024-2030. Outside this range the
 * card simply omits the retrograde line - extend the table when we
 * approach the end.
 */
const MERCURY_RX_RANGES: readonly [string, string][] = [
	["2024-04-01", "2024-04-25"],
	["2024-08-05", "2024-08-28"],
	["2024-11-25", "2024-12-15"],
	["2025-03-14", "2025-04-07"],
	["2025-07-18", "2025-08-11"],
	["2025-11-09", "2025-11-29"],
	["2026-02-25", "2026-03-20"],
	["2026-06-29", "2026-07-23"],
	["2026-10-24", "2026-11-13"],
	["2027-02-09", "2027-03-03"],
	["2027-06-10", "2027-07-04"],
	["2027-10-07", "2027-10-28"],
	["2028-01-24", "2028-02-14"],
	["2028-05-21", "2028-06-14"],
	["2028-09-19", "2028-10-11"],
	["2029-01-07", "2029-01-27"],
	["2029-05-01", "2029-05-25"],
	["2029-08-31", "2029-09-23"],
	["2029-12-21", "2030-01-09"],
	["2030-04-13", "2030-05-06"],
	["2030-08-14", "2030-09-06"],
	["2030-12-04", "2030-12-24"],
];

function utcMidnight(iso: string): number {
	const parts = iso.split("-").map((s) => Number.parseInt(s, 10));
	const y = parts[0] ?? 2000;
	const m = parts[1] ?? 1;
	const d = parts[2] ?? 1;
	return Date.UTC(y, m - 1, d);
}

export interface MercuryRetrogradeStatus {
	isRetrograde: boolean;
	/** When the current retrograde ends; only set when active. */
	endsAt?: Date;
	/** Next retrograde start; only set when not active. */
	nextStartsAt?: Date;
	/** Next retrograde end; paired with nextStartsAt. */
	nextEndsAt?: Date;
}

export function mercuryRetrograde(
	date: Date = new Date(),
): MercuryRetrogradeStatus {
	const now = date.getTime();
	for (const [startIso, endIso] of MERCURY_RX_RANGES) {
		const start = utcMidnight(startIso);
		const end = utcMidnight(endIso) + 86_400_000 - 1;
		if (now >= start && now <= end) {
			return { isRetrograde: true, endsAt: new Date(end) };
		}
		if (now < start) {
			return {
				isRetrograde: false,
				nextStartsAt: new Date(start),
				nextEndsAt: new Date(end),
			};
		}
	}
	return { isRetrograde: false };
}
