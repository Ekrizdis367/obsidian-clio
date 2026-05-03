import {
	Debouncer,
	ItemView,
	Menu,
	Notice,
	TFile,
	WorkspaceLeaf,
	debounce,
} from "obsidian";
import type { Quote } from "../types";
import type { MuseSettings } from "../settings";
import type { QuoteStore } from "../quotes/store";
import { formatAttribution, hasAuthor } from "../quotes/selection";

export const VIEW_TYPE_QUOTE_LIBRARY = "muse-quote-library";

export interface QuoteLibraryHost {
	getSettings(): MuseSettings;
	saveSettings(): Promise<void>;
	store: QuoteStore;
}

interface ViewState {
	query: string;
	tagFilter: string;
	favoritesOnly: boolean;
	/**
	 * When true, also show blockquotes without an attribution line. Off by
	 * default so the library mirrors what the daily/random pickers see when
	 * the global "Require author" setting is on.
	 */
	includeAuthorless: boolean;
}

/**
 * A right-sidebar view listing every quote in the configured scope.
 * Supports text search, single-tag filter, favorites-only toggle, and
 * jumping to the source file. Favorites are stored in plugin settings.
 */
export class QuoteLibraryView extends ItemView {
	private state: ViewState = {
		query: "",
		tagFilter: "",
		favoritesOnly: false,
		includeAuthorless: false,
	};
	private detach: (() => void) | null = null;
	private listEl: HTMLElement | null = null;
	private statsEl: HTMLElement | null = null;
	private rerender: Debouncer<[], void> = debounce(
		() => this.renderList(),
		100,
		true,
	);

	constructor(
		leaf: WorkspaceLeaf,
		private readonly host: QuoteLibraryHost,
	) {
		super(leaf);
	}

	override getViewType(): string {
		return VIEW_TYPE_QUOTE_LIBRARY;
	}

	override getDisplayText(): string {
		return "Quote library";
	}

	override getIcon(): string {
		return "quote";
	}

	override onOpen(): Promise<void> {
		this.renderShell();
		const callback = (): void => {
			this.rerender();
		};
		this.host.store.on("changed", callback);
		this.detach = (): void => {
			this.host.store.off("changed", callback);
		};
		return Promise.resolve();
	}

	override onClose(): Promise<void> {
		this.detach?.();
		this.detach = null;
		return Promise.resolve();
	}

	private renderShell(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("muse-library");

		const header = root.createDiv({ cls: "muse-library-header" });
		header.createEl("h3", { text: "Quote library" });
		this.statsEl = header.createDiv({ cls: "muse-library-stats" });

		const controls = root.createDiv({ cls: "muse-library-controls" });
		const searchInput = controls.createEl("input", {
			type: "search",
			cls: "muse-library-search",
			placeholder: "Search quotes…",
		});
		searchInput.value = this.state.query;
		this.registerDomEvent(searchInput, "input", () => {
			this.state.query = searchInput.value;
			this.rerender();
		});

		const tagInput = controls.createEl("input", {
			type: "search",
			cls: "muse-library-tag-filter",
			placeholder: "Filter by tag (without #)",
		});
		tagInput.value = this.state.tagFilter;
		this.registerDomEvent(tagInput, "input", () => {
			this.state.tagFilter = tagInput.value;
			this.rerender();
		});

		const favLabel = controls.createEl("label", {
			cls: "muse-library-fav-toggle",
		});
		const favCheckbox = favLabel.createEl("input", { type: "checkbox" });
		favCheckbox.checked = this.state.favoritesOnly;
		this.registerDomEvent(favCheckbox, "change", () => {
			this.state.favoritesOnly = favCheckbox.checked;
			this.rerender();
		});
		favLabel.createSpan({ text: "Favorites only" });

		// Only offer the "show authorless" escape hatch when the global
		// "Require author" filter is on; otherwise it has no effect.
		if (this.host.getSettings().requireQuoteAuthor) {
			const authorlessLabel = controls.createEl("label", {
				cls: "muse-library-fav-toggle",
			});
			const authorlessCheckbox = authorlessLabel.createEl("input", {
				type: "checkbox",
			});
			authorlessCheckbox.checked = this.state.includeAuthorless;
			this.registerDomEvent(authorlessCheckbox, "change", () => {
				this.state.includeAuthorless = authorlessCheckbox.checked;
				this.rerender();
			});
			authorlessLabel.createSpan({ text: "Show authorless" });
		}

		const refreshBtn = controls.createEl("button", {
			cls: "muse-link-button",
			text: "Refresh",
		});
		this.registerDomEvent(refreshBtn, "click", () => {
			void this.host.store.refresh();
		});

		this.listEl = root.createDiv({ cls: "muse-library-list" });
		this.renderList();
	}

	private renderList(): void {
		if (!this.listEl) return;
		const all = this.host.store.getAll();
		const requireAuthor = this.host.getSettings().requireQuoteAuthor;
		const respectAuthor =
			requireAuthor && !this.state.includeAuthorless;
		const favorites = new Set(this.host.getSettings().favoriteQuoteIds);
		const filtered = all.filter(
			(q) => matches(q, this.state, favorites) &&
				(!respectAuthor || hasAuthor(q)),
		);
		if (this.statsEl) {
			this.statsEl.setText(
				`${filtered.length} of ${all.length} quote${all.length === 1 ? "" : "s"}`,
			);
		}
		this.listEl.empty();
		if (filtered.length === 0) {
			this.listEl.createDiv({
				cls: "muse-empty",
				text:
					all.length === 0
						? "No quotes found. Try the Add quote command, or add a `muse-quote` code block to a note."
						: respectAuthor
							? 'No attributed quotes match your filters. Tick "Show authorless" to see quotes without an author.'
							: "No quotes match your current filters.",
			});
			return;
		}
		for (const quote of filtered) {
			this.renderQuoteItem(quote, favorites);
		}
	}

	private renderQuoteItem(quote: Quote, favorites: Set<string>): void {
		if (!this.listEl) return;
		const item = this.listEl.createDiv({ cls: "muse-library-item" });
		const text = item.createEl("p", {
			cls: "muse-quote-text",
			text: quote.text,
		});
		text.addEventListener("click", () => {
			void this.openSource(quote);
		});

		const meta = item.createDiv({ cls: "muse-library-item-meta" });
		const attribution = formatAttribution(quote);
		if (attribution) {
			meta.createSpan({
				cls: "muse-quote-attribution",
				text: `— ${attribution}`,
			});
		}
		if (quote.tags.length > 0) {
			const tagWrap = meta.createDiv({ cls: "muse-quote-tags" });
			for (const tag of quote.tags) {
				const tagEl = tagWrap.createSpan({
					cls: "muse-tag muse-tag-clickable",
					text: `#${tag}`,
				});
				tagEl.addEventListener("click", (evt) => {
					evt.stopPropagation();
					this.state.tagFilter = tag;
					this.renderShell();
				});
			}
		}

		const actions = item.createDiv({ cls: "muse-library-item-actions" });
		const isFav = favorites.has(quote.id);
		const favBtn = actions.createEl("button", {
			cls:
				"muse-link-button" +
				(isFav ? " muse-link-button-active" : ""),
			text: isFav ? "★ Unfavorite" : "☆ Favorite",
		});
		favBtn.addEventListener("click", () => {
			void this.toggleFavorite(quote.id);
		});
		const sourceBtn = actions.createEl("button", {
			cls: "muse-link-button",
			text: "Open source",
		});
		sourceBtn.addEventListener("click", () => {
			void this.openSource(quote);
		});
		const copyBtn = actions.createEl("button", {
			cls: "muse-link-button",
			text: "Copy",
		});
		copyBtn.addEventListener("click", () => {
			void copyQuote(quote);
		});

		item.addEventListener("contextmenu", (evt) => {
			const menu = new Menu();
			menu.addItem((m) =>
				m
					.setTitle(isFav ? "Unfavorite" : "Favorite")
					.setIcon("star")
					.onClick(() => {
						void this.toggleFavorite(quote.id);
					}),
			);
			menu.addItem((m) =>
				m
					.setTitle("Open source")
					.setIcon("file")
					.onClick(() => {
						void this.openSource(quote);
					}),
			);
			menu.addItem((m) =>
				m
					.setTitle("Copy quote")
					.setIcon("copy")
					.onClick(() => {
						void copyQuote(quote);
					}),
			);
			menu.showAtMouseEvent(evt);
		});
	}

	private async toggleFavorite(id: string): Promise<void> {
		const settings = this.host.getSettings();
		const set = new Set(settings.favoriteQuoteIds);
		if (set.has(id)) set.delete(id);
		else set.add(id);
		settings.favoriteQuoteIds = Array.from(set);
		await this.host.saveSettings();
		this.rerender();
	}

	private async openSource(quote: Quote): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(quote.sourcePath);
		if (!(file instanceof TFile)) {
			new Notice("Source file not found.");
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, {
			eState: { line: quote.sourceLine, scroll: quote.sourceLine },
		});
	}
}

function matches(
	quote: Quote,
	state: ViewState,
	favorites: Set<string>,
): boolean {
	if (state.favoritesOnly && !favorites.has(quote.id)) return false;
	if (state.tagFilter.trim()) {
		const target = state.tagFilter
			.trim()
			.replace(/^#/, "")
			.toLowerCase();
		if (!quote.tags.some((t) => t.toLowerCase() === target)) return false;
	}
	const q = state.query.trim().toLowerCase();
	if (!q) return true;
	return (
		quote.text.toLowerCase().includes(q) ||
		quote.author.toLowerCase().includes(q) ||
		quote.source.toLowerCase().includes(q)
	);
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
