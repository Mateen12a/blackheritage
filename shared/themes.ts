import type { CSSProperties } from "react";

/**
 * Event TEMPLATES (formerly "themes").
 *
 * A template is not a color swap. Each one owns three things:
 *   1. palette: CSS-variable tokens, used as-is when the organizer has not
 *                 picked a brand color (falls back to the Black Heritage gold)
 *   2. layout: the page structure the event page renders:
 *                   poster    = flyer hero on top, editorial column under it
 *                   billboard = full-bleed poster with the ticket card docked
 *                               on the flyer itself, details unfold below
 *                   editorial = calm paper look: content column first, flyer
 *                               framed mid-page, serif-led
 *   3. motion: the entrance animation applied to the page's sections
 *                 (rise = staggered slide-up, bloom = soft scale-fade,
 *                  slide = lateral reveal)
 *
 * COLOR IS NOT THE TEMPLATE. The organizer's brand accent recolors buttons,
 * links and highlights inside any template; if they never picked one, the
 * template's own accent (ultimately the Black Heritage gold) shows. Keys
 * mirror the Event.theme enum in shared/schema.ts, so existing rows keep
 * working and no migration is needed.
 */

export type ThemeVars = Record<string, string> & CSSProperties;

export type TemplateLayout = "poster" | "billboard" | "editorial";
export type TemplateMotion = "rise" | "bloom" | "slide";

export interface TemplatePreset {
  key: "midnight-gold" | "ivory-editorial" | "sunset-poster";
  name: string;
  tagline: string;
  /** What actually differs: the structure the page renders. */
  layout: TemplateLayout;
  /** How sections animate in. */
  motion: TemplateMotion;
  vars: ThemeVars;
}

export const templatePresets: Record<string, TemplatePreset> = {
  "midnight-gold": {
    key: "midnight-gold",
    name: "Midnight Gold",
    tagline: "Poster hero up top, editorial story below. The platform look.",
    layout: "poster",
    motion: "rise",
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
    tagline: "Story first, framed flyer mid-page. Gallery calm for daytime.",
    layout: "editorial",
    motion: "bloom",
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
  "sunset-poster": {
    key: "sunset-poster",
    name: "Sunset Poster",
    tagline: "Full-bleed billboard with the ticket card on the art. Loud.",
    layout: "billboard",
    motion: "slide",
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

// Back-compat: the old export name is still referenced by existing imports.
export const themePresets = templatePresets;

export type TemplateKey = TemplatePreset["key"];

export function getTemplate(key: string | null | undefined): TemplatePreset | null {
  return (key && templatePresets[key]) || null;
}

// Back-compat alias for getPreset.
export const getPreset = getTemplate;

export function templatePresetList(): TemplatePreset[] {
  return Object.values(templatePresets);
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

/** Platform fallback accent: the Black Heritage gold, used when the
 *  organizer has not picked a brand color. */
export const PLATFORM_ACCENT = "#E3B23C";

/**
 * Brand accent override, derived from the chosen template so the custom
 * color stays legible everywhere. The ACCENT is always the organizer's
 * brand color when set: the template changes structure and motion, never
 * whose color the buttons are. Three layers:
 *  1. interactive accent = their color (or the template's own when unset,
 *     which itself falls back to Black Heritage gold), with a hover step
 *  2. text/icon legibility: text sitting on the accent flips light/dark
 *     based on contrast ratio, per template background
 *  3. the faded inline tint used by soft badges (accent at ~8% alpha)
 */
export function accentOverrides(themeKey: string | null | undefined, accentHex: string | null | undefined): Record<string, string> {
  const preset = getTemplate(themeKey ?? undefined) || templatePresets["midnight-gold"];
  const effective = isHex(accentHex) ? (accentHex as string) : (preset.vars["--color-gold"] as string) || PLATFORM_ACCENT;
  const accentHexSafe = effective;
  const onLight = preset.key === "ivory-editorial";
  const lum = luminance(accentHexSafe);
  const contrastWithInk = (lum + 0.05) / (luminance(onLight ? "#221A12" : "#F7F5EF") + 0.05);
  const textOnAccent = contrastWithInk >= 3 ? (onLight ? "#221A12" : "#F7F5EF") : onLight ? "#FBF8F2" : "#12100B";
  const mix = (hex: string, white: number, black = 0): string => {
    const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
    const c = [channel(hex, 0), channel(hex, 1), channel(hex, 2)].map((v) => v * (1 - white - black) + white + black);
    return "#" + c.map(to255).join("").toUpperCase();
  };
  return {
    ["--color-gold"]: accentHexSafe.toUpperCase(),
    ["--color-gold-soft"]: mix(accentHexSafe, 0.12),
    ["--color-primary"]: accentHexSafe.toUpperCase(),
    ["--color-primary-foreground"]: textOnAccent,
    ["--color-accent"]: accentHexSafe.toUpperCase(),
    ["--color-accent-foreground"]: textOnAccent,
    ["--color-ring"]: accentHexSafe.toUpperCase(),
    // Soft badge tint used inline on the event page (gold/[0.06] etc.)
    ["--accent-tint"]: accentHexSafe.toUpperCase() + "14",
  };
}

/** Layout + motion for an event's chosen template, with safe defaults. */
export function templateFor(themeKey: string | null | undefined): { layout: TemplateLayout; motion: TemplateMotion } {
  const t = getTemplate(themeKey);
  return { layout: t?.layout ?? "poster", motion: t?.motion ?? "rise" };
}

/** Entrance animation presets per template motion. Sections spread the
 *  delay by index for the stagger. */
export function sectionMotion(motion: TemplateMotion, index: number) {
  switch (motion) {
    case "bloom":
      return {
        initial: { opacity: 0, scale: 0.97 },
        whileInView: { opacity: 1, scale: 1 },
        viewport: { once: true, margin: "-40px" },
        transition: { duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] as const },
      };
    case "slide":
      return {
        initial: { opacity: 0, x: -28 },
        whileInView: { opacity: 1, x: 0 },
        viewport: { once: true, margin: "-40px" },
        transition: { duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] as const },
      };
    case "rise":
    default:
      return {
        initial: { opacity: 0, y: 26 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-40px" },
        transition: { duration: 0.55, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] as const },
      };
  }
}
