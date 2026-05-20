import { App, Modal, Notice } from "obsidian";
import {
	convertCandidate,
	markCandidateIgnored,
	previewClioQuoteBlock,
	type ConvertOverrides,
	type QuoteCandidate,
} from "../quotes/migration";

export interface MigrateQuotesHost {
	candidates: QuoteCandidate[];
	/** Refresh the quote store after the migration touches any files. */
	refreshStore: () => Promise<void>;
}

interface EditState {
	text: string;
	author: string;
	source: string;
	tags: string;
}

/**
 * Step the user through every migration candidate one at a time.
 *
 * Shows the original blockquote, exposes editable author/source/tag
 * fields (since auto-detection misses inline-attributed quotes), and
 * keeps a live preview of what will land on disk.
 */
export class MigrateQuotesModal extends Modal {
	private cursor = 0;
	private converted = 0;
	private skipped = 0;
	private ignored = 0;
	private failed = 0;
	private skippedFiles = new Set<string>();
	private touchedFiles = new Set<string>();
	private busy = false;
	private edit: EditState = blankEdit();
	private previewEl: HTMLElement | null = null;

	constructor(
		app: App,
		private readonly host: MigrateQuotesHost,
	) {
		super(app);
	}

	override onOpen(): void {
		this.modalEl.addClass("clio-migrate-modal");
		this.skipDormantCandidates();
		this.loadEditFromCurrent();
		this.render();
	}

	override onClose(): void {
		this.contentEl.empty();
		if (this.touchedFiles.size > 0) {
			void this.host.refreshStore();
		}
	}

	private get current(): QuoteCandidate | null {
		return this.host.candidates[this.cursor] ?? null;
	}

	private get total(): number {
		return this.host.candidates.length;
	}

	private positionLabel(): string {
		const handled =
			this.converted + this.skipped + this.ignored + this.failed;
		return `${handled + 1} of ${this.total}`;
	}

	private skipDormantCandidates(): void {
		while (this.cursor < this.total) {
			const c = this.host.candidates[this.cursor];
			if (!c) break;
			if (!this.skippedFiles.has(c.file.path)) break;
			this.skipped++;
			this.cursor++;
		}
	}

	private loadEditFromCurrent(): void {
		const c = this.current;
		if (!c) {
			this.edit = blankEdit();
			return;
		}
		this.edit = {
			text: c.text,
			author: c.author,
			source: c.source,
			tags: c.tags.join(", "),
		};
	}

	private advance(): void {
		this.cursor++;
		this.skipDormantCandidates();
		this.loadEditFromCurrent();
		this.render();
	}

	private currentOverrides(): ConvertOverrides {
		return {
			text: this.edit.text.trim(),
			author: this.edit.author.trim(),
			source: this.edit.source.trim(),
			tags: this.edit.tags
				.split(",")
				.map((t) => t.trim().replace(/^#/, ""))
				.filter(Boolean),
		};
	}

	private updatePreview(): void {
		const c = this.current;
		if (!c || !this.previewEl) return;
		this.previewEl.setText(previewClioQuoteBlock(c, this.currentOverrides()));
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.previewEl = null;

		if (this.cursor >= this.total) {
			this.renderSummary(contentEl);
			return;
		}

		const c = this.current;
		if (!c) return;

		contentEl.createEl("h2", {
			text: `Convert quote ${this.positionLabel()}`,
		});

		const meta = contentEl.createDiv({ cls: "clio-migrate-meta" });
		meta.createSpan({
			cls: "clio-migrate-file",
			text: `${c.file.path} \u00b7 line ${c.startLine + 1}`,
		});
		if (c.kind === "clio-quote") {
			meta.createSpan({
				cls: "clio-migrate-badge",
				text: "clio-quote",
			});
		} else if (c.isCallout) {
			meta.createSpan({
				cls: "clio-migrate-badge",
				text: "callout",
			});
		}

		contentEl.createEl("h4", {
			cls: "clio-migrate-section-label",
			text: "Currently",
		});
		contentEl
			.createEl("pre", { cls: "clio-migrate-preview" })
			.createEl("code", { text: c.rawLines.join("\n") });

		this.renderEditFields(contentEl);

		contentEl.createEl("h4", {
			cls: "clio-migrate-section-label",
			text: "Will become",
		});
		const previewWrap = contentEl.createEl("pre", {
			cls: "clio-migrate-preview",
		});
		this.previewEl = previewWrap.createEl("code");
		this.updatePreview();

		const buttons = contentEl.createDiv({ cls: "clio-migrate-buttons" });

		const stopBtn = buttons.createEl("button", { text: "Stop" });
		stopBtn.addEventListener("click", () => this.close());

		const skipFileBtn = buttons.createEl("button", {
			text: "Skip remaining in file",
		});
		skipFileBtn.addEventListener("click", () => {
			this.skippedFiles.add(c.file.path);
			this.skipped++;
			this.advance();
		});

		const skipBtn = buttons.createEl("button", { text: "Skip" });
		skipBtn.addEventListener("click", () => {
			this.skipped++;
			this.advance();
		});

		const ignoreLabel =
			c.kind === "clio-quote"
				? "Keep as is"
				: "Mark as not a quote";
		const ignoreTitle =
			c.kind === "clio-quote"
				? "Insert a comment line so this block won't be flagged again"
				: "Append an invisible marker so this blockquote is permanently ignored";
		const ignoreBtn = buttons.createEl("button", {
			text: ignoreLabel,
			attr: { title: ignoreTitle },
		});
		ignoreBtn.addClass("clio-migrate-danger");
		ignoreBtn.addEventListener("click", () => {
			void this.handleMarkIgnored();
		});

		const convertBtn = buttons.createEl("button", { text: "Convert" });
		convertBtn.addClass("mod-cta");
		convertBtn.addEventListener("click", () => {
			void this.handleConvert();
		});
	}

	private renderEditFields(container: HTMLElement): void {
		const fields = container.createDiv({ cls: "clio-migrate-fields" });

		const textRow = fields.createDiv({ cls: "clio-migrate-field" });
		textRow.createEl("label", { text: "Quote" });
		const textArea = textRow.createEl("textarea", {
			cls: "clio-migrate-input clio-migrate-textarea",
		});
		textArea.value = this.edit.text;
		textArea.addEventListener("input", () => {
			this.edit.text = textArea.value;
			this.updatePreview();
		});

		const authorRow = fields.createDiv({ cls: "clio-migrate-field" });
		authorRow.createEl("label", { text: "Author" });
		const authorInput = authorRow.createEl("input", {
			type: "text",
			cls: "clio-migrate-input",
			placeholder: "e.g. Seneca",
		});
		authorInput.value = this.edit.author;
		authorInput.addEventListener("input", () => {
			this.edit.author = authorInput.value;
			this.updatePreview();
		});

		const sourceRow = fields.createDiv({ cls: "clio-migrate-field" });
		sourceRow.createEl("label", { text: "Source" });
		const sourceInput = sourceRow.createEl("input", {
			type: "text",
			cls: "clio-migrate-input",
			placeholder: "Optional book / talk / URL",
		});
		sourceInput.value = this.edit.source;
		sourceInput.addEventListener("input", () => {
			this.edit.source = sourceInput.value;
			this.updatePreview();
		});

		const tagsRow = fields.createDiv({ cls: "clio-migrate-field" });
		tagsRow.createEl("label", { text: "Tags" });
		const tagsInput = tagsRow.createEl("input", {
			type: "text",
			cls: "clio-migrate-input",
			placeholder: "comma, separated",
		});
		tagsInput.value = this.edit.tags;
		tagsInput.addEventListener("input", () => {
			this.edit.tags = tagsInput.value;
			this.updatePreview();
		});
	}

	private async handleConvert(): Promise<void> {
		if (this.busy) return;
		const c = this.current;
		if (!c) return;
		const overrides = this.currentOverrides();
		if (!overrides.text) {
			new Notice("Quote text can't be empty.");
			return;
		}
		this.busy = true;
		try {
			const result = await convertCandidate(this.app, c, overrides);
			if (result.ok) {
				this.converted++;
				this.touchedFiles.add(c.file.path);
			} else {
				this.failed++;
				new Notice(
					result.reason === "file-changed"
						? `Couldn't convert: ${c.file.path} has changed since the scan.`
						: `Couldn't convert: ${c.file.path} is no longer in the vault.`,
				);
			}
		} finally {
			this.busy = false;
			this.advance();
		}
	}

	private async handleMarkIgnored(): Promise<void> {
		if (this.busy) return;
		const c = this.current;
		if (!c) return;
		this.busy = true;
		try {
			const result = await markCandidateIgnored(this.app, c);
			if (result.ok) {
				this.ignored++;
				this.touchedFiles.add(c.file.path);
			} else {
				this.failed++;
				new Notice(
					result.reason === "file-changed"
						? `Couldn't mark: ${c.file.path} has changed since the scan.`
						: `Couldn't mark: ${c.file.path} is no longer in the vault.`,
				);
			}
		} finally {
			this.busy = false;
			this.advance();
		}
	}

	private renderSummary(container: HTMLElement): void {
		container.createEl("h2", { text: "Quote conversion complete" });

		const summary = container.createEl("ul", {
			cls: "clio-migrate-summary",
		});
		summary.createEl("li", { text: `Converted: ${this.converted}` });
		summary.createEl("li", { text: `Skipped: ${this.skipped}` });
		if (this.ignored > 0) {
			summary.createEl("li", {
				text: `Left alone permanently: ${this.ignored}`,
			});
		}
		if (this.failed > 0) {
			summary.createEl("li", {
				text: `Failed (file changed mid-flight): ${this.failed}`,
			});
		}

		const buttons = container.createDiv({ cls: "clio-migrate-buttons" });
		const closeBtn = buttons.createEl("button", { text: "Close" });
		closeBtn.addClass("mod-cta");
		closeBtn.addEventListener("click", () => this.close());
	}
}

function blankEdit(): EditState {
	return { text: "", author: "", source: "", tags: "" };
}
