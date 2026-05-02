import { App, Modal, Notice, Setting, TextAreaComponent } from "obsidian";
import { appendQuoteToInbox } from "../quotes/inbox";
import type { MuseSettings } from "../settings";
import type { QuoteStore } from "../quotes/store";

export interface AddQuoteHost {
	getSettings(): MuseSettings;
	store: QuoteStore;
}

/**
 * Modal that captures a quote (text + attribution + tags) and appends it
 * to the configured inbox file. After saving, kicks off a store refresh
 * so the quote shows up in the library and "today" pickers.
 */
export class AddQuoteModal extends Modal {
	private text = "";
	private author = "";
	private source = "";
	private tagsInput = "";

	constructor(
		app: App,
		private readonly host: AddQuoteHost,
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Add quote" });

		new Setting(contentEl)
			.setName("Quote")
			.setDesc("The text of the quote. Required.")
			.addTextArea((ta: TextAreaComponent) => {
				ta.setPlaceholder("The unexamined life is not worth living.");
				ta.onChange((v) => {
					this.text = v;
				});
				ta.inputEl.rows = 4;
				ta.inputEl.addClass("muse-add-quote-textarea");
			});

		new Setting(contentEl).setName("Author").addText((text) => {
			text.setPlaceholder("Socrates").onChange((v) => {
				this.author = v;
			});
		});

		new Setting(contentEl)
			.setName("Source")
			.setDesc("Optional. Book, speech, talk - anything that helps you find it later.")
			.addText((text) => {
				text.setPlaceholder("Book or speech title").onChange((v) => {
					this.source = v;
				});
			});

		new Setting(contentEl)
			.setName("Tags")
			.setDesc("Comma-separated. The leading # is optional.")
			.addText((text) => {
				text.setPlaceholder("Philosophy, ethics").onChange((v) => {
					this.tagsInput = v;
				});
			});

		new Setting(contentEl)
			.setDesc(
				`Saved as a \`muse-quote\` code block at the end of ${this.host.getSettings().quotesInboxPath}.`,
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						void this.submit();
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		const text = this.text.trim();
		if (!text) {
			new Notice("Quote text is required.");
			return;
		}
		const tags = this.tagsInput
			.split(",")
			.map((t) => t.trim().replace(/^#/, ""))
			.filter(Boolean);
		try {
			await appendQuoteToInbox(
				this.app,
				this.host.getSettings().quotesInboxPath,
				{
					text,
					author: this.author.trim(),
					source: this.source.trim(),
					tags,
				},
			);
			new Notice("Quote saved.");
			this.close();
			await this.host.store.refresh();
		} catch (err) {
			console.warn("[muse] add quote failed", err);
			new Notice("Could not save quote. See console for details.");
		}
	}
}
