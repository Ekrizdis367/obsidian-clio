import { setIcon, setTooltip } from "obsidian";

/**
 * Shared header used by every Muse card (live and static).
 *
 * Renders a centered, all-caps title and an absolutely-positioned
 * actions slot in the top-right corner. Every block uses this so the
 * cards visibly belong to the same plugin instead of each looking
 * homemade.
 *
 * @param card  the card root (`.muse-quote-card`, `.muse-fact-card`, …)
 * @param title sentence-cased label - rendered uppercase via CSS
 * @returns the actions container - append icon buttons here. The
 *          container is empty by default and stays out of layout flow.
 */
export function createCardHeader(
	card: HTMLElement,
	title: string,
): { header: HTMLElement; actions: HTMLElement } {
	const header = card.createDiv({ cls: "muse-card-header" });
	header.createSpan({ cls: "muse-card-title", text: title });
	const actions = header.createDiv({ cls: "muse-card-actions" });
	return { header, actions };
}

/**
 * Append a `<button>` icon to a card actions slot.
 */
export function appendCardIconButton(
	parent: HTMLElement,
	icon: string,
	tooltip: string,
	onClick: () => void,
): HTMLButtonElement {
	const btn = parent.createEl("button", {
		cls: "muse-icon-button",
		attr: { type: "button", "aria-label": tooltip },
	});
	setIcon(btn, icon);
	setTooltip(btn, tooltip);
	btn.addEventListener("click", onClick);
	return btn;
}

/**
 * Append an external-link `<a>` icon to a card actions slot.
 */
export function appendCardLinkIcon(
	parent: HTMLElement,
	href: string,
	tooltip: string,
): HTMLAnchorElement {
	const link = parent.createEl("a", {
		cls: "muse-icon-button",
		href,
	});
	setIcon(link, "external-link");
	setTooltip(link, tooltip);
	link.setAttr("aria-label", tooltip);
	link.setAttr("target", "_blank");
	link.setAttr("rel", "noopener");
	return link;
}
