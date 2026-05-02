import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import type { QuoteStore } from "../quotes/store";
import type { WordManager } from "../words/manager";
import type { WikipediaManager } from "../wikipedia/manager";
import type { IntentionsManager } from "../intentions/manager";
import type { PromptManager } from "../prompts/manager";
import type { JournalManager } from "../journal/manager";
import {
	applyQuoteFilters,
	formatAttribution,
	quoteOfTheDay,
	quoteToMarkdown,
	randomQuote,
} from "../quotes/selection";
import type { MuseSettings } from "../settings";
import { todayLocalIso } from "../utils/date";
import { AddQuoteModal } from "../ui/add-quote-modal";
import { MigrateQuotesModal } from "../ui/migrate-quotes-modal";
import { scanForBlockquoteQuotes } from "../quotes/migration";
import {
	VIEW_TYPE_QUOTE_LIBRARY,
	type QuoteLibraryHost,
} from "../ui/quote-library-view";

export interface CommandsHost {
	plugin: Plugin;
	store: QuoteStore;
	manager: WordManager;
	wikipedia: WikipediaManager;
	intentions: IntentionsManager;
	prompts: PromptManager;
	journal: JournalManager;
	getSettings(): MuseSettings;
	saveSettings(): Promise<void>;
	openQuoteLibrary(): Promise<void>;
}

export function registerCommands(host: CommandsHost): void {
	const {
		plugin,
		store,
		manager,
		wikipedia,
		intentions,
		prompts,
		journal,
	} = host;
	const libraryHost: QuoteLibraryHost = {
		getSettings: () => host.getSettings(),
		saveSettings: () => host.saveSettings(),
		store,
	};

	plugin.addCommand({
		id: "add-quote",
		name: "Add quote",
		callback: () => {
			new AddQuoteModal(plugin.app, {
				getSettings: () => host.getSettings(),
				store,
			}).open();
		},
	});

	plugin.addCommand({
		id: "open-quote-library",
		name: "Open quote library",
		callback: () => {
			void host.openQuoteLibrary();
		},
	});

	plugin.addCommand({
		id: "insert-quote-of-the-day",
		name: "Insert quote of the day",
		editorCallback: (editor: Editor, view: MarkdownView) => {
			const quote = quoteOfTheDay(
				applyQuoteFilters(store.getAll(), host.getSettings()),
			);
			if (!quote) {
				new Notice(noQuotesMessage(store, host));
				return;
			}
			editor.replaceSelection(`${quoteToMarkdown(quote)}\n`);
			void view;
		},
	});

	plugin.addCommand({
		id: "insert-random-quote",
		name: "Insert random quote",
		editorCallback: (editor: Editor) => {
			const quote = randomQuote(
				applyQuoteFilters(store.getAll(), host.getSettings()),
			);
			if (!quote) {
				new Notice(noQuotesMessage(store, host));
				return;
			}
			editor.replaceSelection(`${quoteToMarkdown(quote)}\n`);
		},
	});

	plugin.addCommand({
		id: "insert-quote-of-the-day-block",
		name: "Insert quote-of-the-day block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```quote-of-the-day\n```\n");
		},
	});

	plugin.addCommand({
		id: "insert-blank-quote-block",
		name: "Insert blank quote block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection(
				"```muse-quote\nquote: \nauthor: \n```\n",
			);
		},
	});

	plugin.addCommand({
		id: "insert-word-of-the-day-block",
		name: "Insert word-of-the-day block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```word-of-the-day\n```\n");
		},
	});

	plugin.addCommand({
		id: "copy-quote-of-the-day",
		name: "Copy quote of the day to clipboard",
		callback: () => {
			const quote = quoteOfTheDay(
				applyQuoteFilters(store.getAll(), host.getSettings()),
			);
			if (!quote) {
				new Notice(noQuotesMessage(store, host));
				return;
			}
			const attribution = formatAttribution(quote);
			const text = attribution
				? `"${quote.text}" — ${attribution}`
				: quote.text;
			void navigator.clipboard.writeText(text).then(() => {
				new Notice("Quote copied.");
			});
		},
	});

	plugin.addCommand({
		id: "reroll-word-of-the-day",
		name: "Reroll word of the day",
		callback: async () => {
			const today = host.getSettings().state.word.today;
			await manager.rollForDate(
				today?.date ?? todayLocalIso(),
				Math.floor(Math.random() * 1024),
			);
			new Notice("New word selected for today.");
		},
	});

	plugin.addCommand({
		id: "skip-word-of-the-day",
		name: "Skip today's word",
		callback: async () => {
			await manager.dismissCurrent();
			new Notice("Skipped. A new word has been selected.");
		},
	});

	/* ----- on-this-day (Wikipedia) ----- */

	plugin.addCommand({
		id: "insert-fact-of-the-day-block",
		name: "Insert on-this-day block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```on-this-day\n```\n");
		},
	});

	plugin.addCommand({
		id: "reroll-fact-of-the-day",
		name: "Show a different on-this-day event",
		callback: async () => {
			const today = host.getSettings().state.fact.today;
			await wikipedia.rollFact(today?.date ?? todayLocalIso(), {
				strategy: "next",
			});
			new Notice("Showing a different historical event.");
		},
	});

	plugin.addCommand({
		id: "skip-fact-of-the-day",
		name: "Skip today's on-this-day event",
		callback: async () => {
			await wikipedia.dismissFact();
			new Notice("Skipped. Showing a different event.");
		},
	});

	plugin.addCommand({
		id: "copy-fact-of-the-day",
		name: "Copy on-this-day event to clipboard",
		callback: async () => {
			const fact = await wikipedia.getFactToday();
			if (!fact.text) {
				new Notice("No event available right now.");
				return;
			}
			const prefix = fact.year ? `${fact.year} — ` : "";
			const lines = [`${prefix}${fact.text}`];
			if (fact.sourceUrl) {
				lines.push(
					`Source: ${fact.source || "Wikipedia"} (${fact.sourceUrl})`,
				);
			} else if (fact.source) {
				lines.push(`Source: ${fact.source}`);
			}
			void navigator.clipboard.writeText(lines.join("\n")).then(() => {
				new Notice("Event copied.");
			});
		},
	});

	plugin.addCommand({
		id: "insert-featured-article-block",
		name: "Insert featured article block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```featured-article\n```\n");
		},
	});

	/* ----- vault scanning + journal + prompts ----- */

	plugin.addCommand({
		id: "insert-vault-on-this-day-block",
		name: "Insert vault on-this-day block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```vault-on-this-day\n```\n");
		},
	});

	plugin.addCommand({
		id: "insert-prompt-of-the-day-block",
		name: "Insert reflection-prompt block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```prompt-of-the-day\n```\n");
		},
	});

	plugin.addCommand({
		id: "reroll-prompt-of-the-day",
		name: "Show a different reflection prompt",
		callback: async () => {
			const today = host.getSettings().state.prompt.today;
			await prompts.rollForDate(today?.date ?? todayLocalIso(), "random");
			new Notice("Showing a different prompt.");
		},
	});

	plugin.addCommand({
		id: "skip-prompt-of-the-day",
		name: "Skip today's reflection prompt",
		callback: async () => {
			await prompts.dismissCurrent();
			new Notice("Prompt skipped.");
		},
	});

	plugin.addCommand({
		id: "insert-one-line-journal-block",
		name: "Insert one-line journal block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```one-line-journal\n```\n");
		},
	});

	plugin.addCommand({
		id: "insert-sky-block",
		name: "Insert sky-today block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```sky-today\n```\n");
		},
	});

	plugin.addCommand({
		id: "insert-word-recap-block",
		name: "Insert word-recap block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```word-recap\nlimit: 7\n```\n");
		},
	});

	plugin.addCommand({
		id: "refresh-quote-index",
		name: "Refresh quote index",
		callback: async () => {
			await store.refresh();
			new Notice(`Indexed ${store.getAll().length} quote(s).`);
		},
	});

	plugin.addCommand({
		id: "convert-blockquote-quotes",
		name: "Convert blockquote quotes to structured blocks",
		callback: async () => {
			const notice = new Notice("Scanning vault for blockquote quotes…", 0);
			let candidates;
			try {
				candidates = await scanForBlockquoteQuotes(
					plugin.app,
					host.getSettings(),
				);
			} finally {
				notice.hide();
			}
			if (candidates.length === 0) {
				new Notice(
					"No blockquote quotes found. Either everything is already converted or there are no blockquotes in scope.",
				);
				return;
			}
			new MigrateQuotesModal(plugin.app, {
				candidates,
				refreshStore: () => store.refresh(),
			}).open();
		},
	});

	plugin.addCommand({
		id: "insert-daily-intentions-block",
		name: "Insert daily intentions block",
		editorCallback: (editor: Editor) => {
			editor.replaceSelection("```daily-intentions\n```\n");
		},
	});

	plugin.addCommand({
		id: "complete-all-intentions",
		name: "Complete all of today's intentions",
		callback: async () => {
			const items = intentions.getItems();
			if (items.length === 0) {
				new Notice(
					"No intentions configured. Add some in the plugin settings.",
				);
				return;
			}
			for (const it of items) {
				await intentions.setDone(it.id, true);
			}
			new Notice(
				`Marked ${items.length} intention${items.length === 1 ? "" : "s"} complete.`,
			);
		},
	});

	void libraryHost;
	void journal;
}

/**
 * Returns the right empty-state message depending on whether the user has
 * no quotes at all or just no quotes that pass the current filters.
 */
function noQuotesMessage(store: QuoteStore, host: CommandsHost): string {
	if (store.getAll().length === 0) {
		return "No quotes found in your vault yet.";
	}
	if (host.getSettings().requireQuoteAuthor) {
		return 'No attributed quotes available. Add an "author:" field to your muse-quote blocks (or an "\u2014 Author" line to blockquotes), or turn off "Require author" in plugin settings.';
	}
	return "No quotes available right now.";
}

export const QUOTE_LIBRARY_VIEW = VIEW_TYPE_QUOTE_LIBRARY;
