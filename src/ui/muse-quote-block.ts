import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
} from "obsidian";
import {
	parseMuseQuoteSource,
	type MuseQuoteFields,
} from "../utils/muse-quote";
import {
	appendCardIconButton,
	createCardHeader,
} from "./card-header";

/**
 * Render a `muse-quote` code block in reading mode. The block is the
 * canonical authoring format for quotes - explicit, unambiguous, and
 * always indexed by the quote store regardless of the user's
 * `quoteSource` setting.
 */
class MuseQuoteBlockChild extends MarkdownRenderChild {
	constructor(
		container: HTMLElement,
		private readonly fields: MuseQuoteFields,
	) {
		super(container);
	}

	override onload(): void {
		this.render();
	}

	private render(): void {
		this.containerEl.empty();
		const text = (this.fields["quote"] ?? this.fields["text"] ?? "").trim();
		if (!text) {
			this.containerEl.createDiv({
				cls: "muse-empty",
				text: 'Quote block needs a "quote:" field.',
			});
			return;
		}
		const author = (this.fields["author"] ?? "").trim();
		const source = (this.fields["source"] ?? "").trim();
		const tagsRaw = (this.fields["tags"] ?? "").trim();
		const tags = tagsRaw
			.split(",")
			.map((t) => t.trim().replace(/^#/, ""))
			.filter(Boolean);

		const card = this.containerEl.createDiv({ cls: "muse-quote-card" });

		const { actions } = createCardHeader(card, "Quote");
		appendCardIconButton(actions, "copy", "Copy quote", () => {
			void copyQuoteText(text, author, source);
		});

		card.createEl("p", { cls: "muse-quote-text", text });

		const attribution = [author, source].filter(Boolean).join(", ");
		if (attribution) {
			card.createDiv({
				cls: "muse-quote-attribution",
				text: `— ${attribution}`,
			});
		}

		if (tags.length > 0) {
			const tagWrap = card.createDiv({ cls: "muse-quote-tags" });
			for (const tag of tags) {
				tagWrap.createSpan({ cls: "muse-tag", text: `#${tag}` });
			}
		}
	}
}

async function copyQuoteText(
	text: string,
	author: string,
	source: string,
): Promise<void> {
	const attribution = [author, source].filter(Boolean).join(", ");
	const out = attribution ? `"${text}" — ${attribution}` : text;
	try {
		await navigator.clipboard.writeText(out);
		new Notice("Quote copied to clipboard.");
	} catch {
		new Notice("Could not copy quote.");
	}
}

export function registerMuseQuoteBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
): void {
	register("muse-quote", (source, el, ctx) => {
		const fields = parseMuseQuoteSource(source);
		ctx.addChild(new MuseQuoteBlockChild(el, fields));
	});
}
