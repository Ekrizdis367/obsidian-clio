import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
} from "obsidian";
import {
	findVaultMemories,
	type VaultMemory,
	type VaultOnThisDayHost,
} from "../journal/on-this-day";
import { createCardHeader } from "./card-header";

export interface JournalOnThisDayBlockHost extends VaultOnThisDayHost {
	app: App;
}

class JournalOnThisDayBlockChild extends MarkdownRenderChild {
	constructor(
		container: HTMLElement,
		private readonly host: JournalOnThisDayBlockHost,
	) {
		super(container);
	}

	override onload(): void {
		void this.render();
	}

	private async render(): Promise<void> {
		this.containerEl.empty();
		const card = this.containerEl.createDiv({
			cls: "muse-fact-card muse-vault-otd-card",
		});
		createCardHeader(card, "On this day in your vault");

		try {
			const memories = await findVaultMemories(this.host);
			if (memories.length === 0) {
				const settings = this.host.getSettings();
				const folderHint = settings.dailyNotesFolder
					? ` in “${settings.dailyNotesFolder}”`
					: "";
				card.createDiv({
					cls: "muse-empty",
					text:
						`No daily notes from prior years matched today's date${folderHint}. ` +
						`Check your Daily notes folder/format in Muse settings.`,
				});
				return;
			}
			const list = card.createEl("ul", { cls: "muse-vault-otd-list" });
			for (const m of memories) {
				renderMemoryItem(list, m, this.host);
			}
		} catch (err) {
			console.warn("[muse] vault on-this-day render failed", err);
			card.createDiv({
				cls: "muse-empty",
				text: "Could not scan the vault for past notes.",
			});
		}
	}
}

function renderMemoryItem(
	parent: HTMLElement,
	memory: VaultMemory,
	host: JournalOnThisDayBlockHost,
): void {
	const item = parent.createEl("li", { cls: "muse-vault-otd-item" });
	const head = item.createDiv({ cls: "muse-vault-otd-head" });
	head.createSpan({
		cls: "muse-vault-otd-year",
		text: String(memory.year),
	});
	head.createSpan({
		cls: "muse-vault-otd-ago",
		text: memory.yearsAgo === 1 ? "1 year ago" : `${memory.yearsAgo} years ago`,
	});

	const link = item.createEl("a", {
		cls: "muse-vault-otd-link internal-link",
		text: memory.file.basename,
		href: memory.file.path,
	});
	link.setAttr("data-href", memory.file.path);
	link.addEventListener("click", (evt) => {
		evt.preventDefault();
		void host.app.workspace.openLinkText(memory.file.path, "", false);
	});

	if (memory.preview) {
		item.createEl("p", {
			cls: "muse-vault-otd-preview",
			text: memory.preview,
		});
	}
}

export function registerJournalOnThisDayBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: JournalOnThisDayBlockHost,
): void {
	register("vault-on-this-day", (_source, el, ctx) => {
		ctx.addChild(new JournalOnThisDayBlockChild(el, host));
	});
}
