import type { App, TFile } from "obsidian";
import type { MuseSettings } from "../settings";
import { parseDateFromFilename, type DateParts } from "./format";

/**
 * One past daily note matching today's calendar day.
 */
export interface VaultMemory {
	year: number;
	yearsAgo: number;
	file: TFile;
	preview: string;
}

export interface VaultOnThisDayHost {
	app: App;
	getSettings(): MuseSettings;
}

/**
 * Scan the configured daily-notes folder for entries whose filename
 * decodes to the same calendar month/day as `today`, but in a previous
 * year. Sorted most-recent first.
 */
export async function findVaultMemories(
	host: VaultOnThisDayHost,
	today: Date = new Date(),
	maxPreviewChars = 200,
): Promise<VaultMemory[]> {
	const settings = host.getSettings();
	const format = settings.dailyNotesFormat || "YYYY-MM-DD";
	const folder = settings.dailyNotesFolder.replace(/\/+$/, "");
	const month = today.getMonth() + 1;
	const day = today.getDate();
	const todayYear = today.getFullYear();

	const candidates = collectMarkdownFiles(host.app, folder);
	const matches: { parts: DateParts; file: TFile }[] = [];
	for (const file of candidates) {
		const parts = parseDateFromFilename(file.basename, format);
		if (!parts) continue;
		if (parts.month !== month || parts.day !== day) continue;
		if (parts.year >= todayYear) continue;
		matches.push({ parts, file });
	}

	matches.sort((a, b) => b.parts.year - a.parts.year);

	const out: VaultMemory[] = [];
	for (const { parts, file } of matches) {
		out.push({
			year: parts.year,
			yearsAgo: todayYear - parts.year,
			file,
			preview: await loadPreview(host.app, file, maxPreviewChars),
		});
	}
	return out;
}

function collectMarkdownFiles(app: App, folder: string): TFile[] {
	const all = app.vault.getMarkdownFiles();
	if (!folder) return all;
	const prefix = `${folder}/`;
	return all.filter(
		(f) => f.path === folder || f.path.startsWith(prefix),
	);
}

async function loadPreview(
	app: App,
	file: TFile,
	maxChars: number,
): Promise<string> {
	try {
		const raw = await app.vault.cachedRead(file);
		return firstMeaningfulLine(raw, maxChars);
	} catch {
		return "";
	}
}

/**
 * Pull the first non-empty, non-frontmatter, non-heading line from a
 * note as a short preview. Truncates with an ellipsis at `maxChars`.
 */
function firstMeaningfulLine(raw: string, maxChars: number): string {
	const lines = raw.split(/\r?\n/);
	let inFrontmatter = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		if (i === 0 && line.trim() === "---") {
			inFrontmatter = true;
			continue;
		}
		if (inFrontmatter) {
			if (line.trim() === "---") inFrontmatter = false;
			continue;
		}
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("#")) continue;
		if (trimmed.startsWith("```")) continue;
		const text = stripMarkdown(trimmed);
		if (!text) continue;
		return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
	}
	return "";
}

function stripMarkdown(line: string): string {
	return line
		.replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
		.replace(/^[-*+]\s+/, "")
		.replace(/^>\s?/, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/__([^_]+)__/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/_([^_]+)_/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
		.replace(/\[\[([^\]]+)\]\]/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.trim();
}
