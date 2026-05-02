import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
} from "obsidian";
import type { PromptManager } from "../prompts/manager";
import type { DailyPromptRecord } from "../types";
import {
	appendCardIconButton,
	createCardHeader,
} from "./card-header";

export interface PromptBlockHost {
	manager: PromptManager;
}

class PromptBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: PromptBlockHost,
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
		const card = this.containerEl.createDiv({
			cls: "muse-fact-card muse-prompt-card",
		});
		try {
			const today = await this.host.manager.getToday();
			renderCard(card, today, this.host);
		} catch (err) {
			console.warn("[muse] prompt render failed", err);
			card.createDiv({
				cls: "muse-empty",
				text: "Could not load today's prompt.",
			});
		}
	}
}

function renderCard(
	card: HTMLElement,
	today: DailyPromptRecord,
	host: PromptBlockHost,
): void {
	const { actions } = createCardHeader(card, "Reflection prompt");

	if (!today.text) {
		card.createDiv({
			cls: "muse-empty",
			text: "No prompts available. Add custom prompts in Muse settings.",
		});
		return;
	}

	appendCardIconButton(actions, "shuffle", "Show different prompt", () => {
		void host.manager.rollForDate(today.date, "random").then(() => {
			new Notice("Showing a different prompt.");
		});
	});
	appendCardIconButton(actions, "skip-forward", "Skip prompt", () => {
		void host.manager.dismissCurrent().then(() => {
			new Notice("Prompt skipped.");
		});
	});
	appendCardIconButton(actions, "copy", "Copy prompt", () => {
		void navigator.clipboard.writeText(today.text).then(
			() => new Notice("Prompt copied."),
			() => new Notice("Could not copy prompt."),
		);
	});

	card.createEl("p", { cls: "muse-prompt-text", text: today.text });
}

export function registerPromptBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: PromptBlockHost,
): void {
	register("prompt-of-the-day", (_source, el, ctx) => {
		ctx.addChild(new PromptBlockChild(el, host));
	});
}
