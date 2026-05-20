import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";

export interface NewQuoteInput {
	text: string;
	author: string;
	source: string;
	tags: string[];
}

/**
 * Append a quote to the configured inbox file as a `clio-quote` code
 * block. Creates the file (and any missing folders) on first use. The
 * `clio-quote` format is the canonical authoring format and is always
 * indexed regardless of the user's `quoteSource` setting.
 */
export async function appendQuoteToInbox(
	app: App,
	inboxPath: string,
	input: NewQuoteInput,
): Promise<void> {
	const text = input.text.trim();
	if (!text) {
		new Notice("Quote text is required.");
		return;
	}

	const path = normalizePath(inboxPath);
	const file = await ensureFile(app, path);
	const existing = await app.vault.read(file);
	const block = formatClioQuoteBlock({ ...input, text });
	const next =
		existing.trimEnd().length === 0
			? `${block}\n`
			: `${existing.trimEnd()}\n\n${block}\n`;
	await app.vault.modify(file, next);
}

/**
 * Render a quote as the canonical `clio-quote` code block. We
 * deliberately write `quote:` on a single line (no soft wrapping) so
 * users can easily select-and-copy the value, and so multi-line quote
 * text is preserved exactly when the file is round-tripped through the
 * parser.
 */
export function formatClioQuoteBlock(input: NewQuoteInput): string {
	const lines = ["```clio-quote", `quote: ${oneLine(input.text)}`];
	const author = input.author.trim();
	if (author) lines.push(`author: ${author}`);
	const source = input.source.trim();
	if (source) lines.push(`source: ${source}`);
	const tags = input.tags
		.map((t) => t.trim().replace(/^#/, ""))
		.filter(Boolean);
	if (tags.length > 0) lines.push(`tags: ${tags.join(", ")}`);
	lines.push("```");
	return lines.join("\n");
}

/** Collapse internal whitespace so the quote stays on one line. */
function oneLine(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

async function ensureFile(app: App, path: string): Promise<TFile> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;
	if (existing) {
		throw new Error(`Quotes inbox path is not a file: ${path}`);
	}
	const dir = path.includes("/")
		? path.slice(0, path.lastIndexOf("/"))
		: "";
	if (dir) {
		const folder = app.vault.getAbstractFileByPath(dir);
		if (!folder) {
			await app.vault.createFolder(dir);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Quotes inbox parent is not a folder: ${dir}`);
		}
	}
	return app.vault.create(path, "");
}
