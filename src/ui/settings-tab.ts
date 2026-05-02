import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { MAX_INTENTIONS, type MuseSettings } from "../settings";
import type { QuoteStore } from "../quotes/store";
import type { WordManager } from "../words/manager";
import type { WikipediaManager } from "../wikipedia/manager";
import type { IntentionsManager } from "../intentions/manager";
import type { PromptManager } from "../prompts/manager";
import type { JournalManager } from "../journal/manager";
import { ADVANCED_WORDS, buildWordList } from "../words/wordlist";
import { todayLocalIso } from "../utils/date";
import {
	COUNTRIES,
	CUSTOM_LOCATION_CODE,
	findCountry,
	resolveCoords,
} from "../sky/locations";

export interface SettingsHost {
	app: App;
	getSettings(): MuseSettings;
	saveSettings(): Promise<void>;
	store: QuoteStore;
	manager: WordManager;
	wikipedia: WikipediaManager;
	intentions: IntentionsManager;
	prompts: PromptManager;
	journal: JournalManager;
}

export class MuseSettingsTab extends PluginSettingTab {
	constructor(
		plugin: Plugin,
		private readonly host: SettingsHost,
	) {
		super(plugin.app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderQuoteSection(containerEl);
		this.renderWordSection(containerEl);
		this.renderWikipediaSection(containerEl);
		this.renderPromptSection(containerEl);
		this.renderJournalSection(containerEl);
		this.renderVaultOnThisDaySection(containerEl);
		this.renderSkySection(containerEl);
		this.renderIntentionsSection(containerEl);
	}

	/* -------------------- quotes -------------------- */

	private renderQuoteSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Quotes").setHeading();

		new Setting(containerEl)
			.setName("Quote folders")
			.setDesc(
				"Vault-relative folder paths to scan for quotes, one per line. Leave blank to scan the entire vault.",
			)
			.addTextArea((ta) => {
				ta.setPlaceholder("Path to a folder, one per line");
				ta.setValue(this.host.getSettings().quoteFolders.join("\n"));
				ta.inputEl.rows = 4;
				ta.onChange(async (value) => {
					this.host.getSettings().quoteFolders = value
						.split(/\r?\n/)
						.map((s) => s.trim())
						.filter(Boolean);
					await this.host.saveSettings();
					await this.host.store.refresh();
				});
			});

		new Setting(containerEl)
			.setName("Quotes inbox file")
			.setDesc(
				"New quotes added with the add quote command are appended to this file (created if missing).",
			)
			.addText((text) =>
				text
					.setPlaceholder("Quotes.md")
					.setValue(this.host.getSettings().quotesInboxPath)
					.onChange(async (value) => {
						this.host.getSettings().quotesInboxPath =
							value.trim() || "Quotes.md";
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Require author")
			.setDesc(
				"Only show quotes that have an author. \u201cmuse-quote\u201d blocks need a non-empty \u201cauthor:\u201d field; bare blockquotes need an \u201c\u2014 author\u201d attribution line. Quotes without attribution are skipped by the daily and random pickers.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().requireQuoteAuthor)
					.onChange(async (value) => {
						this.host.getSettings().requireQuoteAuthor = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Quote source")
			.setDesc(
				"What counts as a quote when scanning your notes. \u201cmuse-quote\u201d code blocks are always indexed; this setting picks what else gets scooped up.",
			)
			.addDropdown((dd) =>
				dd
					.addOptions({
						"muse-quote": "muse-quote blocks only (recommended)",
						blockquotes: "muse-quote blocks + plain blockquotes",
						callouts: "muse-quote blocks + quote callouts",
						both: "muse-quote blocks + blockquotes + callouts",
					})
					.setValue(this.host.getSettings().quoteSource)
					.onChange(async (value) => {
						this.host.getSettings().quoteSource =
							value as MuseSettings["quoteSource"];
						await this.host.saveSettings();
						await this.host.store.refresh();
					}),
			);

		new Setting(containerEl)
			.setName("Refresh quote index")
			.setDesc(
				"Re-scan the configured folders. Run this if quotes look stale.",
			)
			.addButton((btn) =>
				btn.setButtonText("Refresh").onClick(async () => {
					await this.host.store.refresh();
					new Notice(
						`Indexed ${this.host.store.getAll().length} quote(s).`,
					);
				}),
			);

		new Setting(containerEl)
			.setName("Clear favorites")
			.setDesc(
				`You currently have ${this.host.getSettings().favoriteQuoteIds.length} favorited quote(s).`,
			)
			.addButton((btn) =>
				btn.setButtonText("Clear").onClick(async () => {
					this.host.getSettings().favoriteQuoteIds = [];
					await this.host.saveSettings();
					this.display();
				}),
			);
	}

	/* -------------------- word of the day -------------------- */

	private renderWordSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Word of the day").setHeading();

		new Setting(containerEl)
			.setName("Fetch definitions online")
			.setDesc(
				"Look up the daily word at api.dictionaryapi.dev for definitions and example sentences. Disable to use the word list offline only.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().fetchDefinitions)
					.onChange(async (value) => {
						this.host.getSettings().fetchDefinitions = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Skip dismissed words")
			.setDesc(
				"When you skip a word, never show it again. Turn off to let dismissed words come back.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().respectDismissedWords)
					.onChange(async (value) => {
						this.host.getSettings().respectDismissedWords = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Replace built-in word list")
			.setDesc(
				"When on, only words from the custom list below are used. When off, custom words are added to the built-in list.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().replaceBuiltInWordList)
					.onChange(async (value) => {
						this.host.getSettings().replaceBuiltInWordList = value;
						await this.host.saveSettings();
					}),
			);

		const wordCountDesc = (): string => {
			const list = buildWordList(
				this.host.getSettings().customWordList,
				this.host.getSettings().replaceBuiltInWordList,
			);
			const builtIn = ADVANCED_WORDS.length;
			return `Effective list: ${list.length} word(s). Built-in: ${builtIn}.`;
		};

		new Setting(containerEl)
			.setName("Custom word list")
			.setDesc(`One word per line. ${wordCountDesc()}`)
			.addTextArea((ta) => {
				ta.setPlaceholder("Ineluctable\npenultimate\nsesquipedalian");
				ta.setValue(this.host.getSettings().customWordList);
				ta.inputEl.rows = 8;
				ta.onChange(async (value) => {
					this.host.getSettings().customWordList = value;
					await this.host.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Skipped words")
			.setDesc(
				`You've skipped ${this.host.getSettings().state.word.dismissed.length} word(s).`,
			)
			.addButton((btn) =>
				btn.setButtonText("Clear skipped list").onClick(async () => {
					await this.host.manager.clearDismissed();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("Reroll today's word")
			.setDesc(
				"Pick a different word for today without dismissing the current one.",
			)
			.addButton((btn) =>
				btn.setButtonText("Reroll").onClick(async () => {
					const today = this.host.getSettings().state.word.today;
					await this.host.manager.rollForDate(
						today?.date ?? todayLocalIso(),
						Math.floor(Math.random() * 1024),
					);
					new Notice("New word selected for today.");
				}),
			);

		new Setting(containerEl)
			.setName("Track word-of-the-day history")
			.setDesc(
				"Save each day's word so the word-recap card has data to show. " +
					"History is stored locally in this plugin's data file.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().trackWordHistory)
					.onChange(async (value) => {
						this.host.getSettings().trackWordHistory = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Clear word history")
			.setDesc(
				`You have ${this.host.getSettings().state.word.history.length} word(s) saved in history.`,
			)
			.addButton((btn) =>
				btn
					.setButtonText("Clear history")
					.setWarning()
					.onClick(async () => {
						await this.host.manager.clearHistory();
						new Notice("Word history cleared.");
						this.display();
					}),
			);
	}

	/* -------------------- wikipedia (otd / tfa / potd) -------------------- */

	private renderWikipediaSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Wikipedia daily").setHeading();

		new Setting(containerEl).setDesc(
			"Both Wikipedia cards (on this day, today's featured article) " +
				"share a single Wikimedia request per day. The featured article is text-only - " +
				"images from Wikipedia are intentionally never displayed.",
		);

		new Setting(containerEl)
			.setName("Fetch events online")
			.setDesc(
				"Master switch for any call to api.wikimedia.org. Disable to keep the plugin fully offline.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().fetchFacts)
					.onChange(async (value) => {
						this.host.getSettings().fetchFacts = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Skip dismissed events")
			.setDesc(
				"When you skip an on-this-day event, never show it again. Turn off to let dismissed events come back.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().respectDismissedFacts)
					.onChange(async (value) => {
						this.host.getSettings().respectDismissedFacts = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Skipped events")
			.setDesc(
				`You've skipped ${this.host.getSettings().state.fact.dismissed.length} event(s).`,
			)
			.addButton((btn) =>
				btn.setButtonText("Clear skipped list").onClick(async () => {
					await this.host.wikipedia.clearDismissedFacts();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("Show a different event")
			.setDesc(
				"Cycle to the next event in today's curated list, without dismissing the current one.",
			)
			.addButton((btn) =>
				btn.setButtonText("Show different").onClick(async () => {
					const today = this.host.getSettings().state.fact.today;
					await this.host.wikipedia.rollFact(
						today?.date ?? todayLocalIso(),
						{ strategy: "next" },
					);
					new Notice("Showing a different event.");
				}),
			);

		new Setting(containerEl)
			.setName("Show today's featured article")
			.setDesc(
				"Pull Wikipedia's featured article of the day (text only - the article's " +
					"image is intentionally not shown). Insert a `featured-article` code block " +
					"to display it. Off by default.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().showFeaturedArticle)
					.onChange(async (value) => {
						this.host.getSettings().showFeaturedArticle = value;
						await this.host.saveSettings();
						if (value) {
							void this.host.wikipedia.getFeaturedArticleToday();
						}
					}),
			);
	}

	/* -------------------- reflection prompts -------------------- */

	private renderPromptSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Reflection prompts").setHeading();

		new Setting(containerEl).setDesc(
			"A short, open question to journal with each day. " +
				"Insert a `prompt-of-the-day` code block to display today's prompt.",
		);

		new Setting(containerEl)
			.setName("Custom prompts")
			.setDesc("One prompt per line. Added to the built-in list (or used alone if you replace it below).")
			.addTextArea((ta) => {
				ta.setPlaceholder("What deserves your attention today?");
				ta.setValue(this.host.getSettings().customPrompts);
				ta.inputEl.rows = 6;
				ta.onChange(async (value) => {
					this.host.getSettings().customPrompts = value;
					await this.host.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Replace built-in prompts")
			.setDesc(
				"When on, only your custom prompts are used. When off, your prompts are added to the built-in pool.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().replaceBuiltInPrompts)
					.onChange(async (value) => {
						this.host.getSettings().replaceBuiltInPrompts = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Skip dismissed prompts")
			.setDesc(
				"When you skip a prompt, never show it again. Turn off to let dismissed prompts come back.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().respectDismissedPrompts)
					.onChange(async (value) => {
						this.host.getSettings().respectDismissedPrompts = value;
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Skipped prompts")
			.setDesc(
				`You've skipped ${this.host.getSettings().state.prompt.dismissed.length} prompt(s).`,
			)
			.addButton((btn) =>
				btn.setButtonText("Clear skipped list").onClick(async () => {
					await this.host.prompts.clearDismissed();
					this.display();
				}),
			);
	}

	/* -------------------- one-line journal -------------------- */

	private renderJournalSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("One-line journal").setHeading();

		new Setting(containerEl).setDesc(
			"A single short line per day, stored locally in Muse's data file. " +
				"Insert a `one-line-journal` code block to write today's entry " +
				"and (optionally) see entries from the same day in past years.",
		);

		const entryCount = Object.keys(
			this.host.getSettings().state.journal.entries,
		).length;
		new Setting(containerEl)
			.setName("Clear all entries")
			.setDesc(
				entryCount === 0
					? "No entries saved yet."
					: `You have ${entryCount} entry${entryCount === 1 ? "" : "s"} saved.`,
			)
			.addButton((btn) =>
				btn
					.setButtonText("Clear entries")
					.setWarning()
					.onClick(async () => {
						await this.host.journal.clearAll();
						new Notice("Journal entries cleared.");
						this.display();
					}),
			);
	}

	/* -------------------- vault on this day (daily-notes config) -------------------- */

	private renderVaultOnThisDaySection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Daily notes").setHeading();

		new Setting(containerEl).setDesc(
			"Used by the `vault-on-this-day` block to find past daily notes whose filename " +
				"matches today's calendar day. Match these to your existing daily-notes plugin settings.",
		);

		new Setting(containerEl)
			.setName("Daily notes folder")
			.setDesc(
				"Vault-relative folder to scan. Leave blank to scan the entire vault.",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("daily-notes")
					.setValue(this.host.getSettings().dailyNotesFolder)
					.onChange(async (value) => {
						this.host.getSettings().dailyNotesFolder = value.trim();
						await this.host.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Daily note filename format")
			.setDesc(
				"Supported tokens: yyyy, yy, mm, m, dd, d. Default: yyyy-mm-dd.",
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("yyyy-mm-dd")
					.setValue(this.host.getSettings().dailyNotesFormat)
					.onChange(async (value) => {
						this.host.getSettings().dailyNotesFormat =
							value.trim() || "YYYY-MM-DD";
						await this.host.saveSettings();
					}),
			);
	}

	/* -------------------- sky (moon + sun) -------------------- */

	private renderSkySection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Sky today").setHeading();

		new Setting(containerEl).setDesc(
			"A pure-local card showing tonight's moon phase and (with a location set) " +
				"today's sunrise, sunset, and day length. Off by default.",
		);

		new Setting(containerEl)
			.setName("Show sky card")
			.setDesc(
				"Enable to make the `sky-today` code block render. Always works offline.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.host.getSettings().showSky)
					.onChange(async (value) => {
						this.host.getSettings().showSky = value;
						await this.host.saveSettings();
					}),
			);

		this.renderSkyLocationControls(containerEl);
	}

	private renderSkyLocationControls(containerEl: HTMLElement): void {
		const settings = this.host.getSettings();

		new Setting(containerEl)
			.setName("Country")
			.setDesc(
				"Used to derive your sunrise / sunset coordinates. " +
					"All data stays local.",
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("", "Select a country…");
				for (const country of COUNTRIES) {
					dropdown.addOption(country.code, country.name);
				}
				dropdown.addOption(CUSTOM_LOCATION_CODE, "Custom coordinates");
				dropdown.setValue(settings.skyCountryCode ?? "");
				dropdown.onChange(async (value) => {
					const next = this.host.getSettings();
					if (!value) {
						next.skyCountryCode = null;
						next.skyRegionCode = null;
						next.skyLatitude = null;
						next.skyLongitude = null;
					} else if (value === CUSTOM_LOCATION_CODE) {
						next.skyCountryCode = CUSTOM_LOCATION_CODE;
						next.skyRegionCode = null;
					} else {
						next.skyCountryCode = value;
						next.skyRegionCode = null;
						const coords = resolveCoords(value, null);
						if (coords) {
							next.skyLatitude = coords.lat;
							next.skyLongitude = coords.lon;
						}
					}
					await this.host.saveSettings();
					this.display();
				});
			});

		const country = findCountry(settings.skyCountryCode);
		if (country?.regions && country.regions.length > 0) {
			new Setting(containerEl)
				.setName("State / region")
				.setDesc(
					`Pick a region in ${country.name} for more accurate sunrise / sunset times. ` +
						"Leave blank to use the country center.",
				)
				.addDropdown((dropdown) => {
					dropdown.addOption("", `${country.name} (country center)`);
					for (const region of country.regions ?? []) {
						dropdown.addOption(region.code, region.name);
					}
					dropdown.setValue(settings.skyRegionCode ?? "");
					dropdown.onChange(async (value) => {
						const next = this.host.getSettings();
						next.skyRegionCode = value || null;
						const coords = resolveCoords(
							next.skyCountryCode,
							next.skyRegionCode,
						);
						if (coords) {
							next.skyLatitude = coords.lat;
							next.skyLongitude = coords.lon;
						}
						await this.host.saveSettings();
					});
				});
		}

		if (settings.skyCountryCode === CUSTOM_LOCATION_CODE) {
			new Setting(containerEl)
				.setName("Latitude")
				.setDesc("Decimal degrees, -90 to 90.")
				.addText((text) =>
					text
						.setPlaceholder("47.6062")
						.setValue(
							settings.skyLatitude === null
								? ""
								: String(settings.skyLatitude),
						)
						.onChange(async (value) => {
							const next = this.host.getSettings();
							const trimmed = value.trim();
							if (!trimmed) {
								next.skyLatitude = null;
							} else {
								const n = Number(trimmed);
								next.skyLatitude =
									Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
							}
							await this.host.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Longitude")
				.setDesc("Decimal degrees, -180 to 180.")
				.addText((text) =>
					text
						.setPlaceholder("-122.3321")
						.setValue(
							settings.skyLongitude === null
								? ""
								: String(settings.skyLongitude),
						)
						.onChange(async (value) => {
							const next = this.host.getSettings();
							const trimmed = value.trim();
							if (!trimmed) {
								next.skyLongitude = null;
							} else {
								const n = Number(trimmed);
								next.skyLongitude =
									Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
							}
							await this.host.saveSettings();
						}),
				);
		}
	}

	/* -------------------- intentions -------------------- */

	private renderIntentionsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Daily intentions").setHeading();

		new Setting(containerEl).setDesc(
			`Up to ${MAX_INTENTIONS} things you want to do every day. ` +
				"They show up as checkboxes in any note that uses a `daily-intentions` block, " +
				"and completion is tracked per day.",
		);

		const items = this.host.intentions.getItems();
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (!item) continue;
			const id = item.id;
			new Setting(containerEl)
				.setName(`Intention ${i + 1}`)
				.addText((text) =>
					text
						.setPlaceholder("Meditate, read, walk…")
						.setValue(item.text)
						.onChange(async (value) => {
							await this.host.intentions.renameItem(id, value);
						}),
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip("Remove intention")
						.onClick(async () => {
							await this.host.intentions.removeItem(id);
							this.display();
						}),
				);
		}

		if (items.length < MAX_INTENTIONS) {
			new Setting(containerEl).addButton((btn) =>
				btn
					.setButtonText("Add intention")
					.setCta()
					.onClick(async () => {
						await this.host.intentions.addItem("");
						this.display();
					}),
			);
		}

		const trackedDays = this.host.intentions.countTrackedDays();
		new Setting(containerEl)
			.setName("Intention history")
			.setDesc(
				trackedDays === 0
					? "No history yet. Check off an intention to start tracking."
					: `Tracking completion for ${trackedDays} day${trackedDays === 1 ? "" : "s"}.`,
			)
			.addButton((btn) =>
				btn
					.setButtonText("Clear history")
					.setWarning()
					.onClick(async () => {
						await this.host.intentions.clearHistory();
						new Notice("Intention history cleared.");
						this.display();
					}),
			);
	}
}
