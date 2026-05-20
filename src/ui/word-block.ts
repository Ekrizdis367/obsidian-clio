import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
} from "obsidian";
import type { DailyWordRecord } from "../types";
import type { WordManager } from "../words/manager";
import { markEmbedWrapper } from "../utils/embed";
import {
	appendCardIconButton,
	createCardHeader,
} from "./card-header";

export interface WordBlockHost {
	manager: WordManager;
}

class WordBlockChild extends MarkdownRenderChild {
	private detach: (() => void) | null = null;

	constructor(
		container: HTMLElement,
		private readonly host: WordBlockHost,
	) {
		super(container);
	}

	override onload(): void {
		markEmbedWrapper(this.containerEl);
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
		const card = this.containerEl.createDiv({ cls: "clio-word-card" });
		try {
			const today = await this.host.manager.getToday();
			renderWordCard(card, today, this.host);
		} catch (err) {
			console.warn("[clio] word render failed", err);
			card.createDiv({
				cls: "clio-empty",
				text: "Could not load today's word.",
			});
		}
	}
}

function renderWordCard(
	card: HTMLElement,
	today: DailyWordRecord,
	host: WordBlockHost,
): void {
	const { actions } = createCardHeader(card, "Word of the day");

	if (!today.word) {
		card.createDiv({
			cls: "clio-empty",
			text: "No words available. Add some in settings.",
		});
		return;
	}

	appendCardIconButton(actions, "skip-forward", "Skip word", () => {
		void host.manager.dismissCurrent().then(() => {
			new Notice("Skipped. Showing a new word.");
		});
	});
	appendCardIconButton(actions, "copy", "Copy word", () => {
		void copyWord(today);
	});

	const body = card.createDiv({ cls: "clio-word-body" });
	body.createEl("h3", {
		cls: "clio-word-title",
		text: today.word,
	});

	if (today.phonetic || today.partOfSpeech) {
		const meta = body.createDiv({ cls: "clio-word-meta" });
		if (today.phonetic) {
			meta.createSpan({
				cls: "clio-word-phonetic",
				text: today.phonetic,
			});
		}
		if (today.partOfSpeech) {
			meta.createSpan({
				cls: "clio-word-pos",
				text: today.partOfSpeech,
			});
		}
	}

	const content = body.createDiv({ cls: "clio-word-content" });
	if (!today.fetched) {
		content.createDiv({
			cls: "clio-word-loading",
			text: "Looking up definition…",
		});
	} else if (today.definitions.length === 0) {
		content.createDiv({
			cls: "clio-word-loading",
			text: "No definition available - try the dictionary online.",
		});
	} else {
		const list = content.createEl("ol", { cls: "clio-word-defs" });
		for (const def of today.definitions) {
			list.createEl("li", { text: def });
		}
		if (today.examples.length > 0) {
			const examples = content.createDiv({ cls: "clio-word-examples" });
			examples.createDiv({
				cls: "clio-word-examples-label",
				text: "Examples",
			});
			const ul = examples.createEl("ul");
			for (const ex of today.examples) {
				ul.createEl("li", { text: `“${ex}”` });
			}
		}
	}
}

async function copyWord(today: DailyWordRecord): Promise<void> {
	const lines: string[] = [today.word];
	if (today.partOfSpeech || today.phonetic) {
		const meta = [today.partOfSpeech, today.phonetic]
			.filter(Boolean)
			.join(" ");
		if (meta) lines.push(`(${meta})`);
	}
	for (const def of today.definitions) lines.push(`- ${def}`);
	for (const ex of today.examples) lines.push(`  e.g. ${ex}`);
	try {
		await navigator.clipboard.writeText(lines.join("\n"));
		new Notice("Word copied to clipboard.");
	} catch {
		new Notice("Could not copy word.");
	}
}

export function registerWordBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: WordBlockHost,
): void {
	register("word-of-the-day", (_source, el, ctx) => {
		ctx.addChild(new WordBlockChild(el, host));
	});
}
