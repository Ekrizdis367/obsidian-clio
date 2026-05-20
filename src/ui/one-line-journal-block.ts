import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
} from "obsidian";
import type { JournalManager } from "../journal/manager";
import { todayLocalIso } from "../utils/date";
import { markEmbedWrapper } from "../utils/embed";
import { createCardHeader } from "./card-header";

export interface OneLineJournalBlockHost {
	manager: JournalManager;
}

interface BlockOptions {
	date: string;
	showAcrossYears: boolean;
}

class OneLineJournalBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: OneLineJournalBlockHost,
		private readonly options: BlockOptions,
	) {
		super(container);
	}

	override onload(): void {
		markEmbedWrapper(this.containerEl);
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
			cls: "clio-fact-card clio-journal-card",
		});

		createCardHeader(card, "One-line journal");

		const editor = card.createDiv({ cls: "clio-journal-editor" });
		const input = editor.createEl("input", {
			cls: "clio-journal-input",
			attr: {
				type: "text",
				placeholder: "What mattered today?",
				maxlength: "240",
			},
		});
		input.value = this.host.manager.getEntry(this.options.date);

		const status = editor.createDiv({
			cls: "clio-journal-status",
			text: "",
		});

		const persist = (): void => {
			const next = input.value.trim();
			void this.host.manager
				.setEntry(next, this.options.date)
				.then(() => {
					status.setText(next ? "Saved" : "Cleared");
					setTimeout(() => status.setText(""), 1200);
				})
				.catch(() => new Notice("Could not save journal entry."));
		};

		input.addEventListener("blur", persist);
		input.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				input.blur();
			}
		});

		if (this.options.showAcrossYears) {
			const memories = this.host.manager.getEntriesForMonthDay();
			const past = memories.filter(
				(m) => m.date !== this.options.date,
			);
			if (past.length > 0) {
				const list = card.createEl("ul", {
					cls: "clio-journal-history",
				});
				for (const entry of past) {
					const li = list.createEl("li", { cls: "clio-journal-history-item" });
					li.createSpan({
						cls: "clio-journal-history-year",
						text: `${entry.year}`,
					});
					li.createSpan({
						cls: "clio-journal-history-ago",
						text:
							entry.yearsAgo === 1
								? "1 year ago"
								: `${entry.yearsAgo} years ago`,
					});
					li.createSpan({
						cls: "clio-journal-history-text",
						text: entry.text,
					});
				}
			}
		}
	}
}

function parseOptions(source: string): BlockOptions {
	const opts: BlockOptions = {
		date: todayLocalIso(),
		showAcrossYears: true,
	};
	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const sep = line.indexOf(":");
		if (sep === -1) continue;
		const key = line.slice(0, sep).trim().toLowerCase();
		const value = line.slice(sep + 1).trim();
		if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
			opts.date = value;
		} else if (key === "across-years" || key === "show-history") {
			opts.showAcrossYears = !/^(false|no|off|0)$/i.test(value);
		}
	}
	return opts;
}

export function registerOneLineJournalBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: OneLineJournalBlockHost,
): void {
	register("one-line-journal", (source, el, ctx) => {
		ctx.addChild(
			new OneLineJournalBlockChild(el, host, parseOptions(source)),
		);
	});
}
