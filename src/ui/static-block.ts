import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	parseYaml,
} from "obsidian";
import {
	appendCardIconButton,
	appendCardLinkIcon,
	createCardHeader,
} from "./card-header";

/**
 * `muse-static` codeblock processor.
 *
 * Renders a frozen snapshot of any Muse card from data baked into the
 * codeblock body (YAML). The output uses the same CSS classes as the
 * live codeblock cards (`muse-quote-card`, `muse-word-card`, etc.) so
 * the visual treatment is identical.
 *
 * Templater drops these into daily notes via the API helpers in
 * `src/utils/static-markdown.ts`. Because the data is baked into the
 * file, the rendering never changes - tomorrow's note will not show
 * today's word.
 *
 * Live-state-dependent controls (Skip, Show different, manager-backed
 * intentions toggling) are intentionally omitted from static cards.
 * "Copy" and external "Read more" links are kept since they only need
 * the baked data.
 */

export interface StaticBlockHost {
	app: App;
}

interface StaticBlockData {
	type?: unknown;
	[key: string]: unknown;
}

class StaticBlockChild extends MarkdownRenderChild {
	constructor(
		container: HTMLElement,
		private readonly host: StaticBlockHost,
		private readonly source: string,
	) {
		super(container);
	}

	override onload(): void {
		this.render();
	}

	private render(): void {
		this.containerEl.empty();

		let data: StaticBlockData;
		try {
			const raw: unknown = parseYaml(this.source) as unknown;
			data =
				raw && typeof raw === "object" && !Array.isArray(raw)
					? (raw as StaticBlockData)
					: {};
		} catch (err) {
			this.containerEl.createDiv({
				cls: "muse-empty",
				text:
					"Invalid muse-static block: " +
					((err as Error)?.message ?? "YAML parse error") +
					".",
			});
			return;
		}

		const type = str(data["type"]).toLowerCase();
		switch (type) {
			case "quote":
				renderStaticQuote(this.containerEl, data);
				break;
			case "word":
				renderStaticWord(this.containerEl, data);
				break;
			case "fact":
				renderStaticFact(this.containerEl, data);
				break;
			case "article":
				renderStaticArticle(this.containerEl, data);
				break;
			case "prompt":
				renderStaticPrompt(this.containerEl, data);
				break;
			case "intentions":
				renderStaticIntentions(this.containerEl, data);
				break;
			case "journal-history":
				renderStaticJournalHistory(this.containerEl, data, this.host);
				break;
			case "":
				this.containerEl.createDiv({
					cls: "muse-empty",
					text: 'muse-static block needs a "type:" field.',
				});
				break;
			default:
				this.containerEl.createDiv({
					cls: "muse-empty",
					text: `Unknown muse-static type: "${type}".`,
				});
		}
	}
}

/* ----------------------------- renderers ------------------------------ */

function renderStaticQuote(container: HTMLElement, data: StaticBlockData): void {
	const text = str(data["text"] ?? data["quote"]).trim();
	if (!text) {
		container.createDiv({
			cls: "muse-empty",
			text: 'muse-static quote needs a "text:" field.',
		});
		return;
	}
	const author = str(data["author"]).trim();
	const source = str(data["source"]).trim();
	const tags = strList(data["tags"]).map((t) => t.replace(/^#/, ""));

	const card = container.createDiv({ cls: "muse-quote-card" });
	const { actions } = createCardHeader(card, "Quote");
	appendCardIconButton(actions, "copy", "Copy quote", () => {
		const attribution = [author, source].filter(Boolean).join(", ");
		const out = attribution ? `"${text}" — ${attribution}` : text;
		void copyToClipboard(out, "Quote copied to clipboard.");
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

function renderStaticWord(container: HTMLElement, data: StaticBlockData): void {
	const word = str(data["word"]).trim();
	if (!word) {
		container.createDiv({
			cls: "muse-empty",
			text: 'muse-static word needs a "word:" field.',
		});
		return;
	}
	const partOfSpeech = str(data["partOfSpeech"]).trim();
	const phonetic = str(data["phonetic"]).trim();
	const definitions = strList(data["definitions"] ?? data["definition"]);
	const examples = strList(data["examples"] ?? data["example"]);

	const card = container.createDiv({ cls: "muse-word-card" });
	createCardHeader(card, "Word of the day");

	const body = card.createDiv({ cls: "muse-word-body" });
	body.createEl("h3", { cls: "muse-word-title", text: word });

	if (phonetic || partOfSpeech) {
		const meta = body.createDiv({ cls: "muse-word-meta" });
		if (phonetic) {
			meta.createSpan({
				cls: "muse-word-phonetic",
				text: phonetic,
			});
		}
		if (partOfSpeech) {
			meta.createSpan({
				cls: "muse-word-pos",
				text: partOfSpeech,
			});
		}
	}

	const content = body.createDiv({ cls: "muse-word-content" });
	if (definitions.length === 0) {
		content.createDiv({
			cls: "muse-word-loading",
			text: "No definition available.",
		});
		return;
	}

	const list = content.createEl("ol", { cls: "muse-word-defs" });
	for (const def of definitions) {
		list.createEl("li", { text: def });
	}
	if (examples.length > 0) {
		const ex = content.createDiv({ cls: "muse-word-examples" });
		ex.createDiv({
			cls: "muse-word-examples-label",
			text: "Examples",
		});
		const ul = ex.createEl("ul");
		for (const e of examples) {
			ul.createEl("li", { text: `“${e}”` });
		}
	}
}

function renderStaticFact(container: HTMLElement, data: StaticBlockData): void {
	const text = str(data["text"]).trim();
	if (!text) {
		container.createDiv({
			cls: "muse-empty",
			text: 'muse-static fact needs a "text:" field.',
		});
		return;
	}
	const yearRaw = data["year"];
	const year =
		typeof yearRaw === "number"
			? String(yearRaw)
			: str(yearRaw).trim();
	const sourceUrl = str(data["sourceUrl"] ?? data["source_url"]).trim();
	const source = str(data["source"]).trim();

	const card = container.createDiv({ cls: "muse-fact-card" });
	const { actions } = createCardHeader(card, "On this day");
	if (sourceUrl) {
		const tooltip = source ? `Read more on ${source}` : "Read more";
		appendCardLinkIcon(actions, sourceUrl, tooltip);
	}

	const p = card.createEl("p", { cls: "muse-fact-text" });
	if (year) {
		p.createEl("strong", { cls: "muse-fact-year", text: year });
		p.appendText(" — ");
	}
	p.appendText(text);
}

function renderStaticArticle(
	container: HTMLElement,
	data: StaticBlockData,
): void {
	const title = str(data["title"]).trim();
	const extract = str(data["extract"]).trim();
	if (!title) {
		container.createDiv({
			cls: "muse-empty",
			text: 'muse-static article needs a "title:" field.',
		});
		return;
	}
	const sourceUrl = str(data["sourceUrl"] ?? data["source_url"]).trim();

	const card = container.createDiv({
		cls: "muse-fact-card muse-featured-card",
	});
	const { actions } = createCardHeader(card, "Featured article");
	if (sourceUrl) {
		appendCardLinkIcon(actions, sourceUrl, "Read more on Wikipedia");
	}

	const body = card.createDiv({ cls: "muse-featured-body" });
	const text = body.createDiv({ cls: "muse-featured-text" });
	if (sourceUrl) {
		const titleLink = text.createEl("a", {
			cls: "muse-featured-title",
			text: title,
			href: sourceUrl,
		});
		titleLink.setAttr("target", "_blank");
		titleLink.setAttr("rel", "noopener");
	} else {
		text.createDiv({ cls: "muse-featured-title", text: title });
	}
	if (extract) {
		text.createEl("p", {
			cls: "muse-featured-extract",
			text: extract,
		});
	}
}

function renderStaticPrompt(container: HTMLElement, data: StaticBlockData): void {
	const text = str(data["text"]).trim();
	if (!text) {
		container.createDiv({
			cls: "muse-empty",
			text: 'muse-static prompt needs a "text:" field.',
		});
		return;
	}
	const card = container.createDiv({
		cls: "muse-fact-card muse-prompt-card",
	});
	const { actions } = createCardHeader(card, "Reflection prompt");
	appendCardIconButton(actions, "copy", "Copy prompt", () => {
		void copyToClipboard(text, "Prompt copied.");
	});

	card.createEl("p", { cls: "muse-prompt-text", text });
}

function renderStaticIntentions(
	container: HTMLElement,
	data: StaticBlockData,
): void {
	const items = strList(data["items"] ?? data["intentions"]);
	const card = container.createDiv({ cls: "muse-intentions-card" });
	createCardHeader(card, "Today's intentions");
	if (items.length === 0) {
		card.createDiv({
			cls: "muse-empty",
			text: "No intentions configured. Add some in Settings → Muse.",
		});
		return;
	}

	const sentence = card.createDiv({ cls: "muse-intentions-sentence" });
	sentence.createSpan({
		cls: "muse-intentions-lead",
		text: "Today, I'll ",
	});
	items.forEach((it, i) => {
		sentence.createSpan({
			cls: "muse-intentions-word",
			text: (it || "(untitled)").toLowerCase(),
		});
		const isLast = i === items.length - 1;
		const isPenultimate = i === items.length - 2;
		if (isLast) {
			sentence.createSpan({
				cls: "muse-intentions-punct",
				text: ".",
			});
		} else if (isPenultimate) {
			sentence.createSpan({
				cls: "muse-intentions-punct",
				text: items.length === 2 ? " and " : ", and ",
			});
		} else {
			sentence.createSpan({
				cls: "muse-intentions-punct",
				text: ", ",
			});
		}
	});
}

interface JournalHistoryEntryData {
	year: number;
	yearsAgo: number;
	text: string;
	path?: string;
}

function renderStaticJournalHistory(
	container: HTMLElement,
	data: StaticBlockData,
	host: StaticBlockHost,
): void {
	const raw = data["entries"];
	const entries: JournalHistoryEntryData[] = Array.isArray(raw)
		? raw.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const obj = item as Record<string, unknown>;
				const year =
					typeof obj["year"] === "number"
						? obj["year"]
						: Number.parseInt(str(obj["year"]), 10);
				const yearsAgo =
					typeof obj["yearsAgo"] === "number"
						? obj["yearsAgo"]
						: Number.parseInt(str(obj["yearsAgo"]), 10);
				const text = str(obj["text"]).trim();
				if (!Number.isFinite(year) || !text) return [];
				const path = str(obj["path"]).trim() || undefined;
				return [
					{
						year,
						yearsAgo: Number.isFinite(yearsAgo) ? yearsAgo : 0,
						text,
						path,
					},
				];
			})
		: [];

	const card = container.createDiv({
		cls: "muse-fact-card muse-vault-otd-card",
	});
	createCardHeader(card, "On this day in your vault");

	if (entries.length === 0) {
		card.createDiv({
			cls: "muse-empty",
			text: "No past-year entries to show.",
		});
		return;
	}

	const list = card.createEl("ul", { cls: "muse-vault-otd-list" });
	for (const m of entries) {
		const item = list.createEl("li", { cls: "muse-vault-otd-item" });
		const head = item.createDiv({ cls: "muse-vault-otd-head" });
		head.createSpan({
			cls: "muse-vault-otd-year",
			text: String(m.year),
		});
		head.createSpan({
			cls: "muse-vault-otd-ago",
			text:
				m.yearsAgo === 1
					? "1 year ago"
					: `${m.yearsAgo} years ago`,
		});
		if (m.path) {
			const link = item.createEl("a", {
				cls: "muse-vault-otd-link internal-link",
				text: m.path.split("/").pop() ?? m.path,
				href: m.path,
			});
			link.setAttr("data-href", m.path);
			link.addEventListener("click", (evt) => {
				evt.preventDefault();
				void host.app.workspace.openLinkText(m.path!, "", false);
			});
		}
		item.createEl("p", {
			cls: "muse-vault-otd-preview",
			text: m.text,
		});
	}
}

/* ------------------------------ helpers ------------------------------- */

function str(v: unknown): string {
	if (v === null || v === undefined) return "";
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return "";
}

function strList(v: unknown): string[] {
	if (v === null || v === undefined) return [];
	if (Array.isArray(v)) {
		return v
			.map((x) => str(x).trim())
			.filter((x) => x.length > 0);
	}
	const s = str(v).trim();
	if (!s) return [];
	return s
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);
}

async function copyToClipboard(text: string, success: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		new Notice(success);
	} catch {
		new Notice("Could not copy to clipboard.");
	}
}

/* ---------------------------- registration ---------------------------- */

export function registerStaticBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: StaticBlockHost,
): void {
	register("muse-static", (source, el, ctx) => {
		ctx.addChild(new StaticBlockChild(el, host, source));
	});
}
