import { Events } from "obsidian";
import type { ClioSettings } from "../settings";
import { todayLocalIso } from "../utils/date";

export interface JournalManagerHost {
	getSettings(): ClioSettings;
	save(): Promise<void>;
}

/**
 * Tiny key-value store of one-line journal entries indexed by ISO date.
 * Persisted in `data.json` so entries survive across devices that share
 * the vault.
 *
 * Each entry is intentionally a single short string - the goal of this
 * feature is to be a low-friction "what mattered today?" log, not a
 * full journal.
 */
export class JournalManager extends Events {
	constructor(private readonly host: JournalManagerHost) {
		super();
	}

	getEntry(date: string = todayLocalIso()): string {
		const entries = this.host.getSettings().state.journal.entries;
		return entries[date] ?? "";
	}

	/**
	 * Persist `text` for `date`. Empty strings remove the entry so the
	 * record stays compact and "across years" views don't show blanks.
	 */
	async setEntry(text: string, date: string = todayLocalIso()): Promise<void> {
		const settings = this.host.getSettings();
		const trimmed = text.trim();
		const current = settings.state.journal.entries[date] ?? "";
		if (current === trimmed) return;
		if (trimmed) {
			settings.state.journal.entries[date] = trimmed;
		} else {
			delete settings.state.journal.entries[date];
		}
		await this.host.save();
		this.trigger("changed");
	}

	/**
	 * All non-empty entries for the same calendar month/day in prior years,
	 * newest year first. Used by the "across years" view.
	 */
	getEntriesForMonthDay(
		today: Date = new Date(),
	): { date: string; year: number; yearsAgo: number; text: string }[] {
		const settings = this.host.getSettings();
		const month = today.getMonth() + 1;
		const day = today.getDate();
		const todayYear = today.getFullYear();
		const out: {
			date: string;
			year: number;
			yearsAgo: number;
			text: string;
		}[] = [];
		for (const [date, text] of Object.entries(
			settings.state.journal.entries,
		)) {
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
			if (!m) continue;
			const y = Number(m[1]);
			const mo = Number(m[2]);
			const d = Number(m[3]);
			if (mo !== month || d !== day) continue;
			if (y > todayYear) continue;
			out.push({
				date,
				year: y,
				yearsAgo: todayYear - y,
				text,
			});
		}
		out.sort((a, b) => b.year - a.year);
		return out;
	}

	async clearAll(): Promise<void> {
		const settings = this.host.getSettings();
		if (Object.keys(settings.state.journal.entries).length === 0) return;
		settings.state.journal.entries = {};
		await this.host.save();
		this.trigger("changed");
	}
}
