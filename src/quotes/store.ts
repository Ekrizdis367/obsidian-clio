import { App, Events, TFile, TFolder, debounce } from "obsidian";
import type { Quote } from "../types";
import type { ClioSettings } from "../settings";
import { parseQuotesFromMarkdown } from "./parser";

/**
 * Owns the in-memory quote index. Watches the vault and refreshes itself
 * when files in scope change. Emits a `changed` event whenever the index
 * is rebuilt so views can re-render.
 */
export class QuoteStore extends Events {
	private quotes: Quote[] = [];
	private byPath: Map<string, Quote[]> = new Map();
	private building = false;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => ClioSettings,
	) {
		super();
	}

	getAll(): readonly Quote[] {
		return this.quotes;
	}

	getById(id: string): Quote | undefined {
		return this.quotes.find((q) => q.id === id);
	}

	/** Force a full rebuild from disk. Safe to call often; debounced upstream. */
	async refresh(): Promise<void> {
		if (this.building) return;
		this.building = true;
		try {
			const files = this.collectFiles();
			const next = new Map<string, Quote[]>();
			for (const file of files) {
				const content = await this.app.vault.cachedRead(file);
				const parsed = parseQuotesFromMarkdown(
					content,
					file.path,
					this.getSettings().quoteSource,
				);
				if (parsed.length > 0) next.set(file.path, parsed);
			}
			this.byPath = next;
			this.quotes = flatten(next);
			this.trigger("changed");
		} finally {
			this.building = false;
		}
	}

	/**
	 * Refresh exactly one file. Falls back to a full rebuild when the file
	 * is now outside scope so that quotes from a moved/renamed file go away.
	 */
	async refreshFile(file: TFile): Promise<void> {
		if (file.extension !== "md") return;
		if (!this.fileInScope(file)) {
			if (this.byPath.delete(file.path)) {
				this.quotes = flatten(this.byPath);
				this.trigger("changed");
			}
			return;
		}
		const content = await this.app.vault.cachedRead(file);
		const parsed = parseQuotesFromMarkdown(
			content,
			file.path,
			this.getSettings().quoteSource,
		);
		if (parsed.length > 0) this.byPath.set(file.path, parsed);
		else this.byPath.delete(file.path);
		this.quotes = flatten(this.byPath);
		this.trigger("changed");
	}

	dropFile(path: string): void {
		if (this.byPath.delete(path)) {
			this.quotes = flatten(this.byPath);
			this.trigger("changed");
		}
	}

	private collectFiles(): TFile[] {
		const folders = this.getSettings().quoteFolders;
		if (folders.length === 0) {
			return this.app.vault
				.getMarkdownFiles()
				.filter((f) => f.extension === "md");
		}
		const out: TFile[] = [];
		const seen = new Set<string>();
		for (const path of folders) {
			const folder = this.app.vault.getAbstractFileByPath(path);
			if (folder instanceof TFolder) {
				collectFolder(folder, out, seen);
			} else if (folder instanceof TFile && folder.extension === "md") {
				if (!seen.has(folder.path)) {
					out.push(folder);
					seen.add(folder.path);
				}
			}
		}
		return out;
	}

	private fileInScope(file: TFile): boolean {
		const folders = this.getSettings().quoteFolders;
		if (folders.length === 0) return true;
		return folders.some((p) => file.path === p || file.path.startsWith(`${p}/`));
	}
}

function flatten(byPath: Map<string, Quote[]>): Quote[] {
	const out: Quote[] = [];
	for (const list of byPath.values()) out.push(...list);
	return out;
}

function collectFolder(
	folder: TFolder,
	out: TFile[],
	seen: Set<string>,
): void {
	for (const child of folder.children) {
		if (child instanceof TFolder) {
			collectFolder(child, out, seen);
		} else if (child instanceof TFile && child.extension === "md") {
			if (!seen.has(child.path)) {
				out.push(child);
				seen.add(child.path);
			}
		}
	}
}

/**
 * Helper for `main.ts` - returns a debounced refresh handler so multiple
 * vault events in quick succession don't trigger a storm of full scans.
 */
export function debouncedRefresh(store: QuoteStore): () => void {
	return debounce(
		() => {
			void store.refresh();
		},
		400,
		true,
	);
}
