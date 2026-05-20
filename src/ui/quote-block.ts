import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	TFile,
} from "obsidian";
import type { Quote } from "../types";
import type { QuoteStore } from "../quotes/store";
import type { ClioSettings } from "../settings";
import {
	applyQuoteFilters,
	formatAttribution,
	quoteOfTheDay,
	randomQuote,
} from "../quotes/selection";
import { markEmbedWrapper } from "../utils/embed";
import {
	appendCardIconButton,
	createCardHeader,
} from "./card-header";

export interface QuoteBlockHost {
	app: App;
	store: QuoteStore;
	getSettings(): ClioSettings;
}

interface BlockOptions {
	mode: "daily" | "random";
	tags: string[];
}

function parseOptions(source: string): BlockOptions {
	const opts: BlockOptions = { mode: "daily", tags: [] };
	for (const raw of source.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const colon = line.indexOf(":");
		if (colon === -1) continue;
		const key = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();
		if (key === "mode" && (value === "daily" || value === "random")) {
			opts.mode = value;
		} else if (key === "tags") {
			opts.tags = value
				.split(",")
				.map((t) => t.trim().replace(/^#/, "").toLowerCase())
				.filter(Boolean);
		}
	}
	return opts;
}

class QuoteBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: QuoteBlockHost,
		private readonly opts: BlockOptions,
	) {
		super(container);
	}

	override onload(): void {
		markEmbedWrapper(this.containerEl);
		this.render();
		const callback = (): void => this.render();
		this.host.store.on("changed", callback);
		this.detach = (): void => {
			this.host.store.off("changed", callback);
		};
	}

	override onunload(): void {
		this.detach?.();
		this.detach = null;
	}

	private render(): void {
		this.containerEl.empty();
		const card = this.containerEl.createDiv({ cls: "clio-quote-card" });
		const all = this.host.store.getAll();
		const settings = this.host.getSettings();
		const allowed = applyQuoteFilters(all, settings);
		const filtered =
			this.opts.tags.length === 0
				? allowed
				: allowed.filter((q) =>
						this.opts.tags.every((t) =>
							q.tags.some((qt) => qt.toLowerCase() === t),
						),
					);
		if (filtered.length === 0) {
			card.createDiv({
				cls: "clio-empty",
				text:
					this.opts.tags.length > 0
						? `No quotes match tags: ${this.opts.tags
								.map((t) => `#${t}`)
								.join(", ")}`
						: all.length === 0
							? "No quotes found in your vault yet. Add one with the Add quote command."
							: settings.requireQuoteAuthor
								? "No attributed quotes found. Add an \u201cauthor:\u201d field to your clio-quote blocks (or an \u201c\u2014 Author\u201d line to blockquotes), or turn off \u201cRequire author\u201d in plugin settings."
								: "No quotes available right now.",
			});
			return;
		}
		const quote =
			this.opts.mode === "random"
				? randomQuote(filtered)
				: quoteOfTheDay(filtered);
		if (!quote) return;
		renderQuoteCard(card, quote, this.host);
	}
}

function renderQuoteCard(
	card: HTMLElement,
	quote: Quote,
	host: QuoteBlockHost,
): void {
	const { actions: headerActions } = createCardHeader(card, "Quote");
	appendCardIconButton(headerActions, "external-link", "Open source", () => {
		void openQuoteSource(host.app, quote);
	});
	appendCardIconButton(headerActions, "copy", "Copy quote", () => {
		void copyQuote(quote);
	});

	card.createEl("p", {
		cls: "clio-quote-text",
		text: quote.text,
	});
	const attribution = formatAttribution(quote);
	if (attribution) {
		card.createDiv({
			cls: "clio-quote-attribution",
			text: `— ${attribution}`,
		});
	}
	if (quote.tags.length > 0) {
		const tagWrap = card.createDiv({ cls: "clio-quote-tags" });
		for (const tag of quote.tags) {
			tagWrap.createSpan({
				cls: "clio-tag",
				text: `#${tag}`,
			});
		}
	}
}

async function openQuoteSource(app: App, quote: Quote): Promise<void> {
	const file = app.vault.getAbstractFileByPath(quote.sourcePath);
	if (!(file instanceof TFile)) {
		new Notice("Source file not found.");
		return;
	}
	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file, {
		eState: { line: quote.sourceLine, scroll: quote.sourceLine },
	});
}

async function copyQuote(quote: Quote): Promise<void> {
	const attribution = formatAttribution(quote);
	const text = attribution ? `"${quote.text}" — ${attribution}` : quote.text;
	try {
		await navigator.clipboard.writeText(text);
		new Notice("Quote copied to clipboard.");
	} catch {
		new Notice("Could not copy quote.");
	}
}

export function registerQuoteBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: QuoteBlockHost,
): void {
	register("quote-of-the-day", (source, el, ctx) => {
		const opts = parseOptions(source);
		ctx.addChild(new QuoteBlockChild(el, host, opts));
	});
	register("random-quote", (source, el, ctx) => {
		const opts = { ...parseOptions(source), mode: "random" as const };
		ctx.addChild(new QuoteBlockChild(el, host, opts));
	});
}
