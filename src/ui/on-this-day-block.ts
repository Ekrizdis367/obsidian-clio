import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
} from "obsidian";
import type { WikipediaManager } from "../wikipedia/manager";
import type { DailyFactRecord } from "../types";
import {
	appendCardIconButton,
	appendCardLinkIcon,
	createCardHeader,
} from "./card-header";

export interface OnThisDayBlockHost {
	manager: WikipediaManager;
}

class OnThisDayBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: OnThisDayBlockHost,
	) {
		super(container);
	}

	override onload(): void {
		void this.render();
		const callback = (): void => {
			void this.render();
		};
		this.host.manager.on("changed", callback);
		this.detach = (): void => {
			this.host.manager.off("changed", callback);
		};
	}

	override onunload(): void {
		this.detach?.();
		this.detach = null;
	}

	private async render(): Promise<void> {
		this.containerEl.empty();
		const card = this.containerEl.createDiv({ cls: "clio-fact-card" });
		try {
			const today = await this.host.manager.getFactToday();
			renderCard(card, today, this.host);
		} catch (err) {
			console.warn("[clio] on-this-day render failed", err);
			card.createDiv({
				cls: "clio-empty",
				text: "Could not load today's on-this-day event.",
			});
		}
	}
}

function renderCard(
	card: HTMLElement,
	today: DailyFactRecord,
	host: OnThisDayBlockHost,
): void {
	const { actions } = createCardHeader(card, "On this day");

	if (today.fetched && today.text) {
		if (today.sourceUrl) {
			const tooltip = today.source
				? `Read more on ${today.source}`
				: "Read more";
			appendCardLinkIcon(actions, today.sourceUrl, tooltip);
		}
		appendCardIconButton(actions, "skip-forward", "Skip event", () => {
			void host.manager.dismissFact().then(() => {
				new Notice("Skipped. Showing a different event.");
			});
		});
		appendCardIconButton(actions, "copy", "Copy event", () => {
			void copyFact(today);
		});
	}

	if (!today.fetched) {
		card.createDiv({
			cls: "clio-fact-loading",
			text: "Looking up historical events…",
		});
		return;
	}

	if (!today.text) {
		const message =
			today.fetchError === "fetch-disabled"
				? "On-this-day fetching is disabled. Enable it in settings."
				: "No events available right now. Try again later.";
		card.createDiv({ cls: "clio-empty", text: message });
		return;
	}

	const p = card.createEl("p", { cls: "clio-fact-text" });
	if (today.year) {
		p.createEl("strong", {
			cls: "clio-fact-year",
			text: String(today.year),
		});
		p.appendText(" — ");
	}
	p.appendText(today.text);
}

async function copyFact(today: DailyFactRecord): Promise<void> {
	const prefix = today.year ? `${today.year} — ` : "";
	const lines: string[] = [`${prefix}${today.text}`];
	if (today.sourceUrl) {
		lines.push(`Source: ${today.source || "Wikipedia"} (${today.sourceUrl})`);
	} else if (today.source) {
		lines.push(`Source: ${today.source}`);
	}
	try {
		await navigator.clipboard.writeText(lines.join("\n"));
		new Notice("Event copied to clipboard.");
	} catch {
		new Notice("Could not copy event.");
	}
}

export function registerOnThisDayBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: OnThisDayBlockHost,
): void {
	const handler = (
		_source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	): void => {
		ctx.addChild(new OnThisDayBlockChild(el, host));
	};
	register("on-this-day", handler);
	register("fact-of-the-day", handler);
}
