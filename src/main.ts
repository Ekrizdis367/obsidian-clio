import { Plugin, TAbstractFile, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { DEFAULT_SETTINGS, mergeSettings, type ClioSettings } from "./settings";
import { QuoteStore } from "./quotes/store";
import { WordManager } from "./words/manager";
import { WikipediaManager } from "./wikipedia/manager";
import { IntentionsManager } from "./intentions/manager";
import { PromptManager } from "./prompts/manager";
import { JournalManager } from "./journal/manager";
import { registerCommands } from "./commands";
import { registerQuoteBlockProcessor } from "./ui/quote-block";
import { registerClioQuoteBlockProcessor } from "./ui/clio-quote-block";
import { registerWordBlockProcessor } from "./ui/word-block";
import { registerOnThisDayBlockProcessor } from "./ui/on-this-day-block";
import { registerFeaturedArticleBlockProcessor } from "./ui/featured-article-block";
import { registerIntentionsBlockProcessor } from "./ui/intentions-block";
import { registerPromptBlockProcessor } from "./ui/prompt-block";
import { registerOneLineJournalBlockProcessor } from "./ui/one-line-journal-block";
import { registerJournalOnThisDayBlockProcessor } from "./ui/journal-on-this-day-block";
import { registerSkyBlockProcessor } from "./ui/sky-block";
import { registerWordRecapBlockProcessor } from "./ui/word-recap-block";
import { registerStaticBlockProcessor } from "./ui/static-block";
import {
	QuoteLibraryView,
	VIEW_TYPE_QUOTE_LIBRARY,
} from "./ui/quote-library-view";
import { ClioSettingsTab } from "./ui/settings-tab";
import { createApi, type ClioApi } from "./api";

export default class ClioPlugin extends Plugin {
	settings!: ClioSettings;
	api!: ClioApi;
	private store!: QuoteStore;
	private wordManager!: WordManager;
	private wikipediaManager!: WikipediaManager;
	private intentionsManager!: IntentionsManager;
	private promptManager!: PromptManager;
	private journalManager!: JournalManager;

	override async onload(): Promise<void> {
		await this.loadSettings();

		const host = {
			getSettings: () => this.settings,
			save: () => this.saveSettings(),
		};

		this.store = new QuoteStore(this.app, () => this.settings);
		this.wordManager = new WordManager(host);
		this.wikipediaManager = new WikipediaManager(host);
		this.intentionsManager = new IntentionsManager(host);
		this.promptManager = new PromptManager(host);
		this.journalManager = new JournalManager(host);

		this.api = createApi(
			this.store,
			this.wordManager,
			this.wikipediaManager,
			this.intentionsManager,
			this.promptManager,
			this.journalManager,
		);

		this.registerView(
			VIEW_TYPE_QUOTE_LIBRARY,
			(leaf: WorkspaceLeaf) =>
				new QuoteLibraryView(leaf, {
					getSettings: () => this.settings,
					saveSettings: () => this.saveSettings(),
					store: this.store,
				}),
		);

		const registerBlock = (language: string, handler: Parameters<Plugin["registerMarkdownCodeBlockProcessor"]>[1]) =>
			this.registerMarkdownCodeBlockProcessor(language, handler);

		registerQuoteBlockProcessor(registerBlock, {
			app: this.app,
			store: this.store,
			getSettings: () => this.settings,
		});
		registerClioQuoteBlockProcessor(registerBlock);
		registerWordBlockProcessor(registerBlock, { manager: this.wordManager });
		registerOnThisDayBlockProcessor(registerBlock, {
			manager: this.wikipediaManager,
		});
		registerFeaturedArticleBlockProcessor(registerBlock, {
			manager: this.wikipediaManager,
		});
		registerIntentionsBlockProcessor(registerBlock, {
			manager: this.intentionsManager,
		});
		registerPromptBlockProcessor(registerBlock, {
			manager: this.promptManager,
		});
		registerOneLineJournalBlockProcessor(registerBlock, {
			manager: this.journalManager,
		});
		registerJournalOnThisDayBlockProcessor(registerBlock, {
			app: this.app,
			getSettings: () => this.settings,
		});
		registerSkyBlockProcessor(registerBlock, {
			getSettings: () => this.settings,
		});
		registerWordRecapBlockProcessor(registerBlock, {
			manager: this.wordManager,
		});
		registerStaticBlockProcessor(registerBlock, { app: this.app });

		registerCommands({
			plugin: this,
			store: this.store,
			manager: this.wordManager,
			wikipedia: this.wikipediaManager,
			intentions: this.intentionsManager,
			prompts: this.promptManager,
			journal: this.journalManager,
			getSettings: () => this.settings,
			saveSettings: () => this.saveSettings(),
			openQuoteLibrary: () => this.activateLibraryView(),
		});

		this.addRibbonIcon("quote", "Open quote library", () => {
			void this.activateLibraryView();
		});

		this.addSettingTab(
			new ClioSettingsTab(this, {
				app: this.app,
				getSettings: () => this.settings,
				saveSettings: () => this.saveSettings(),
				store: this.store,
				manager: this.wordManager,
				wikipedia: this.wikipediaManager,
				intentions: this.intentionsManager,
				prompts: this.promptManager,
				journal: this.journalManager,
			}),
		);

		const refresh = debounce(
			() => {
				void this.store.refresh();
			},
			400,
			true,
		);

		this.registerEvent(
			this.app.metadataCache.on("changed", (file: TFile) => {
				if (file.extension === "md") void this.store.refreshFile(file);
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", (file: TAbstractFile) => {
				if (file instanceof TFile && file.extension === "md") {
					void this.store.refreshFile(file);
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				this.store.dropFile(file.path);
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				this.store.dropFile(oldPath);
				if (file instanceof TFile && file.extension === "md") {
					void this.store.refreshFile(file);
				}
				refresh();
			}),
		);

		this.app.workspace.onLayoutReady(() => {
			void this.store.refresh();
			void this.wordManager.getToday();
			void this.wikipediaManager.getFactToday();
			if (this.settings.showFeaturedArticle) {
				void this.wikipediaManager.getFeaturedArticleToday();
			}
			void this.promptManager.getToday();
		});
	}

	override onunload(): void {
		// Registered events/intervals are cleaned up automatically.
	}

	private async loadSettings(): Promise<void> {
		const raw = (await this.loadData()) as Partial<ClioSettings> | null;
		this.settings = mergeSettings(raw ?? DEFAULT_SETTINGS);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async activateLibraryView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_QUOTE_LIBRARY);
		let leaf = existing[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({
				type: VIEW_TYPE_QUOTE_LIBRARY,
				active: true,
			});
		}
		await workspace.revealLeaf(leaf);
	}
}
