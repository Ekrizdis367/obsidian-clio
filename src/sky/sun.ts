/**
 * Sunrise/sunset calculations using the NOAA solar formula. Pure
 * functions, no network. Returns local clock times suitable for
 * display in the daily-note card.
 *
 * Reference: NOAA Solar Calculator, accurate to roughly ±1 minute for
 * typical latitudes well away from the polar circles.
 */

export interface SunTimes {
	/** Local sunrise time, or null if the sun never rises today. */
	sunrise: Date | null;
	/** Local sunset time, or null if the sun never sets today. */
	sunset: Date | null;
	/** Length of the day in minutes (sunset - sunrise), or null. */
	dayLengthMinutes: number | null;
	/** True when the sun is below the horizon all day. */
	polarNight: boolean;
	/** True when the sun is above the horizon all day. */
	midnightSun: boolean;
}

const ZENITH_OFFICIAL = 90.833; // degrees, official sunrise/sunset

export function calculateSunTimes(
	date: Date,
	latitude: number,
	longitude: number,
): SunTimes {
	const sunrise = calculateEvent(date, latitude, longitude, true);
	let sunset = calculateEvent(date, latitude, longitude, false);

	if (sunrise === "always-up" || sunset === "always-up") {
		return {
			sunrise: null,
			sunset: null,
			dayLengthMinutes: null,
			polarNight: false,
			midnightSun: true,
		};
	}
	if (sunrise === "always-down" || sunset === "always-down") {
		return {
			sunrise: null,
			sunset: null,
			dayLengthMinutes: null,
			polarNight: true,
			midnightSun: false,
		};
	}

	// `calculateEvent` builds Date objects on the local calendar day, but
	// the actual UTC instant of sunset can fall on the next UTC day for
	// users west of the prime meridian. Nudge sunset forward 24h when that
	// happens so duration math works. The local time-of-day display is
	// unaffected because we shift by exactly one full cycle.
	if (sunset.getTime() < sunrise.getTime()) {
		sunset = new Date(sunset.getTime() + 86_400_000);
	}

	const dayLengthMinutes = Math.max(
		0,
		Math.round((sunset.getTime() - sunrise.getTime()) / 60_000),
	);
	return {
		sunrise,
		sunset,
		dayLengthMinutes,
		polarNight: false,
		midnightSun: false,
	};
}

type EventResult = Date | "always-up" | "always-down";

function calculateEvent(
	date: Date,
	latitude: number,
	longitude: number,
	rising: boolean,
): EventResult {
	// Day of year (1-based).
	const N = dayOfYear(date);

	// Approximate time of event in fractional hours (UTC).
	const lngHour = longitude / 15;
	const t = rising
		? N + (6 - lngHour) / 24
		: N + (18 - lngHour) / 24;

	// Sun's mean anomaly.
	const M = 0.9856 * t - 3.289;

	// Sun's true longitude.
	let L = M + 1.916 * sinDeg(M) + 0.020 * sinDeg(2 * M) + 282.634;
	L = wrap(L, 360);

	// Sun's right ascension (RA).
	let RA = atanDeg(0.91764 * tanDeg(L));
	RA = wrap(RA, 360);

	// Right ascension into the same quadrant as L.
	const Lquadrant = Math.floor(L / 90) * 90;
	const RAquadrant = Math.floor(RA / 90) * 90;
	RA = RA + (Lquadrant - RAquadrant);
	RA = RA / 15; // hours

	// Sun's declination.
	const sinDec = 0.39782 * sinDeg(L);
	const cosDec = cosDeg(asinDeg(sinDec));

	// Sun's local hour angle.
	const cosH =
		(cosDeg(ZENITH_OFFICIAL) - sinDec * sinDeg(latitude)) /
		(cosDec * cosDeg(latitude));
	if (cosH > 1) return "always-down"; // sun never rises today
	if (cosH < -1) return "always-up"; // sun never sets today

	let H = rising ? 360 - acosDeg(cosH) : acosDeg(cosH);
	H = H / 15;

	// Local mean time.
	const T = H + RA - 0.06571 * t - 6.622;
	let UT = T - lngHour;
	UT = wrap(UT, 24);

	// Build a UTC date for the same calendar day, then convert via getTime.
	const utc = Date.UTC(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		Math.floor(UT),
		Math.floor((UT - Math.floor(UT)) * 60),
		Math.round(((UT - Math.floor(UT)) * 60 - Math.floor((UT - Math.floor(UT)) * 60)) * 60),
	);
	return new Date(utc);
}

function dayOfYear(d: Date): number {
	const start = new Date(d.getFullYear(), 0, 0);
	const diff = d.getTime() - start.getTime();
	return Math.floor(diff / 86_400_000);
}

function wrap(v: number, max: number): number {
	const m = v % max;
	return m < 0 ? m + max : m;
}

function sinDeg(d: number): number {
	return Math.sin((d * Math.PI) / 180);
}
function cosDeg(d: number): number {
	return Math.cos((d * Math.PI) / 180);
}
function tanDeg(d: number): number {
	return Math.tan((d * Math.PI) / 180);
}
function asinDeg(x: number): number {
	return (Math.asin(x) * 180) / Math.PI;
}
function acosDeg(x: number): number {
	return (Math.acos(x) * 180) / Math.PI;
}
function atanDeg(x: number): number {
	return (Math.atan(x) * 180) / Math.PI;
}

export function formatLocalTime(date: Date): string {
	const h = date.getHours();
	const m = date.getMinutes();
	const ampm = h >= 12 ? "PM" : "AM";
	const h12 = h % 12 === 0 ? 12 : h % 12;
	return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDayLength(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}
