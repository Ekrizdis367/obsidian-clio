import { Events } from "obsidian";
import { MAX_INTENTIONS, type MuseSettings } from "../settings";
import type { Intention } from "../types";
import {
	formatLocalIsoDate,
	parseLocalIsoDate,
	todayLocalIso,
} from "../utils/date";

export interface IntentionsHost {
	getSettings(): MuseSettings;
	save(): Promise<void>;
}

export interface IntentionStatus {
	id: string;
	text: string;
	done: boolean;
}

/**
 * Owns the user's daily intentions and their completion history. Mirrors
 * the surface of `WordManager`/`QuoteStore`: emits `changed` whenever the
 * underlying state mutates so views can re-render in lockstep.
 */
export class IntentionsManager extends Events {
	constructor(private readonly host: IntentionsHost) {
		super();
	}

	getItems(): readonly Intention[] {
		return this.host.getSettings().intentions.items;
	}

	/** Replace the whole list. Caps at `MAX_INTENTIONS` and persists. */
	async setItems(items: Intention[]): Promise<void> {
		this.host.getSettings().intentions.items = items.slice(0, MAX_INTENTIONS);
		await this.persist();
	}

	async addItem(text = ""): Promise<Intention | null> {
		const items = [...this.host.getSettings().intentions.items];
		if (items.length >= MAX_INTENTIONS) return null;
		const next = createIntention(text);
		items.push(next);
		await this.setItems(items);
		return next;
	}

	async removeItem(id: string): Promise<void> {
		const items = this.host.getSettings().intentions.items.filter(
			(it) => it.id !== id,
		);
		await this.setItems(items);
	}

	async renameItem(id: string, text: string): Promise<void> {
		const items = this.host.getSettings().intentions.items;
		const item = items.find((it) => it.id === id);
		if (!item) return;
		item.text = text;
		await this.persist();
	}

	isDone(intentionId: string, date: string = todayLocalIso()): boolean {
		const map = this.host.getSettings().intentions.history[date];
		return map?.[intentionId] === true;
	}

	async setDone(
		intentionId: string,
		done: boolean,
		date: string = todayLocalIso(),
	): Promise<void> {
		const history = this.host.getSettings().intentions.history;
		const map = { ...(history[date] ?? {}) };
		if (done) map[intentionId] = true;
		else delete map[intentionId];
		if (Object.keys(map).length === 0) delete history[date];
		else history[date] = map;
		await this.persist();
	}

	statusFor(date: string = todayLocalIso()): IntentionStatus[] {
		return this.getItems().map((it) => ({
			id: it.id,
			text: it.text,
			done: this.isDone(it.id, date),
		}));
	}

	/**
	 * Number of consecutive days, counting back from `date`, where the
	 * intention is marked done. A streak of 0 = not done today.
	 */
	currentStreak(intentionId: string, date: string = todayLocalIso()): number {
		const start = parseLocalIsoDate(date);
		if (!start) return 0;
		let streak = 0;
		const cursor = new Date(start);
		while (this.isDone(intentionId, formatLocalIsoDate(cursor))) {
			streak++;
			cursor.setDate(cursor.getDate() - 1);
		}
		return streak;
	}

	/**
	 * Fraction of the last `days` days where the intention was completed.
	 * Always returns a number in [0, 1].
	 */
	recentRate(
		intentionId: string,
		days = 7,
		date: string = todayLocalIso(),
	): number {
		if (days <= 0) return 0;
		const start = parseLocalIsoDate(date);
		if (!start) return 0;
		let done = 0;
		const cursor = new Date(start);
		for (let i = 0; i < days; i++) {
			if (this.isDone(intentionId, formatLocalIsoDate(cursor))) done++;
			cursor.setDate(cursor.getDate() - 1);
		}
		return done / days;
	}

	countTrackedDays(): number {
		return Object.keys(this.host.getSettings().intentions.history).length;
	}

	async clearHistory(): Promise<void> {
		const history = this.host.getSettings().intentions.history;
		if (Object.keys(history).length === 0) return;
		this.host.getSettings().intentions.history = {};
		await this.persist();
	}

	private async persist(): Promise<void> {
		await this.host.save();
		this.trigger("changed");
	}
}

/**
 * Mint an `Intention`. The id is short and random; with at most 4 active
 * items the chance of a collision is irrelevant in practice.
 */
export function createIntention(text = ""): Intention {
	const id = Math.random().toString(36).slice(2, 9);
	return { id, text: text.trim() };
}
