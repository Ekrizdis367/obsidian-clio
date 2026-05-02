/**
 * Tiny date-format helpers tuned for Obsidian's daily-notes naming
 * conventions. We only support the tokens people commonly use in
 * filenames so we can avoid pulling in moment.js at runtime.
 *
 * Supported tokens (case-insensitive): `YYYY`, `YY`, `MM`, `M`, `DD`, `D`.
 */

function normalizeFormat(format: string): string {
	return format.replace(/[YyMmDd]/g, (c) => c.toUpperCase());
}

export interface DateParts {
	year: number;
	month: number; // 1-12
	day: number; // 1-31
}

export function formatDate(parts: DateParts, format: string): string {
	const yyyy = String(parts.year).padStart(4, "0");
	const yy = yyyy.slice(-2);
	const mm = String(parts.month).padStart(2, "0");
	const m = String(parts.month);
	const dd = String(parts.day).padStart(2, "0");
	const d = String(parts.day);

	format = normalizeFormat(format);
	let out = "";
	let i = 0;
	while (i < format.length) {
		if (format.startsWith("YYYY", i)) {
			out += yyyy;
			i += 4;
		} else if (format.startsWith("YY", i)) {
			out += yy;
			i += 2;
		} else if (format.startsWith("MM", i)) {
			out += mm;
			i += 2;
		} else if (format.startsWith("M", i)) {
			out += m;
			i += 1;
		} else if (format.startsWith("DD", i)) {
			out += dd;
			i += 2;
		} else if (format.startsWith("D", i)) {
			out += d;
			i += 1;
		} else {
			out += format[i];
			i += 1;
		}
	}
	return out;
}

/**
 * Parse a filename string against `format`, returning the calendar
 * date encoded in it or null if the filename doesn't match.
 *
 * The format string is converted to a regex with named groups; any
 * literal characters (e.g. `-` or `/`) are escaped.
 */
export function parseDateFromFilename(
	filename: string,
	format: string,
): DateParts | null {
	format = normalizeFormat(format);
	let pattern = "";
	const groups: ("year2" | "year4" | "month1" | "month2" | "day1" | "day2")[] =
		[];

	let i = 0;
	while (i < format.length) {
		if (format.startsWith("YYYY", i)) {
			pattern += "(\\d{4})";
			groups.push("year4");
			i += 4;
		} else if (format.startsWith("YY", i)) {
			pattern += "(\\d{2})";
			groups.push("year2");
			i += 2;
		} else if (format.startsWith("MM", i)) {
			pattern += "(\\d{2})";
			groups.push("month2");
			i += 2;
		} else if (format.startsWith("M", i)) {
			pattern += "(\\d{1,2})";
			groups.push("month1");
			i += 1;
		} else if (format.startsWith("DD", i)) {
			pattern += "(\\d{2})";
			groups.push("day2");
			i += 2;
		} else if (format.startsWith("D", i)) {
			pattern += "(\\d{1,2})";
			groups.push("day1");
			i += 1;
		} else {
			pattern += escapeRegex(format[i]!);
			i += 1;
		}
	}
	const re = new RegExp(`^${pattern}$`);
	const match = re.exec(filename);
	if (!match) return null;

	let year = 0;
	let month = 0;
	let day = 0;
	for (let j = 0; j < groups.length; j++) {
		const value = match[j + 1] ?? "";
		switch (groups[j]) {
			case "year4":
				year = Number(value);
				break;
			case "year2":
				// 2-digit years live in the 2000s for our purposes; nobody is
				// running a daily-notes vault with notes from 1929.
				year = 2000 + Number(value);
				break;
			case "month1":
			case "month2":
				month = Number(value);
				break;
			case "day1":
			case "day2":
				day = Number(value);
				break;
		}
	}
	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day) ||
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > 31
	) {
		return null;
	}
	return { year, month, day };
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
