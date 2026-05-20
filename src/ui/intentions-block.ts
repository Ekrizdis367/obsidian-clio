import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
} from "obsidian";
import type { IntentionsManager } from "../intentions/manager";
import type { Intention } from "../types";
import { createCardHeader } from "./card-header";

export interface IntentionsBlockHost {
	manager: IntentionsManager;
}

interface BlockOptions {
	/** Override the date used for the checklist; defaults to today's local date. */
	date: string;
}

function parseOptions(source: string): BlockOptions {
	const opts: BlockOptions = { date: "" };
	for (const raw of source.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const colon = line.indexOf(":");
		if (colon === -1) continue;
		const key = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();
		if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
			opts.date = value;
		}
	}
	return opts;
}

class IntentionsBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: IntentionsBlockHost,
		private readonly opts: BlockOptions,
	) {
		super(container);
	}

	override onload(): void {
		this.render();
		const callback = (): void => this.render();
		this.host.manager.on("changed", callback);
		this.detach = (): void => {
			this.host.manager.off("changed", callback);
		};
	}

	override onunload(): void {
		this.detach?.();
		this.detach = null;
	}

	/**
	 * Render the intentions as a single inline sentence:
	 *   "Today I'll read, play, and learn."
	 * Each intention word is clickable; tapping it strikes it through.
	 * The sentence reads naturally and lives in the note like prose
	 * rather than as a discrete widget/checklist.
	 */
	private render(): void {
		this.containerEl.empty();
		const card = this.containerEl.createDiv({ cls: "clio-intentions-card" });
		createCardHeader(card, "Today's intentions");
		const items = this.host.manager.getItems();
		if (items.length === 0) {
			card.createDiv({
				cls: "clio-empty",
				text: "No intentions set yet. Add up to four in the plugin settings.",
			});
			return;
		}

		const date = this.opts.date || undefined;
		const doneCount = items.filter((it) => this.host.manager.isDone(it.id, date))
			.length;
		const allDone = doneCount === items.length;

		const sentence = card.createDiv({ cls: "clio-intentions-sentence" });
		sentence.createSpan({
			cls: "clio-intentions-lead",
			text: this.opts.date ? `On ${this.opts.date}, I'll ` : "Today, I'll ",
		});

		items.forEach((it, i) => {
			this.renderWord(sentence, it, date);
			const isLast = i === items.length - 1;
			const isPenultimate = i === items.length - 2;
			if (isLast) {
				sentence.createSpan({
					cls: "clio-intentions-punct",
					text: ".",
				});
			} else if (isPenultimate) {
				sentence.createSpan({
					cls: "clio-intentions-punct",
					text: items.length === 2 ? " and " : ", and ",
				});
			} else {
				sentence.createSpan({
					cls: "clio-intentions-punct",
					text: ", ",
				});
			}
		});

		if (allDone) {
			sentence.createSpan({
				cls: "clio-intentions-celebrate",
				text: " ✓ All done",
			});
		}
	}

	private renderWord(
		container: HTMLElement,
		intention: Intention,
		date: string | undefined,
	): void {
		const isDone = this.host.manager.isDone(intention.id, date);
		const streak = this.host.manager.currentStreak(intention.id, date);
		const word = container.createEl("button", {
			cls: `clio-intentions-word${isDone ? " is-done" : ""}`,
			attr: {
				type: "button",
				"aria-pressed": String(isDone),
				"aria-label": isDone
					? `${intention.text || "intention"}: mark as not done`
					: `${intention.text || "intention"}: mark as done`,
			},
		});
		word.createSpan({
			cls: "clio-intentions-word-text",
			text: (intention.text || "(untitled)").toLowerCase(),
		});
		if (streak >= 2) {
			word.createSpan({
				cls: "clio-intentions-word-streak",
				attr: { "aria-label": `${streak} day streak` },
				text: ` 🔥${streak}`,
			});
		}
		word.addEventListener("click", () => {
			void this.host.manager
				.setDone(intention.id, !isDone, date)
				.catch(() => {
					/* state will resync on next change event */
				});
		});
	}
}

export function registerIntentionsBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: IntentionsBlockHost,
): void {
	register("daily-intentions", (source, el, ctx) => {
		ctx.addChild(new IntentionsBlockChild(el, host, parseOptions(source)));
	});
}
