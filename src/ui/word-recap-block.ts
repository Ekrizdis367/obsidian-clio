import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type { WordManager } from "../words/manager";
import { createCardHeader } from "./card-header";

export interface WordRecapBlockHost {
	manager: WordManager;
}

interface BlockOptions {
	limit: number;
	revealed: boolean;
}

class WordRecapBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: WordRecapBlockHost,
		private readonly options: BlockOptions,
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

	private render(): void {
		this.containerEl.empty();
		const card = this.containerEl.createDiv({
			cls: "muse-fact-card muse-recap-card",
		});
		createCardHeader(card, "Word recap");

		const entries = this.host.manager.getRecentHistory(this.options.limit);
		if (entries.length === 0) {
			card.createDiv({
				cls: "muse-empty",
				text:
					"No history yet. Enable “Track word-of-the-day history” " +
					"in Muse settings to start collecting your past words.",
			});
			return;
		}

		const list = card.createEl("ul", { cls: "muse-recap-list" });
		for (const entry of entries) {
			const item = list.createEl("li", { cls: "muse-recap-item" });
			const head = item.createDiv({ cls: "muse-recap-head" });
			const wordEl = head.createSpan({
				cls: "muse-recap-word",
				text: entry.word,
			});
			head.createSpan({ cls: "muse-recap-date", text: entry.date });
			if (entry.partOfSpeech) {
				head.createSpan({
					cls: "muse-recap-pos",
					text: entry.partOfSpeech,
				});
			}

			const defWrap = item.createDiv({
				cls: "muse-recap-definition",
			});
			defWrap.createSpan({
				cls: "muse-recap-definition-text",
				text: entry.definitions[0] ?? "",
			});
			let revealed = this.options.revealed;
			const apply = (): void => {
				defWrap.toggleClass("muse-recap-hidden", !revealed);
			};
			apply();

			const toggle = defWrap.createEl("button", {
				cls: "muse-link-button muse-recap-toggle",
				text: revealed ? "Hide" : "Reveal",
			});
			toggle.addEventListener("click", () => {
				revealed = !revealed;
				toggle.setText(revealed ? "Hide" : "Reveal");
				apply();
			});
			wordEl.addEventListener("click", () => toggle.click());
		}
	}
}

function parseOptions(source: string): BlockOptions {
	const opts: BlockOptions = { limit: 7, revealed: false };
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const sep = line.indexOf(":");
		if (sep === -1) continue;
		const key = line.slice(0, sep).trim().toLowerCase();
		const value = line.slice(sep + 1).trim();
		if (key === "limit" || key === "count" || key === "days") {
			const n = Number.parseInt(value, 10);
			if (Number.isFinite(n) && n > 0) opts.limit = Math.min(n, 30);
		} else if (key === "reveal" || key === "revealed") {
			opts.revealed = !/^(false|no|off|0)$/i.test(value);
		}
	}
	return opts;
}

export function registerWordRecapBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: WordRecapBlockHost,
): void {
	register("word-recap", (source, el, ctx) => {
		ctx.addChild(new WordRecapBlockChild(el, host, parseOptions(source)));
	});
}
