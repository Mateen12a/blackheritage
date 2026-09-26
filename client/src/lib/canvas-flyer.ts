import { drawQRCode } from "./qr";
import { getPreset } from "@shared/themes";

export type FlyerFormat = "story" | "square"; // 9:16 (1080x1920) or 1:1 (1080x1080)
export type FlyerTheme = "midnight" | "stage" | "editorial" | "vibrant" | "brand"; // "brand" = derive from the event/organizer palette
// Preset layouts. "standard" is the original event flyer; the rest serve
// organizers announcing early, private gatherings, and vendor marketing.
export type FlyerPresetType = "standard" | "teaser" | "private_pass" | "vendor_card";

export interface FlyerOptions {
  format: FlyerFormat;
  theme: FlyerTheme;
  title: string;
  date: string | Date;
  location: string;
  price?: string | null;
  organizerName?: string;
  organizerLogo?: string | null;
  imageUrl?: string | null;
  customImageDataUrl?: string | null;
  qrUrl?: string | null;
  showQr?: boolean;
  showPrice?: boolean;
  showLocation?: boolean;
  isAttendeePass?: boolean;
  attendeeName?: string;
  ticketTier?: string;
  accentColor?: string;
}

// Extra fields the Creative Studio presets use. Everything is optional so the
// standard flyer call sites keep working untouched.
export interface CreativeStudioOptions extends FlyerOptions {
  presetType?: FlyerPresetType;
  // Teaser: the mystery line under the title and the hype badge.
  teaserLine?: string; // "Venue drops Friday"
  teaserBadge?: string; // "SECRET LOCATION • LAGOS"
  // Private pass: controls over the access code block.
  accessCode?: string; // the event's real code; printed masked by default
  showAccessCode?: boolean; // false masks the code; default masked
  dressCode?: string; // "All Black"
  hostLine?: string; // "Hosted by Amara"
  // Vendor card extras.
  vendorCategory?: string;
  vendorRating?: string; // "4.8" or "5"
  vendorArea?: string;
  vendorSlug?: string | null;
  vendorWhatsapp?: string | null;
  // Brand colors from the event/organizer profile. When absent, callers can
  // let renderFlyerToCanvas derive them via brandThemeFromEvent.
  brandTheme?: FlyerBrandTheme | null;
  // Internal: the caller preloads the photo before layout math runs.
  __loadedImage?: HTMLImageElement | null;
}

const THEME_STYLES: Record<string, {
  bgBase: string;
  bgGradientTop: string;
  bgGradientBottom: string;
  accent: string;
  accentGlow: string;
  textPrimary: string;
  textMuted: string;
  badgeBg: string;
  badgeBorder: string;
  frameColor: string;
}> = {
  midnight: {
    bgBase: "#08080C",
    bgGradientTop: "rgba(10, 10, 15, 0.4)",
    bgGradientBottom: "#09090E",
    accent: "#E3B23C",
    accentGlow: "rgba(227, 178, 60, 0.25)",
    textPrimary: "#FFFFFF",
    textMuted: "#A3A3B2",
    badgeBg: "rgba(227, 178, 60, 0.12)",
    badgeBorder: "rgba(227, 178, 60, 0.4)",
    frameColor: "rgba(227, 178, 60, 0.25)",
  },
  stage: {
    bgBase: "#0C091A",
    bgGradientTop: "rgba(36, 18, 66, 0.45)",
    bgGradientBottom: "#0B0716",
    accent: "#F39C12",
    accentGlow: "rgba(243, 156, 18, 0.3)",
    textPrimary: "#FFFFFF",
    textMuted: "#C2B9D6",
    badgeBg: "rgba(243, 156, 18, 0.15)",
    badgeBorder: "rgba(243, 156, 18, 0.45)",
    frameColor: "rgba(155, 89, 182, 0.3)",
  },
  vibrant: {
    bgBase: "#0C091A",
    bgGradientTop: "rgba(36, 18, 66, 0.45)",
    bgGradientBottom: "#0B0716",
    accent: "#F39C12",
    accentGlow: "rgba(243, 156, 18, 0.3)",
    textPrimary: "#FFFFFF",
    textMuted: "#C2B9D6",
    badgeBg: "rgba(243, 156, 18, 0.15)",
    badgeBorder: "rgba(243, 156, 18, 0.45)",
    frameColor: "rgba(155, 89, 182, 0.3)",
  },
  editorial: {
    bgBase: "#121215",
    bgGradientTop: "rgba(18, 18, 22, 0.35)",
    bgGradientBottom: "#101014",
    accent: "#E3B23C",
    accentGlow: "rgba(227, 178, 60, 0.15)",
    textPrimary: "#F4F4F6",
    textMuted: "#8E8E9E",
    badgeBg: "rgba(255, 255, 255, 0.08)",
    badgeBorder: "rgba(255, 255, 255, 0.2)",
    frameColor: "rgba(255, 255, 255, 0.15)",
  },
};

/**
 * Safely loads an image into an HTMLImageElement.
 * Uses anonymous CORS for cross-origin URLs with graceful fallback.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    // Data URLs do not need crossOrigin; external URLs do
    if (!src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If external image fails due to CORS, return null so canvas doesn't break
      resolve(null);
    };
    img.src = src;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand theming: the event's palette (theme preset + organizer accent) flows
// into the flyer so a branded page and its flyer feel like the same brand.
// Everything is optional — with no brand data the built-in themes are used.
// ─────────────────────────────────────────────────────────────────────────────
export interface FlyerBrandTheme {
  accent?: string; // hex, e.g. "#E3B23C"
  background?: string; // hex base color of the event theme
  text?: string; // hex primary text color
  muted?: string; // hex muted text color
}

function parseHexColor(hex: string | null | undefined): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return null;
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function relLuminance(rgb: [number, number, number]): number {
  const lin = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function mixColors(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

const FLYER_THEME_KEYS = ["midnight", "stage", "editorial", "vibrant"] as const;

/**
 * Blend the event's brand colors into a flyer theme. The built-in themes
 * stay untouched when no brand data is present, so existing call sites
 * render exactly as before. A custom background picks the built-in style
 * with the closest base luminance (so scrims and shadows keep working) and
 * recolors its tokens; the accent keeps its hue but is lifted toward the
 * text color when it would sit muddy against the background.
 */
export function resolveFlyerTheme(
  themeKey: string | null | undefined,
  brand?: FlyerBrandTheme | null
): { style: typeof THEME_STYLES[string]; accent: string; themeKey: string } {
  let baseKey: string = themeKey && THEME_STYLES[themeKey] ? themeKey : "midnight";
  const style = { ...THEME_STYLES[baseKey] };
  if (!brand || typeof brand !== "object") return { style, accent: style.accent, themeKey: baseKey };

  const bgRgb = parseHexColor(brand.background);
  if (bgRgb) {
    // Closest built-in base keeps the gradient/scrim behavior predictable.
    const bgLum = relLuminance(bgRgb);
    baseKey = FLYER_THEME_KEYS.reduce((best, k) => {
      const d = Math.abs(relLuminance(parseHexColor(THEME_STYLES[k].bgBase) || [0, 0, 0]) - bgLum);
      const bestD = Math.abs(relLuminance(parseHexColor(THEME_STYLES[best].bgBase) || [0, 0, 0]) - bgLum);
      return d < bestD ? k : best;
    }, baseKey);
    Object.assign(style, THEME_STYLES[baseKey]);
    style.bgBase = rgbToHex(bgRgb);
    style.bgGradientBottom = style.bgBase;
    const onLight = contrastRatio(bgRgb, [10, 10, 14]) > contrastRatio(bgRgb, [255, 255, 255]);
    const textRgb: [number, number, number] = brand.text && parseHexColor(brand.text)
      ? parseHexColor(brand.text)!
      : onLight ? [26, 24, 20] : [250, 250, 252];
    style.textPrimary = rgbToHex(textRgb);
    style.textMuted = brand.muted && parseHexColor(brand.muted)
      ? rgbToHex(parseHexColor(brand.muted)!)
      : rgbToHex(mixColors(textRgb, bgRgb, 0.45));
  }

  let accent = style.accent;
  const accentRgb = parseHexColor(brand.accent);
  if (accentRgb) {
    const bgForContrast = parseHexColor(style.bgBase) || [10, 10, 14];
    if (contrastRatio(accentRgb, bgForContrast) < 2.2) {
      // Too close to the background to read as an accent; lift toward the
      // primary text color, keeping the brand hue.
      const textRgb = parseHexColor(style.textPrimary) || [250, 250, 252];
      accent = rgbToHex(mixColors(accentRgb, textRgb, 0.45));
    } else {
      accent = rgbToHex(accentRgb);
    }
    style.accent = accent;
    style.accentGlow = hexToRgba(accent, baseKey === "editorial" ? 0.15 : 0.25);
    style.badgeBg = hexToRgba(accent, baseKey === "editorial" ? 0.1 : 0.13);
    style.badgeBorder = hexToRgba(accent, 0.45);
    style.frameColor = hexToRgba(accent, baseKey === "editorial" ? 0.22 : 0.3);
  }
  return { style, accent, themeKey: baseKey };
}

/**
 * Build a FlyerBrandTheme from an event (or event-like object) using the
 * same theme preset + branding accent the event page itself renders with.
 * Returns undefined when the event carries no brand info at all.
 */
export function brandThemeFromEvent(event: any): FlyerBrandTheme | undefined {
  if (!event || typeof event !== "object") return undefined;
  const accentHex = event.branding?.accentHex;
  let background: string | undefined;
  let text: string | undefined;
  let muted: string | undefined;
  try {
    // Lazy import avoided: shared/themes has no side effects.
    // (Imported at module scope at the bottom of this file.)
    const preset = flyerPresetVars(event.theme);
    background = preset?.background;
    text = preset?.ink;
    muted = preset?.mutedInk;
  } catch {
    // theme presets unavailable; accent-only branding still applies
  }
  const hasAny = Boolean(
    (typeof accentHex === "string" && accentHex) || background || text || muted
  );
  if (!hasAny) return undefined;
  return {
    accent: typeof accentHex === "string" && accentHex ? accentHex : undefined,
    background,
    text,
    muted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Text fitting: measure first, then draw. Long titles shrink before they
// wrap deeper, and wrapping never collides with neighbouring layers — the
// same discipline the server-side PDF renderer follows.
// ─────────────────────────────────────────────────────────────────────────────

/** Truncate text with an ellipsis so it never exceeds maxWidth at the current font. */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const t = (text || "").trim();
  if (!t || ctx.measureText(t).width <= maxWidth) return t;
  let out = t;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.trimEnd() + "…";
}

/** Word-wrap into at most maxLines lines. Reports whether content was cut. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): { lines: string[]; truncated: boolean } {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) {
        i++;
        break;
      }
    } else {
      line = test;
    }
  }
  let truncated = false;
  if (lines.length === maxLines) {
    // `line` holds the first word that did not fit; anything from it on is cut.
    truncated = Boolean(line.trim()) || i < words.length;
  } else if (line.trim()) {
    lines.push(line.trim());
  }
  return { lines: lines.map((l) => l.trim()).filter(Boolean), truncated };
}

/** Draw pre-wrapped lines; returns the y below the last baseline's line box. */
function drawTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: "left" | "center",
  cx?: number
): number {
  ctx.textAlign = align;
  lines.forEach((l, i) => {
    ctx.fillText(l, align === "center" ? (cx ?? x) : x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight;
}

/**
 * Fit a display title into maxLines: shrink the font from startSize toward
 * minSize until the wrapped text fits the width without truncation, then
 * ellipsize only if even the smallest size cannot hold it.
 */
function fitTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number,
  weight = 800
): { lines: string[]; size: number; truncated: boolean; lineHeight: number } {
  const lineHeightAt = (s: number) => Math.round(s * 1.14);
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px 'Playfair Display', serif`;
    const { lines, truncated } = wrapLines(ctx, title, maxWidth, maxLines);
    const fits = lines.length > 0 && !truncated && lines.every((l) => ctx.measureText(l).width <= maxWidth);
    if (fits) return { lines, size, truncated: false, lineHeight: lineHeightAt(size) };
    size -= 4;
  }
  ctx.font = `${weight} ${minSize}px 'Playfair Display', serif`;
  const fitted = wrapLines(ctx, title, maxWidth, maxLines);
  const lines = fitted.lines;
  if (fitted.truncated && lines.length > 0) {
    const last = lines[lines.length - 1];
    const candidate = (last.replace(/\s+\S*$/, "") || last).trimEnd();
    if (ctx.measureText(candidate + "…").width <= maxWidth) {
      lines[lines.length - 1] = candidate + "…";
    }
  }
  return { lines, size: minSize, truncated: fitted.truncated, lineHeight: lineHeightAt(minSize) };
}

/** Shared date parts. Invalid or missing dates degrade to "UPCOMING". */
function eventDateParts(date: string | Date) {
  const d = new Date(date);
  const invalid = isNaN(d.getTime());
  return {
    invalid,
    dayName: invalid ? "UPCOMING" : d.toLocaleDateString("en-NG", { weekday: "long" }).toUpperCase(),
    dateStr: invalid ? "" : d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }).toUpperCase(),
    timeStr: invalid ? "" : d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase(),
    monthYear: invalid ? "" : d.toLocaleDateString("en-NG", { month: "long", year: "numeric" }).toUpperCase(),
  };
}

/** Theme preset colors (from shared/themes) as plain hex values. */
function flyerPresetVars(themeKey: any): { background?: string; ink?: string; mutedInk?: string } | null {
  const preset = getPreset(themeKey);
  if (!preset) return null;
  const v = preset.vars as Record<string, string>;
  return {
    background: v["--color-background"],
    ink: v["--color-ink"],
    mutedInk: v["--color-muted-ink"],
  };
}

/** Ambient radial glow behind preset content when no photo is set. */
function drawAmbientGlow(ctx: CanvasRenderingContext2D, style: typeof THEME_STYLES[string], width: number, height: number, cy = 0.35) {
  const grad = ctx.createRadialGradient(width * 0.5, height * cy, 100, width * 0.5, height * cy, width * 0.75);
  grad.addColorStop(0, style.accentGlow);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/** Double-bezel architectural frame with gold corner marks. */
function drawFrame(ctx: CanvasRenderingContext2D, style: typeof THEME_STYLES[string], accent: string, width: number, height: number, inset: number) {
  ctx.save();
  ctx.strokeStyle = style.frameColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  const cornerLen = 24;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(inset - 1, inset + cornerLen);
  ctx.lineTo(inset - 1, inset - 1);
  ctx.lineTo(inset + cornerLen, inset - 1);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(width - inset + 1 - cornerLen, inset - 1);
  ctx.lineTo(width - inset + 1, inset - 1);
  ctx.lineTo(width - inset + 1, inset + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(inset - 1, height - inset - cornerLen);
  ctx.lineTo(inset - 1, height - inset + 1);
  ctx.lineTo(inset + cornerLen, height - inset + 1);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(width - inset + 1 - cornerLen, height - inset + 1);
  ctx.lineTo(width - inset + 1, height - inset + 1);
  ctx.lineTo(width - inset + 1, height - inset - cornerLen);
  ctx.stroke();
  ctx.restore();
}

/** Centered pill badge with letterspaced label. Returns pill height. */
function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  style: typeof THEME_STYLES[string],
  accent: string,
  opts?: { font?: string; fill?: string; textColor?: string; padX?: number; height?: number; radius?: number; borderColor?: string; maxWidth?: number }
): number {
  const font = opts?.font ?? "600 24px 'DM Sans', sans-serif";
  const padX = opts?.padX ?? 24;
  const h = opts?.height ?? 44;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Never let a long label push the pill past its bounds.
  const label = opts?.maxWidth != null ? truncateToWidth(ctx, text, Math.max(40, opts.maxWidth - padX * 2)) : text;
  const w = ctx.measureText(label).width + padX * 2;
  ctx.fillStyle = opts?.fill ?? "rgba(15, 15, 20, 0.75)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, opts?.radius ?? h / 2);
  ctx.fill();
  ctx.strokeStyle = opts?.borderColor ?? style.badgeBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = opts?.textColor ?? accent;
  ctx.fillText(label, cx, cy + 1);
  ctx.restore();
  return h;
}

/** Mask an access code for public print: keep a hint, hide the rest. */
function maskCode(code: string): string {
  const c = (code || "").trim();
  if (!c) return "";
  if (c.length <= 2) return "•".repeat(Math.max(4, c.length));
  return c.slice(0, 2) + "•".repeat(Math.max(0, c.length - 2));
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BH";
  const first = parts[0][0] || "";
  const second = parts.length > 1 ? (parts[1][0] || "") : (parts[0][1] || "");
  return (first + second).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard event flyer (the original layout, unchanged in behavior)
// ─────────────────────────────────────────────────────────────────────────────
function renderStandardFlyer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: FlyerOptions,
  style: typeof THEME_STYLES[string],
  accent: string,
  frameInset: number
): void {
  const isStory = height > width;

  // 1. Solid background
  ctx.fillStyle = style.bgBase;
  ctx.fillRect(0, 0, width, height);

  // 2. Hero/flyer artwork in cover mode (preloaded by the caller)
  const imageSource = options.customImageDataUrl || options.imageUrl;
  const heroImg = (options as any).__loadedImage as HTMLImageElement | null;
  if (imageSource && heroImg) {
    ctx.save();
    const imgTargetHeight = isStory ? height * 0.72 : height * 0.85;
    const imgRatio = heroImg.width / heroImg.height;
    const targetRatio = width / imgTargetHeight;

    let sx = 0;
    let sy = 0;
    let sWidth = heroImg.width;
    let sHeight = heroImg.height;

    if (imgRatio > targetRatio) {
      sWidth = heroImg.height * targetRatio;
      sx = (heroImg.width - sWidth) / 2;
    } else {
      sHeight = heroImg.width / targetRatio;
      sy = (heroImg.height - sHeight) / 2;
    }

    ctx.drawImage(heroImg, sx, sy, sWidth, sHeight, 0, 0, width, imgTargetHeight);
    ctx.restore();
  } else {
    // Elegant ambient background if no image
    drawAmbientGlow(ctx, style, width, height, 0.35);
  }

  // 3. Cinematic gradients & shadows. Scrims follow the background's tone:
  // dark scrims on dark brand palettes, white scrims on light ones, so a
  // light brand flyer stays light instead of getting muddied by black ink.
  const bgRgb = parseHexColor(style.bgBase) || [10, 10, 14];
  const onLightBg = relLuminance(bgRgb) > 0.45;
  const scrimRgb = onLightBg ? "255, 255, 255" : "5, 5, 8";
  const scrimRgb2 = onLightBg ? "250, 250, 248" : "8, 8, 12";
  ctx.save();
  const topScrim = ctx.createLinearGradient(0, 0, 0, 320);
  topScrim.addColorStop(0, `rgba(${scrimRgb}, 0.85)`);
  topScrim.addColorStop(0.6, `rgba(${scrimRgb}, 0.4)`);
  topScrim.addColorStop(1, "transparent");
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, width, 320);

  const bottomGradientHeight = isStory ? 1050 : 720;
  const bottomGrad = ctx.createLinearGradient(0, height - bottomGradientHeight, 0, height);
  bottomGrad.addColorStop(0, "transparent");
  bottomGrad.addColorStop(0.25, `rgba(${scrimRgb2}, 0.75)`);
  bottomGrad.addColorStop(0.55, onLightBg ? hexToRgba(style.bgBase, 0.98) : style.bgBase + "FA");
  bottomGrad.addColorStop(1, style.bgBase);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - bottomGradientHeight, width, bottomGradientHeight);

  const radialVignette = ctx.createRadialGradient(
    width / 2, height / 2, width * 0.4,
    width / 2, height / 2, width * 0.9
  );
  radialVignette.addColorStop(0, "transparent");
  radialVignette.addColorStop(1, onLightBg ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.65)");
  ctx.fillStyle = radialVignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 4. Frame
  drawFrame(ctx, style, accent, width, height, frameInset);

  // 5. Header / brand mark
  const headerY = frameInset + (isStory ? 70 : 56);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const presenterText = options.organizerName
    ? `${options.organizerName.toUpperCase()} PRESENTS`
    : "BLACK HERITAGE • LAGOS";

  ctx.font = "600 24px 'DM Sans', sans-serif";
  const presWidth = ctx.measureText(presenterText).width + 48;
  const pillHeight = 44;
  const pillY = headerY - pillHeight / 2;

  ctx.fillStyle = onLightBg ? "rgba(255, 255, 255, 0.72)" : "rgba(15, 15, 20, 0.75)";
  ctx.beginPath();
  ctx.roundRect((width - presWidth) / 2, pillY, presWidth, pillHeight, 22);
  ctx.fill();

  ctx.strokeStyle = style.badgeBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.letterSpacing = "2px";
  ctx.fillText(presenterText, width / 2, headerY);
  ctx.restore();

  // 6. Attendee pass stamp
  if (options.isAttendeePass) {
    const stampY = headerY + 70;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const passTag = "ATTENDEE PASS";
    ctx.font = "700 20px 'DM Sans', sans-serif";
    const badgeW = 280;
    const badgeH = 40;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect((width - badgeW) / 2, stampY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.fillStyle = "#0B0B0E";
    ctx.fillText(passTag, width / 2, stampY + 20);
    ctx.restore();
  }

  // 7. Event details block — measured first, then drawn bottom-anchored, so
  // a long title grows upward into the photo instead of crashing through the
  // eyebrow above or the footer below. Title font shrinks (fitTitle) before
  // the layout gives up on fitting.
  const paddingX = frameInset + (isStory ? 54 : 44);
  const contentWidth = width - paddingX * 2;
  const footerH = options.showQr ? (isStory ? 240 : 180) : isStory ? 140 : 100;
  const bottomAnchor = height - frameInset - footerH;
  const parts = eventDateParts(options.date);

  ctx.save();
  ctx.textAlign = "left";

  const eyebrowText = truncateToWidth(
    ctx,
    options.organizerName ? options.organizerName.toUpperCase() : "LIVE EVENT",
    contentWidth
  );

  // Cap-height clearances: baseline-to-baseline gaps sized from the actual
  // font sizes so ascenders never reach the row above.
  const titleStart = isStory ? 76 : 62;
  const titleMin = isStory ? 40 : 34;
  const titleMaxLines = isStory ? 3 : 2;
  const dateSize = 28;
  const locSize = 25;
  const hasPrice = Boolean(options.showPrice && options.price);
  const hasAttendeeCard = Boolean(options.isAttendeePass && options.attendeeName);
  const cardH = isStory ? 96 : 80;

  // Measurement pass (identical steps to the draw pass below).
  const fitted = fitTitle(ctx, options.title || "Untitled Event", contentWidth, titleMaxLines, titleStart, titleMin);
  const eyebrowSize = 20;
  // Eyebrow baseline → first title baseline: the title's ascent (~0.72×size)
  // must clear the eyebrow's descender zone with room to spare.
  const gapEyebrowTitle = Math.round(18 + fitted.size * 0.85);
  const gapTitleRule = 12; // last title baseline → gold rule top
  const ruleH = 4;
  const gapRuleDate = 30; // rule bottom → date baseline
  const gapDateLoc = 38; // date baseline → location baseline
  const gapLocPrice = 18; // last text baseline → price pill top
  const gapPriceCard = 12; // pill bottom → attendee card top
  const showLoc = options.showLocation !== false && Boolean(options.location);

  let blockH =
    gapEyebrowTitle +
    (fitted.lines.length - 1) * fitted.lineHeight +
    gapTitleRule + ruleH + gapRuleDate;
  if (showLoc) blockH += gapDateLoc;
  if (hasPrice) blockH += gapLocPrice + 40;
  if (hasAttendeeCard) blockH += gapPriceCard + cardH;
  blockH += 8; // descender breathing room below the last baseline

  // Top-anchored safety clamp: if the measured block somehow grows taller
  // than the space under the header, keep it below the brand mark rather
  // than colliding with it.
  const headerZoneBottom = frameInset + (isStory ? 170 : 140) + (options.isAttendeePass ? 60 : 0);
  const blockTop = Math.max(bottomAnchor - blockH, headerZoneBottom);

  // ── Draw pass ──
  let currentY = blockTop; // eyebrow baseline
  ctx.font = `700 ${eyebrowSize}px 'DM Sans', sans-serif`;
  ctx.fillStyle = accent;
  ctx.letterSpacing = "2px";
  ctx.fillText(eyebrowText, paddingX, currentY);
  ctx.letterSpacing = "0px";

  const titleBaseline = currentY + gapEyebrowTitle;
  ctx.font = `800 ${fitted.size}px 'Playfair Display', serif`;
  ctx.fillStyle = style.textPrimary;
  ctx.shadowColor = onLightBg ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.textAlign = "left";
  fitted.lines.forEach((l, i) => ctx.fillText(l, paddingX, titleBaseline + i * fitted.lineHeight));
  ctx.shadowColor = "transparent";

  let stackY = titleBaseline + (fitted.lines.length - 1) * fitted.lineHeight;
  ctx.fillStyle = accent;
  ctx.fillRect(paddingX, stackY + gapTitleRule, 80, ruleH);
  stackY += gapTitleRule + ruleH + gapRuleDate;

  ctx.font = `600 ${dateSize}px 'DM Sans', sans-serif`;
  ctx.fillStyle = style.textPrimary;
  const dateBits = [parts.dayName, parts.dateStr].filter(Boolean);
  const dateFormatted = `${dateBits.join(", ")}${parts.timeStr ? ` • ${parts.timeStr}` : ""}`;
  ctx.fillText(truncateToWidth(ctx, dateFormatted, contentWidth), paddingX, stackY);

  if (showLoc) {
    stackY += gapDateLoc;
    ctx.font = `400 ${locSize}px 'DM Sans', sans-serif`;
    ctx.fillStyle = style.textMuted;
    ctx.fillText(truncateToWidth(ctx, options.location, contentWidth), paddingX, stackY);
  }

  if (hasPrice) {
    stackY += gapLocPrice;
    const priceText = options.price!.toUpperCase();
    ctx.font = "700 22px 'DM Sans', sans-serif";
    const priceW = Math.min(ctx.measureText(priceText).width + 36, contentWidth);
    const priceH = 40;

    ctx.fillStyle = hexToRgba(accent, 0.15);
    ctx.beginPath();
    ctx.roundRect(paddingX, stackY, priceW, priceH, 6);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.fillText(truncateToWidth(ctx, priceText, priceW - 36), paddingX + 18, stackY + 26);
    stackY += priceH;
  }

  if (hasAttendeeCard) {
    const cardY = stackY + gapPriceCard;
    ctx.fillStyle = onLightBg ? "rgba(255, 255, 255, 0.85)" : "rgba(25, 25, 31, 0.85)";
    ctx.beginPath();
    ctx.roundRect(paddingX, cardY, contentWidth, cardH, 12);
    ctx.fill();

    ctx.strokeStyle = hexToRgba(accent, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = "600 18px 'DM Sans', sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText("TICKET HOLDER", paddingX + 24, cardY + 30);

    ctx.font = "700 28px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textPrimary;
    ctx.fillText(truncateToWidth(ctx, options.attendeeName!, contentWidth - 48), paddingX + 24, cardY + 66);

    if (options.ticketTier) {
      ctx.textAlign = "right";
      ctx.font = "600 18px 'DM Sans', sans-serif";
      ctx.fillStyle = style.textMuted;
      ctx.fillText("TIER", paddingX + contentWidth - 24, cardY + 30);

      ctx.font = "700 24px 'DM Sans', sans-serif";
      ctx.fillStyle = accent;
      ctx.fillText(truncateToWidth(ctx, options.ticketTier, contentWidth - 120), paddingX + contentWidth - 24, cardY + 66);
      ctx.textAlign = "left";
    }
  }

  ctx.restore();

  // 8. Footer with QR
  const footerY = height - frameInset - (isStory ? 180 : 140);

  if (options.showQr && options.qrUrl) {
    const qrSize = isStory ? 140 : 110;
    const qrX = paddingX;
    const qrY = footerY;

    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();

    drawQRCode(ctx, options.qrUrl, qrX, qrY, qrSize, {
      darkColor: "#0B0B0F",
      lightColor: "#FFFFFF",
      margin: 1,
      rounded: false,
    });

    const textX = qrX + qrSize + 32;
    const textY = qrY + (isStory ? 42 : 32);

    ctx.textAlign = "left";
    ctx.font = "700 24px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textPrimary;
    ctx.fillText(options.isAttendeePass ? "SCAN TO VERIFY PASS" : "SCAN TO GET TICKETS", textX, textY);

    ctx.font = "500 20px 'DM Sans', sans-serif";
    ctx.fillStyle = accent;
    const displayUrl = options.qrUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    ctx.fillText(displayUrl, textX, textY + 32);

    ctx.font = "400 18px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textMuted;
    ctx.fillText("Scan with phone camera", textX, textY + 62);
    ctx.restore();
  } else {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "600 22px 'DM Sans', sans-serif";
    ctx.fillStyle = accent;
    ctx.letterSpacing = "1.5px";
    ctx.fillText("BLACK HERITAGE • LAGOS, NIGERIA", width / 2, footerY + 50);

    ctx.font = "400 18px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textMuted;
    ctx.fillText("blackhevents.com", width / 2, footerY + 80);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Teaser: announce before the details are locked. No venue, no exact date,
// no price required. Procedural background only.
// ─────────────────────────────────────────────────────────────────────────────
function renderTeaserFlyer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: CreativeStudioOptions,
  style: typeof THEME_STYLES[string],
  accent: string,
  frameInset: number
): void {
  const isStory = height > width;

  ctx.fillStyle = style.bgBase;
  ctx.fillRect(0, 0, width, height);
  drawAmbientGlow(ctx, style, width, height, isStory ? 0.38 : 0.42);

  // Soft vertical light falloff so centered type keeps contrast.
  const falloff = ctx.createLinearGradient(0, 0, 0, height);
  falloff.addColorStop(0, "rgba(0,0,0,0.35)");
  falloff.addColorStop(0.5, "rgba(0,0,0,0)");
  falloff.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, width, height);

  drawFrame(ctx, style, accent, width, height, frameInset);

  const paddingX = frameInset + (isStory ? 54 : 44);
  const contentWidth = width - paddingX * 2;
  const parts = eventDateParts(options.date);

  // Header pill
  const headerText = options.organizerName
    ? `${options.organizerName.toUpperCase()} PRESENTS`
    : "BLACK HERITAGE • LAGOS";
  const headerY = frameInset + (isStory ? 72 : 58);
  drawPill(ctx, headerText, width / 2, headerY, style, accent);

  // Announcement eyebrow
  const eyebrowY = isStory ? height * 0.3 : height * 0.27;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "700 22px 'DM Sans', sans-serif";
  ctx.fillStyle = accent;
  ctx.letterSpacing = "6px";
  ctx.fillText("THE ANNOUNCEMENT", width / 2, eyebrowY);
  ctx.letterSpacing = "0px";

  // Title, big but fitted: shrink toward the minimum before wrapping
  // deeper, so a long name stays clear of the eyebrow above and the teaser
  // line below.
  const fitted = fitTitle(ctx, options.title || "Something Is Coming", contentWidth, isStory ? 3 : 2, isStory ? 96 : 68, isStory ? 44 : 36);
  ctx.font = `800 ${fitted.size}px 'Playfair Display', serif`;
  ctx.fillStyle = style.textPrimary;
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 18;
  const titleBaseline = eyebrowY + Math.round(30 + fitted.size * 0.95);
  fitted.lines.forEach((l, i) => ctx.fillText(l, width / 2, titleBaseline + i * fitted.lineHeight));
  ctx.shadowColor = "transparent";
  const titleEnd = titleBaseline + (fitted.lines.length - 1) * fitted.lineHeight;

  // Gold rule
  ctx.fillStyle = accent;
  const ruleW = isStory ? 140 : 110;
  ctx.fillRect(width / 2 - ruleW / 2, titleEnd + (isStory ? 26 : 18), ruleW, 5);
  ctx.restore();

  // Teaser line: what is known, stated plainly
  const teaserText = (options.teaserLine || "").trim();
  let belowRule = titleEnd + (isStory ? 78 : 62);
  if (teaserText) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 ${isStory ? 30 : 26}px 'DM Sans', sans-serif`;
    ctx.fillStyle = style.textMuted;
    const teaserLines = wrapLines(ctx, teaserText, contentWidth, 2).lines;
    teaserLines.forEach((l, i) => ctx.fillText(l, width / 2, belowRule + i * (isStory ? 40 : 36)));
    ctx.restore();
    belowRule += (teaserLines.length - 1) * (isStory ? 40 : 36) + (isStory ? 90 : 76);
  }

  // Hype badge
  const badgeText = (options.teaserBadge || "").trim();
  if (badgeText) {
    drawPill(
      ctx,
      badgeText.toUpperCase(),
      width / 2,
      belowRule,
      style,
      accent,
      { fill: style.badgeBg, borderColor: accent, textColor: accent, font: "700 24px 'DM Sans', sans-serif", height: 52, padX: 32, maxWidth: contentWidth }
    );
    belowRule += isStory ? 110 : 96;
  }

  // Month hint when only the month is public. Exact dates stay hidden.
  if (parts.monthYear && !parts.invalid) {
    drawPill(
      ctx,
      `SAVE THE DATE • ${parts.monthYear}`,
      width / 2,
      belowRule,
      style,
      accent,
      { fill: "rgba(15,15,20,0.75)", textColor: style.textPrimary, font: "600 22px 'DM Sans', sans-serif", height: 46, maxWidth: contentWidth }
    );
  }

  // Footer: follow CTA with optional QR. The QR sits high enough that its
  // URL caption stays on the canvas with room below.
  const footerY = height - frameInset - (isStory ? 150 : 110);
  if (options.showQr && options.qrUrl) {
    const qrSize = isStory ? 130 : 100;
    const qrY = height - frameInset - (isStory ? 195 : 155);
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(width / 2 - qrSize / 2 - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();
    drawQRCode(ctx, options.qrUrl, width / 2 - qrSize / 2, qrY, qrSize, {
      darkColor: "#0B0B0F",
      lightColor: "#FFFFFF",
      margin: 1,
      rounded: false,
    });

    ctx.textAlign = "center";
    ctx.font = "700 24px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textPrimary;
    ctx.fillText("SCAN TO FOLLOW THE DROP", width / 2, qrY + qrSize + 42);
    ctx.font = "500 20px 'DM Sans', sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText(options.qrUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""), width / 2, qrY + qrSize + 74);
    ctx.restore();
  } else {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "600 22px 'DM Sans', sans-serif";
    ctx.fillStyle = accent;
    ctx.letterSpacing = "1.5px";
    ctx.fillText("BLACK HERITAGE • LAGOS, NIGERIA", width / 2, footerY + 40);
    ctx.font = "400 18px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textMuted;
    ctx.fillText("blackhevents.com", width / 2, footerY + 70);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private access pass: a credential card for invite-only gatherings. The
// access code prints masked unless the organizer opts to reveal it.
// ─────────────────────────────────────────────────────────────────────────────
function renderPrivatePassFlyer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: CreativeStudioOptions,
  style: typeof THEME_STYLES[string],
  accent: string,
  frameInset: number
): void {
  const isStory = height > width;

  ctx.fillStyle = style.bgBase;
  ctx.fillRect(0, 0, width, height);
  drawAmbientGlow(ctx, style, width, height, isStory ? 0.3 : 0.34);

  drawFrame(ctx, style, accent, width, height, frameInset);

  // Inner credential hairline: the second bezel that makes it read as a card.
  ctx.save();
  ctx.strokeStyle = style.frameColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(frameInset + 16, frameInset + 16, width - (frameInset + 16) * 2, height - (frameInset + 16) * 2);
  ctx.restore();

  const contentWidth = width - (frameInset + 48) * 2;

  // Monogram seal
  const monogramY = frameInset + (isStory ? 150 : 120);
  const r = isStory ? 62 : 52;
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, monogramY, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 15, 20, 0.85)";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 34px 'Playfair Display', serif";
  ctx.fillStyle = accent;
  ctx.fillText(initialsOf(options.hostLine || options.organizerName || options.title), width / 2, monogramY + 2);
  ctx.restore();

  // Host line
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 22px 'DM Sans', sans-serif";
  ctx.fillStyle = style.textMuted;
  ctx.letterSpacing = "4px";
  const hostText = (options.hostLine || options.organizerName || "PRIVATE COLLECTION").toUpperCase();
  ctx.fillText(hostText, width / 2, monogramY + r + (isStory ? 56 : 46));
  ctx.letterSpacing = "0px";
  ctx.restore();

  // Strictly by invitation pill
  const pillY = monogramY + r + (isStory ? 108 : 90);
  drawPill(
    ctx,
    "STRICTLY BY INVITATION",
    width / 2,
    pillY,
    style,
    accent,
    { fill: style.badgeBg, borderColor: accent, font: "700 22px 'DM Sans', sans-serif", height: 48 }
  );

  // Title: fitted like every other preset, so a long name shrinks instead
  // of running over the invitation pill above or the dress-code chip below.
  const titleY = pillY + (isStory ? 92 : 76);
  const titleFit = fitTitle(ctx, options.title || "A Private Gathering", contentWidth, 2, isStory ? 76 : 58, isStory ? 40 : 34);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${titleFit.size}px 'Playfair Display', serif`;
  ctx.fillStyle = style.textPrimary;
  titleFit.lines.forEach((l, i) => ctx.fillText(l, width / 2, titleY + i * titleFit.lineHeight));
  ctx.restore();
  const titleEnd = titleY + titleFit.lines.length * titleFit.lineHeight;

  // Dress code chip
  let belowTitle = titleEnd + (isStory ? 46 : 36);
  if (options.dressCode && options.dressCode.trim()) {
    drawPill(
      ctx,
      `DRESS ${options.dressCode.trim().toUpperCase()}`,
      width / 2,
      belowTitle + 24,
      style,
      accent,
      { fill: "rgba(15,15,20,0.75)", textColor: style.textPrimary, font: "600 20px 'DM Sans', sans-serif", height: 44 }
    );
    belowTitle += 92;
  }

  // Access code card. The real code prints masked unless the organizer
  // explicitly opts to reveal it, so a forwarded card does not open the door.
  const cardH = isStory ? 128 : 108;
  const cardW = contentWidth;
  const cardX = (width - cardW) / 2;
  const cardY = Math.min(belowTitle + (isStory ? 60 : 44), height - frameInset - (isStory ? 420 : 330));
  const rawCode = (options.accessCode || "").trim();
  const displayCode = rawCode
    ? (options.showAccessCode ? rawCode : maskCode(rawCode))
    : "INVITE LINK ENCLOSED";

  ctx.save();
  ctx.fillStyle = "rgba(20, 20, 26, 0.9)";
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(227, 178, 60, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "700 18px 'DM Sans', sans-serif";
  ctx.fillStyle = accent;
  ctx.letterSpacing = "3px";
  ctx.fillText(rawCode ? "ACCESS CODE" : "ENTRY", cardX + 28, cardY + 30);
  ctx.letterSpacing = "0px";

  ctx.textAlign = "center";
  ctx.font = rawCode
    ? "800 44px 'DM Sans', monospace"
    : "600 26px 'DM Sans', sans-serif";
  ctx.fillStyle = "#FFFFFF";
  if (rawCode && !options.showAccessCode) ctx.letterSpacing = "6px";
  ctx.fillText(displayCode, width / 2, cardY + cardH / 2 + 16);
  ctx.letterSpacing = "0px";
  ctx.restore();

  // QR to the gated link. Kept well above the footer line so the caption
  // and the brand footer never share a baseline zone.
  if (options.showQr && options.qrUrl) {
    const qrSize = isStory ? 140 : 110;
    const qrY = height - frameInset - (isStory ? 290 : 230);
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(width / 2 - qrSize / 2 - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();
    drawQRCode(ctx, options.qrUrl, width / 2 - qrSize / 2, qrY, qrSize, {
      darkColor: "#0B0B0F",
      lightColor: "#FFFFFF",
      margin: 1,
      rounded: false,
    });
    ctx.textAlign = "center";
    ctx.font = "700 22px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textPrimary;
    ctx.fillText("SCAN FOR YOUR ENTRY", width / 2, qrY + qrSize + 40);
    ctx.restore();
  }

  // Footer
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "600 20px 'DM Sans', sans-serif";
  ctx.fillStyle = accent;
  ctx.letterSpacing = "1.5px";
  ctx.fillText("BLACK HERITAGE • PRIVATE EVENTS", width / 2, height - frameInset - (isStory ? 58 : 48));
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor spotlight: a promo card vendors post to WhatsApp status to win
// bookings, pointing back at their profile.
// ─────────────────────────────────────────────────────────────────────────────
function renderVendorCardFlyer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: CreativeStudioOptions,
  style: typeof THEME_STYLES[string],
  accent: string,
  frameInset: number
): void {
  const isStory = height > width;

  ctx.fillStyle = style.bgBase;
  ctx.fillRect(0, 0, width, height);
  drawAmbientGlow(ctx, style, width, height, isStory ? 0.24 : 0.3);

  drawFrame(ctx, style, accent, width, height, frameInset);

  const paddingX = frameInset + (isStory ? 54 : 44);
  const contentWidth = width - paddingX * 2;

  // Header: where they operate
  const headerText = (options.vendorArea || "LAGOS").toUpperCase() + " VENDOR";
  drawPill(ctx, headerText, width / 2, frameInset + (isStory ? 70 : 56), style, accent);

  // Portrait: photo in a rounded window, or a monogram seal. The photo
  // shrinks when the rows below it are tall, so the stack always clears the
  // CTA zone instead of colliding with it.
  const photoTopPad = isStory ? 130 : 104;
  const nameGap = isStory ? 92 : 84;
  const chipH = 46;
  const nameFit0 = fitTitle(ctx, options.title || "My Business", contentWidth, 2, isStory ? 68 : 60, isStory ? 40 : 34);
  const chipAdvance = options.vendorCategory ? 92 : 0;
  const ratingAdvance = options.vendorRating ? (isStory ? 76 : 66) : 0;
  const ctaY = height - frameInset - (options.showQr && options.qrUrl ? (isStory ? 330 : 250) : (isStory ? 150 : 120));
  const stackEndLimit = ctaY - 56 / 2 - (isStory ? 60 : 50);
  const fixedBelowPhoto = nameGap + (nameFit0.lines.length - 1) * nameFit0.lineHeight + chipAdvance + ratingAdvance;
  const photoHMax = isStory ? height * 0.34 : height * 0.36;
  const photoHMin = isStory ? Math.round(height * 0.2) : Math.round(height * 0.22);
  const photoH = Math.max(photoHMin, Math.min(photoHMax, stackEndLimit - photoTopPad - fixedBelowPhoto - 8));
  const photoY = photoTopPad;
  const photoSource = options.customImageDataUrl || options.imageUrl;
  let photoDrawn = false;
  if (photoSource) {
    // Preloaded by the caller (see renderFlyerToCanvas).
    const img = (options as any).__loadedImage as HTMLImageElement | null;
    if (img) {
      const radius = 24;
      const px = paddingX;
      const py = photoY;
      const pw = contentWidth;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, pw, photoH, radius);
      ctx.clip();
      const imgRatio = img.width / img.height;
      const targetRatio = pw / photoH;
      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
      if (imgRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
      } else {
        sHeight = img.width / targetRatio;
        sy = (img.height - sHeight) / 2;
      }
      ctx.drawImage(img, sx, sy, sWidth, sHeight, px, py, pw, photoH);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, pw, photoH, radius);
      ctx.strokeStyle = style.frameColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      photoDrawn = true;
    }
  }
  if (!photoDrawn) {
    const r = isStory ? 120 : 110;
    const cy = photoY + photoH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20, 20, 28, 0.9)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 72px 'Playfair Display', serif";
    ctx.fillStyle = accent;
    ctx.fillText(initialsOf(options.title), width / 2, cy + 2);
    ctx.restore();
  }

  // Name — fitted so a long business name shrinks instead of colliding
  // with the category chip below it.
  const nameY = photoY + photoH + nameGap;
  const nameFit = nameFit0;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${nameFit.size}px 'Playfair Display', serif`;
  ctx.fillStyle = style.textPrimary;
  nameFit.lines.forEach((l, i) => ctx.fillText(l, width / 2, nameY + i * nameFit.lineHeight));
  ctx.restore();
  const nameEnd = nameY + nameFit.lines.length * nameFit.lineHeight;

  // Category chip
  let belowName = nameEnd + (isStory ? 44 : 40);
  if (options.vendorCategory) {
    drawPill(
      ctx,
      options.vendorCategory.toUpperCase(),
      width / 2,
      belowName + 22,
      style,
      accent,
      { fill: style.badgeBg, borderColor: accent, font: "700 22px 'DM Sans', sans-serif", height: 46, maxWidth: contentWidth }
    );
    belowName += chipAdvance;
  }

  // Rating row
  if (options.vendorRating) {
    const ratingNum = Math.max(0, Math.min(5, parseFloat(options.vendorRating) || 0));
    const starY = belowName + (isStory ? 34 : 28);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const starSize = isStory ? 30 : 26;
    const gap = starSize + 10;
    const totalW = 5 * gap;
    for (let i = 0; i < 5; i++) {
      const cx = width / 2 - totalW / 2 + gap * i + gap / 2 - 10;
      drawStar(ctx, cx, starY, starSize / 2, i < Math.round(ratingNum) ? accent : "rgba(255,255,255,0.18)");
    }
    ctx.font = "700 26px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textPrimary;
    ctx.fillText(ratingNum.toFixed(1), width / 2 + totalW / 2 + 6, starY);
    ctx.restore();
    belowName += isStory ? 76 : 66;
  }

  // CTA pill + link (ctaY computed above with the photo sizing)
  drawPill(
    ctx,
    "BOOK ME ON BLACK HERITAGE",
    width / 2,
    ctaY,
    style,
    accent,
    { fill: accent, borderColor: accent, textColor: "#0B0B0E", font: "800 24px 'DM Sans', sans-serif", height: 56, padX: 36, maxWidth: contentWidth }
  );

  const profileLine = options.vendorSlug
    ? `blackhevents.com/v/${options.vendorSlug}`
    : "blackhevents.com/v";
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "500 22px 'DM Sans', sans-serif";
  ctx.fillStyle = style.textMuted;
  ctx.fillText(profileLine, width / 2, ctaY + 52);
  ctx.restore();

  // QR to the profile
  if (options.showQr && options.qrUrl) {
    const qrSize = isStory ? 130 : 100;
    const qrY = height - frameInset - (isStory ? 160 : 130);
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(width / 2 - qrSize / 2 - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();
    drawQRCode(ctx, options.qrUrl, width / 2 - qrSize / 2, qrY, qrSize, {
      darkColor: "#0B0B0F",
      lightColor: "#FFFFFF",
      margin: 1,
      rounded: false,
    });
    ctx.textAlign = "center";
    ctx.font = "600 20px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textMuted;
    ctx.fillText("SCAN TO BOOK", width / 2, qrY + qrSize + 38);
    ctx.restore();
  }
}

/** Five-point star used by the vendor rating row. */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const inner = outer + Math.PI / 5;
    const ox = cx + radius * Math.cos(outer);
    const oy = cy + radius * Math.sin(outer);
    const ix = cx + radius * 0.45 * Math.cos(inner);
    const iy = cy + radius * 0.45 * Math.sin(inner);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/**
 * Renders a flyer or studio card to the provided HTML5 Canvas element.
 * The standard preset matches the original renderer exactly.
 */
export async function renderFlyerToCanvas(
  canvas: HTMLCanvasElement,
  options: FlyerOptions | CreativeStudioOptions
): Promise<void> {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Font loading failure fallback to system serif/sans
    }
  }

  const preset = (options as CreativeStudioOptions).presetType || "standard";
  const isStory = options.format === "story";
  const width = 1080;
  const height = isStory ? 1920 : 1080;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const studioOpts = options as CreativeStudioOptions;

  // Brand theming: an explicit brandTheme wins; otherwise any event object
  // attached as __event drives the palette. With neither, the built-in theme
  // renders exactly as before.
  const brand = studioOpts.brandTheme || brandThemeFromEvent((options as any).__event);
  const resolved = resolveFlyerTheme(options.theme, brand);
  const style = resolved.style;
  const accent = options.accentColor || style.accent;
  const frameInset = isStory ? 54 : 44;

  // Presets that draw a photo need it decoded before layout math runs.
  if (preset === "vendor_card" || preset === "standard") {
    const source = options.customImageDataUrl || options.imageUrl;
    studioOpts.__loadedImage = source ? await loadImage(source) : null;
  }

  switch (preset) {
    case "teaser":
      return renderTeaserFlyer(ctx, width, height, studioOpts, style, accent, frameInset);
    case "private_pass":
      return renderPrivatePassFlyer(ctx, width, height, studioOpts, style, accent, frameInset);
    case "vendor_card":
      return renderVendorCardFlyer(ctx, width, height, studioOpts, style, accent, frameInset);
    default:
      return renderStandardFlyer(ctx, width, height, options, style, accent, frameInset);
  }
}

/**
 * Exports canvas to Blob (PNG).
 */
export function getCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas blob export failed"));
    }, "image/png");
  });
}

/**
 * Triggers a download of the rendered canvas as a PNG file.
 */
export function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
