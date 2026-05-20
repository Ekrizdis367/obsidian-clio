import { Events } from "obsidian";
import type { ClioSettings } from "../settings";
import type { DailyPromptRecord, Prompt } from "../types";
import { hashString, todayLocalIso } from "../utils/date";
import { pickDeterministic, pickRandom } from "../utils/random";
import { BUILT_IN_PROMPTS } from "./list";

const EMPTY_PROMPT: Prompt = { id: "", text: "" };

export interface PromptManagerHost {
	getSettings(): ClioSettings;
	save(): Promise<void>;
}

/**
 * Picks a daily reflection prompt deterministically from a curated +
 * user-customizable pool. Same date -> same prompt. Re-rolls and
 * dismissals shuffle to a different one.
 */
export class PromptManager extends Events {
	constructor(private readonly host: PromptManagerHost) {
		super();
	}

	/**
	 * The prompt currently pinned for today. Picks one if today's date
	 * doesn't match the cached record.
	 */
	async getToday(): Promise<DailyPromptRecord> {
		const today = todayLocalIso();
		const settings = this.host.getSettings();
		const cached = settings.state.prompt.today;
		if (cached && cached.date === today) {
			return cached;
		}
		return this.rollForDate(today, "stable");
	}

	/**
	 * Pick a fresh prompt for `date`. `mode` is `"stable"` for the
	 * deterministic daily pick, or `"random"` for re-rolls.
	 */
	async rollForDate(
		date: string,
		mode: "stable" | "random" = "random",
	): Promise<DailyPromptRecord> {
		const settings = this.host.getSettings();
		const pool = this.buildPool();
		if (pool.length === 0) {
			const empty: DailyPromptRecord = { date, id: "", text: "" };
			settings.state.prompt.today = empty;
			await this.host.save();
			this.trigger("changed");
			return empty;
		}

		const dismissed = settings.respectDismissedPrompts
			? new Set(settings.state.prompt.dismissed)
			: new Set<string>();
		const eligible = pool.filter((p) => !dismissed.has(p.id));
		const list = eligible.length > 0 ? eligible : pool;

		const previousId = settings.state.prompt.today?.id ?? "";
		let chosen: Prompt;
		if (mode === "stable") {
			chosen = pickDeterministic(list, `${date}:prompt`) ?? EMPTY_PROMPT;
		} else {
			const minus = list.filter((p) => p.id !== previousId);
			chosen = pickRandom(minus.length > 0 ? minus : list) ?? EMPTY_PROMPT;
		}

		const record: DailyPromptRecord = {
			date,
			id: chosen.id,
			text: chosen.text,
		};
		settings.state.prompt.today = record;
		await this.host.save();
		this.trigger("changed");
		return record;
	}

	async dismissCurrent(): Promise<DailyPromptRecord> {
		const settings = this.host.getSettings();
		const current = settings.state.prompt.today;
		if (
			current?.id &&
			settings.respectDismissedPrompts &&
			!settings.state.prompt.dismissed.includes(current.id)
		) {
			settings.state.prompt.dismissed = [
				...settings.state.prompt.dismissed,
				current.id,
			];
		}
		const date = current?.date ?? todayLocalIso();
		return this.rollForDate(date, "random");
	}

	async clearDismissed(): Promise<void> {
		const settings = this.host.getSettings();
		if (settings.state.prompt.dismissed.length === 0) return;
		settings.state.prompt.dismissed = [];
		await this.host.save();
		this.trigger("changed");
	}

	/**
	 * The full set of prompts available right now: built-ins plus
	 * user-defined entries (or just user-defined if `replaceBuiltInPrompts`
	 * is on). Each gets a stable id so dismissals survive re-rolls.
	 */
	private buildPool(): Prompt[] {
		const settings = this.host.getSettings();
		const out: Prompt[] = [];
		const seen = new Set<string>();

		const addAll = (texts: string[], idPrefix: string) => {
			for (const raw of texts) {
				const text = raw.trim();
				if (!text) continue;
				const id = `${idPrefix}:${hashString(text).toString(36)}`;
				if (seen.has(id)) continue;
				seen.add(id);
				out.push({ id, text });
			}
		};

		if (!settings.replaceBuiltInPrompts) {
			addAll(BUILT_IN_PROMPTS, "builtin");
		}
		const custom = settings.customPrompts
			.split(/\r?\n/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		addAll(custom, "user");
		return out;
	}
}
