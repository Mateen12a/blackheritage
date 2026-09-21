import type { CSSProperties } from "react";

/**
 * Event theme presets: curated token sets the organizer picks from.
 * Each preset is a full palette in CSS-variable form, applied to the event
 * page wrapper as inline style so nothing global is ever mutated.
 *
 * Archetypes follow the high-end-visual-design direction:
 *  - midnight-gold    Ethereal Deep Tone: the platform look, indigo-black + gold
 *  - ivory-editorial  Editorial Luxury: warm ivory paper, espresso ink, serif calm
 *  - sunset-poster    Bold poster night: ember orange accent on near-black plum
 *
 * Keys mirror the Event.theme enum in shared/schema.ts.
 */

export type ThemeVars = Record<string, string> & CSSProperties;

export interface ThemePreset {
  key: "midnight-gold" | "ivory-editorial" | "sunset-poster";
  name: string;
  tagline: string;
  vars: ThemeVars;
}

export const themePresets: Record<string, ThemePreset> = {
  "midnight-gold": {
    key: "midnight-gold",
    name: "Midnight Gold",
    tagline: "The platform look. Indigo-black, warm gold, hairlines.",
    vars: {
      ["--color-background" as any]: "#0F0F14",
      ["--color-surface" as any]: "#19191F",
      ["--color-surface-2" as any]: "#1F1F26",
      ["--color-ink" as any]: "#F7F5EF",
      ["--color-muted-ink" as any]: "#9EA0AD",
      ["--color-gold" as any]: "#E3B23C",
      ["--color-gold-soft" as any]: "#F2CE72",
      ["--color-hairline" as any]: "#31313A",
      ["--color-primary" as any]: "#E3B23C",
      ["--color-primary-foreground" as any]: "#12100B",
      background: "#0F0F14",
      color: "#F7F5EF",
    },
  },
  "ivory-editorial": {
    key: "ivory-editorial",
    name: "Ivory Editorial",
    tagline: "Warm paper, espresso ink. Gallery calm for daytime events.",
    vars: {
      ["--color-background" as any]: "#F4EFE6",
      ["--color-surface" as any]: "#FBF8F2",
      ["--color-surface-2" as any]: "#ECE5D8",
      ["--color-ink" as any]: "#221A12",
      ["--color-muted-ink" as any]: "#6E6353",
      ["--color-gold" as any]: "#9A6B1F",
      ["--color-gold-soft" as any]: "#7C5517",
      ["--color-hairline" as any]: "#DCD2BF",
      ["--color-primary" as any]: "#9A6B1F",
      ["--color-primary-foreground" as any]: "#FBF8F2",
      background: "#F4EFE6",
      color: "#221A12",
    },
  },
  "sunset-poster": {
    key: "sunset-poster",
    name: "Sunset Poster",
    tagline: "Ember orange on deep plum. Loud, for the big night.",
    vars: {
      ["--color-background" as any]: "#150D14",
      ["--color-surface" as any]: "#20121F",
      ["--color-surface-2" as any]: "#281627",
      ["--color-ink" as any]: "#FBF3EC",
      ["--color-muted-ink" as any]: "#B39A9E",
      ["--color-gold" as any]: "#FF6B35",
      ["--color-gold-soft" as any]: "#FF8C5F",
      ["--color-hairline" as any]: "#3A2138",
      ["--color-primary" as any]: "#FF6B35",
      ["--color-primary-foreground" as any]: "#1C0B0A",
      background: "#150D14",
      color: "#FBF3EC",
    },
  },
};

export function getPreset(key: string | null | undefined): ThemePreset | null {
  return (key && themePresets[key]) || null;
}

function isHex(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
}

/** Relative luminance (WCAG). 0 = black, 1 = white. */
function luminance(hex: string): number {
  const lin = [channel(hex, 0), channel(hex, 1), channel(hex, 2)].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Organizer accent override, derived from the chosen theme so the custom
 * color stays legible everywhere. Three layers:
 *  1. interactive accent = their color, with a hover step at +10% lightness
 *     (a saturated color reads darker than its hex suggests, so hover goes
 *     lighter rather than darker)
 *  2. text/icon legibility: text sitting on the accent flips to light or
 *     dark based on contrast ratio against their color, per theme background
 *  3. the faded inline tint used by soft badges (accent at 6-8% alpha)
 *
 * Returns vars to spread AFTER the theme preset vars. No color = no vars.
 */
export function accentOverrides(themeKey: string | null | undefined, accentHex: string | null | undefined): Record<string, string> {
  if (!isHex(accentHex)) return {};
  const preset = getPreset(themeKey ?? undefined) || themePresets["midnight-gold"];
  const onLight = preset.key === "ivory-editorial";
  const lum = luminance(accentHex);
  const contrastWithInk = (lum + 0.05) / (luminance(onLight ? "#221A12" : "#F7F5EF") + 0.05);
  const textOnAccent = contrastWithInk >= 3 ? (onLight ? "#221A12" : "#F7F5EF") : onLight ? "#FBF8F2" : "#12100B";
  const mix = (hex: string, white: number, black = 0): string => {
    const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
    const c = [channel(hex, 0), channel(hex, 1), channel(hex, 2)].map((v) => v * (1 - white - black) + white + black);
    return "#" + c.map(to255).join("").toUpperCase();
  };
  return {
    ["--color-gold"]: accentHex.toUpperCase(),
    ["--color-gold-soft"]: mix(accentHex, 0.12),
    ["--color-primary"]: accentHex.toUpperCase(),
    ["--color-primary-foreground"]: textOnAccent,
    ["--color-accent"]: accentHex.toUpperCase(),
    ["--color-accent-foreground"]: textOnAccent,
    ["--color-ring"]: accentHex.toUpperCase(),
    // Soft badge tint used inline on the event page (gold/[0.06] etc.)
    ["--accent-tint"]: accentHex.toUpperCase() + "14",
  };
}
