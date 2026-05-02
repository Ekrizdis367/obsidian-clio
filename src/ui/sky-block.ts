import {
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	setTooltip,
} from "obsidian";
import type { MuseSettings } from "../settings";
import { calculateMoonPhase } from "../sky/moon";
import {
	calculateSunTimes,
	formatDayLength,
	formatLocalTime,
} from "../sky/sun";
import type { SunTimes } from "../sky/sun";
import {
	mercuryRetrograde,
	mercurySign,
	moonNakshatra,
	moonSign,
	sunSign,
} from "../sky/zodiac";
import { createCardHeader } from "./card-header";

function formatShortDate(date: Date): string {
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

export interface SkyBlockHost {
	getSettings(): MuseSettings;
}

class SkyBlockChild extends MarkdownRenderChild {
	constructor(
		container: HTMLElement,
		private readonly host: SkyBlockHost,
	) {
		super(container);
	}

	override onload(): void {
		this.render();
	}

	private render(): void {
		this.containerEl.empty();
		const card = this.containerEl.createDiv({
			cls: "muse-fact-card muse-sky-card",
		});

		const settings = this.host.getSettings();
		const now = new Date();
		const lat = settings.skyLatitude;
		const lon = settings.skyLongitude;
		const sun =
			lat !== null && lon !== null
				? calculateSunTimes(now, lat, lon)
				: null;

		createCardHeader(card, "Sky today");

		if (sun && sun.sunrise && sun.sunset) {
			this.renderDaylight(card, sun, now);
		}

		const meta = card.createDiv({ cls: "muse-sky-meta" });
		if (sun) {
			if (sun.midnightSun) {
				meta.createSpan({
					cls: "muse-sky-meta-note",
					text: "Midnight sun today",
				});
			} else if (sun.polarNight) {
				meta.createSpan({
					cls: "muse-sky-meta-note",
					text: "Polar night today",
				});
			} else if (sun.dayLengthMinutes !== null) {
				meta.createSpan({
					cls: "muse-sky-day-length",
					text: `${formatDayLength(sun.dayLengthMinutes)} of daylight`,
				});
			}
		} else {
			meta.createSpan({
				cls: "muse-sky-meta-note",
				text: "Pick your country in the plugin settings for sun times",
			});
		}

		this.renderSymbolic(card, now);
	}

	private renderSymbolic(card: HTMLElement, now: Date): void {
		const sun = sunSign(now);
		const moon = moonSign(now);
		const nakshatra = moonNakshatra(now);
		const mercury = mercurySign(now);
		const rx = mercuryRetrograde(now);
		const phase = calculateMoonPhase(now);
		const illuminationPct = Math.round(phase.illumination * 100);

		const grid = card.createDiv({ cls: "muse-sky-symbolic" });

		this.renderSymbolicColumn(grid, {
			glyph: "☉",
			planet: "Sun",
			sign: sun.sign.name,
			extra: sun.sign.element,
		});

		/*
		 * The Moon column gets the real phase emoji as its glyph so the
		 * waxing/waning state is visible at a glance; the precise phase
		 * name + illumination percentage live in a tooltip on the glyph
		 * so we don't stretch the column.
		 */
		this.renderSymbolicColumn(grid, {
			glyph: phase.emoji,
			glyphClass: "muse-sky-symbolic-glyph--emoji",
			glyphTooltip: `${phase.name} · ${illuminationPct}% illuminated`,
			planet: "Moon",
			sign: moon.sign.name,
			extra: nakshatra.name,
			extraTooltip: `Nakshatra ruler: ${nakshatra.ruler}`,
		});

		let mercuryTooltip: string | undefined;
		if (rx.isRetrograde && rx.endsAt) {
			mercuryTooltip = `Direct again ${formatShortDate(rx.endsAt)}`;
		} else if (rx.nextStartsAt) {
			mercuryTooltip = `Next retrograde ${formatShortDate(rx.nextStartsAt)}`;
		}

		this.renderSymbolicColumn(grid, {
			glyph: "☿",
			planet: "Mercury",
			sign: mercury.sign.name,
			extra: rx.isRetrograde ? "Retrograde" : "Direct",
			extraClass: rx.isRetrograde ? "muse-sky-symbolic-extra--rx" : undefined,
			extraTooltip: mercuryTooltip,
		});
	}

	private renderSymbolicColumn(
		parent: HTMLElement,
		opts: {
			glyph: string;
			glyphClass?: string;
			glyphTooltip?: string;
			planet: string;
			sign: string;
			extra: string;
			extraClass?: string;
			extraTooltip?: string;
		},
	): void {
		const col = parent.createDiv({ cls: "muse-sky-symbolic-col" });

		const planet = col.createDiv({ cls: "muse-sky-symbolic-planet" });
		const glyphCls = opts.glyphClass
			? `muse-sky-symbolic-glyph ${opts.glyphClass}`
			: "muse-sky-symbolic-glyph";
		const glyph = planet.createSpan({ cls: glyphCls, text: opts.glyph });
		if (opts.glyphTooltip) {
			setTooltip(glyph, opts.glyphTooltip);
		}
		planet.createSpan({
			cls: "muse-sky-symbolic-planet-name",
			text: opts.planet,
		});

		col.createDiv({ cls: "muse-sky-symbolic-sign", text: opts.sign });

		const extraClass = opts.extraClass
			? `muse-sky-symbolic-extra ${opts.extraClass}`
			: "muse-sky-symbolic-extra";
		const extra = col.createDiv({ cls: extraClass, text: opts.extra });
		if (opts.extraTooltip) {
			setTooltip(extra, opts.extraTooltip);
		}
	}

	private renderDaylight(card: HTMLElement, sun: SunTimes, now: Date): void {
		if (!sun.sunrise || !sun.sunset) return;

		const day = card.createDiv({ cls: "muse-sky-day" });

		const sunriseEl = day.createDiv({ cls: "muse-sky-day-time" });
		sunriseEl.createSpan({ cls: "muse-sky-day-icon", text: "☀️" });
		sunriseEl.createSpan({
			cls: "muse-sky-day-time-value",
			text: formatLocalTime(sun.sunrise),
		});

		const bar = day.createDiv({ cls: "muse-sky-day-bar" });
		bar.createDiv({ cls: "muse-sky-day-bar-track" });

		const dur = sun.sunset.getTime() - sun.sunrise.getTime();
		let progress = 0;
		if (dur > 0) {
			const elapsed = now.getTime() - sun.sunrise.getTime();
			progress = Math.max(0, Math.min(1, elapsed / dur));
		}
		const marker = bar.createDiv({ cls: "muse-sky-day-bar-marker" });
		marker.setCssProps({
			"--muse-sky-progress": `${(progress * 100).toFixed(1)}%`,
		});
		const beforeSunrise = now.getTime() < sun.sunrise.getTime();
		const afterSunset = now.getTime() > sun.sunset.getTime();
		if (beforeSunrise || afterSunset) {
			marker.addClass("is-night");
		}

		const sunsetEl = day.createDiv({ cls: "muse-sky-day-time" });
		sunsetEl.createSpan({ cls: "muse-sky-day-icon", text: "🌙" });
		sunsetEl.createSpan({
			cls: "muse-sky-day-time-value",
			text: formatLocalTime(sun.sunset),
		});
	}
}

export function registerSkyBlockProcessor(
	register: (
		language: string,
		handler: (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	host: SkyBlockHost,
): void {
	register("sky-today", (_source, el, ctx) => {
		ctx.addChild(new SkyBlockChild(el, host));
	});
}
