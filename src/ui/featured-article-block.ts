import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
} from "obsidian";
import type { WikipediaManager } from "../wikipedia/manager";
import type { FeaturedArticleRecord } from "../types";
import { appendCardLinkIcon, createCardHeader } from "./card-header";

export interface FeaturedArticleBlockHost {
	manager: WikipediaManager;
}

class FeaturedArticleBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: FeaturedArticleBlockHost,
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
			cls: "muse-fact-card muse-featured-card",
		});
		try {
			const today = await this.host.manager.getFeaturedArticleToday();
			renderCard(card, today);
		} catch (err) {
			console.warn("[muse] featured article render failed", err);
			card.createDiv({
				cls: "muse-empty",
				text: "Could not load today's featured article.",
			});
		}
	}
}

function renderCard(card: HTMLElement, today: FeaturedArticleRecord): void {
	const { actions } = createCardHeader(card, "Featured article");

	if (today.fetched && today.title && today.sourceUrl) {
		appendCardLinkIcon(
			actions,
			today.sourceUrl,
			"Read more on Wikipedia",
		);
	}

	if (!today.fetched) {
		card.createDiv({
			cls: "muse-fact-loading",
			text: "Fetching today's featured article…",
		});
		return;
	}

	if (!today.title) {
		const message =
			today.fetchError === "fetch-disabled"
				? "Wikipedia fetching is disabled. Enable it in settings."
				: "No featured article available right now.";
		card.createDiv({ cls: "muse-empty", text: message });
		return;
	}

	const body = card.createDiv({ cls: "muse-featured-body" });
	const text = body.createDiv({ cls: "muse-featured-text" });

	if (today.sourceUrl) {
		const titleLink = text.createEl("a", {
			cls: "muse-featured-title",
			text: today.title,
			href: today.sourceUrl,
		});
		titleLink.setAttr("target", "_blank");
		titleLink.setAttr("rel", "noopener");
	} else {
		text.createDiv({ cls: "muse-featured-title", text: today.title });
	}

	if (today.extract) {
		text.createEl("p", {
			cls: "muse-featured-extract",
			text: today.extract,
		});
	}
}

export function registerFeaturedArticleBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: FeaturedArticleBlockHost,
): void {
	register("featured-article", (_source, el, ctx) => {
		ctx.addChild(new FeaturedArticleBlockChild(el, host));
	});
}
