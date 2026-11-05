import Konva from "konva";

/**
 * Flyer Studio engine: designed templates as layer lists, curated palettes and
 * display faces, text fitting, and the art treatments (duotone + grain) that
 * pull any photo or AI artwork into the template's palette.
 *
 * The rule that keeps flyers from looking like AI output: the model only ever
 * paints background art. Every word is typeset here, in a template a person
 * designed, with fonts and palettes chosen on purpose.
 */

export type StudioFormat = "post" | "story" | "square";
export const FORMAT_SIZE: Record<StudioFormat, { w: number; h: number; label: string }> = {
  post: { w: 1080, h: 1350, label: "Post 4:5" },
  story: { w: 1080, h: 1920, label: "Story 9:16" },
  square: { w: 1080, h: 1080, label: "Square" },
};

export interface Palette { id: string; name: string; bg: string; ink: string; accent: string; muted: string }
export const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight gold", bg: "#0F0F14", ink: "#F7F5EF", accent: "#E3B23C", muted: "#9EA0AD" },
  { id: "sunset", name: "Lagos sunset", bg: "#1C0F0A", ink: "#FFF1E6", accent: "#FF6A3D", muted: "#E0B8A0" },
  { id: "ankara", name: "Ankara green", bg: "#0B2E23", ink: "#F6F1E4", accent: "#F2C14E", muted: "#A9C2B5" },
  { id: "paper", name: "Paper and red", bg: "#EFE9DD", ink: "#141414", accent: "#C8102E", muted: "#5C5852" },
  { id: "electric", name: "Electric lime", bg: "#0A0A0A", ink: "#FFFFFF", accent: "#C6F432", muted: "#8A8A8A" },
  { id: "owambe", name: "Owambe", bg: "#2A0B1F", ink: "#FDF2F8", accent: "#F5B700", muted: "#D9A7C1" },
];

export interface StudioFont { family: string; style: string; label: string }
export const FONTS: StudioFont[] = [
  { family: "Anton", style: "normal", label: "Anton" },
  { family: "Bebas Neue", style: "normal", label: "Bebas Neue" },
  { family: "Syne", style: "800", label: "Syne" },
  { family: "Archivo Black", style: "normal", label: "Archivo Black" },
  { family: "Instrument Serif", style: "italic", label: "Instrument Serif" },
  { family: "Playfair Display", style: "700", label: "Playfair" },
  { family: "DM Sans", style: "700", label: "DM Sans" },
];

let fontsPromise: Promise<void> | null = null;
/** Load the studio's display faces once (stylesheet + every face), never for the app UI. */
export function loadStudioFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (!document.querySelector("link[data-flyer-fonts]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/fonts/flyer/flyer-fonts.css";
      link.dataset.flyerFonts = "1";
      document.head.appendChild(link);
      await new Promise((r) => { link.onload = r; link.onerror = r; });
    }
    const faces = [...FONTS.map((f) => `${f.style === "italic" ? "italic 400" : f.style === "normal" ? "400" : f.style} 64px "${f.family}"`),
      `400 64px "DM Sans"`, `italic 400 64px "Instrument Serif"`, `400 64px "Instrument Serif"`];
    await Promise.all(faces.map((f) => document.fonts.load(f, "Aa₦0").catch(() => null)));
  })();
  return fontsPromise;
}

// ── Layers ──────────────────────────────────────────────────────────────────

export type Role = "title" | "date" | "time" | "venue" | "price" | "host" | "tagline" | "art" | "day";
export interface Layer {
  id: string;
  kind: "rect" | "text" | "image" | "circle" | "line";
  role?: Role;
  x: number; y: number; width?: number; height?: number; rotation?: number; opacity?: number;
  // shapes
  fill?: string; stroke?: string; strokeWidth?: number; cornerRadius?: number; dash?: number[]; points?: number[]; radius?: number;
  gradient?: { from: [number, number]; to: [number, number]; stops: (number | string)[] };
  // text
  text?: string; fontFamily?: string; fontStyle?: string; fontSize?: number; align?: "left" | "center" | "right";
  letterSpacing?: number; lineHeight?: number;
  // image
  treatment?: "duotone" | "original";
  editable?: boolean; // shows in the select/transform flow
  composite?: GlobalCompositeOperation;
}

export interface Facts {
  title: string; dateLine: string; timeLine: string; venue: string; price: string; host: string; tagline: string;
  dayNum: string; month: string; weekday: string;
}

export function factsFromEvent(ev: { title?: string; date?: any; location?: string; host?: string; price?: string }): Facts {
  const d = ev.date ? new Date(ev.date) : null;
  const ok = d && !isNaN(d.getTime());
  const weekday = ok ? d!.toLocaleDateString("en-GB", { weekday: "long" }) : "";
  const month = ok ? d!.toLocaleDateString("en-GB", { month: "short" }) : "";
  const dayNum = ok ? String(d!.getDate()) : "";
  const time = ok ? d!.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(" ", "").toUpperCase() : "";
  return {
    title: (ev.title || "Your Event").trim(),
    dateLine: ok ? `${weekday.slice(0, 3)} ${dayNum} ${month}`.toUpperCase() : "",
    timeLine: time ? `${time} till late` : "",
    venue: (ev.location || "").trim(),
    price: ev.price || "",
    host: ev.host || "",
    tagline: "",
    dayNum, month: month.toUpperCase(), weekday: weekday.toUpperCase(),
  };
}

const measurer = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
/** Largest size where the text fits the box without breaking a word. */
export function fitText(text: string, family: string, style: string, maxW: number, maxH: number,
  { max = 260, min = 28, lineHeight = 1, letterSpacing = 0 } = {}): number {
  const words = text.split(/\s+/).filter(Boolean);
  for (let size = max; size > min; size -= 4) {
    if (measurer) {
      measurer.font = `${style === "italic" ? "italic 400" : style === "normal" ? "400" : style} ${size}px "${family}"`;
      const widest = Math.max(...words.map((w) => measurer.measureText(w).width + letterSpacing * w.length), 0);
      if (widest > maxW) continue;
    }
    const node = new Konva.Text({ text, fontFamily: family, fontStyle: style, fontSize: size, width: maxW, lineHeight, letterSpacing, wrap: "word" });
    const h = node.height();
    node.destroy();
    if (h <= maxH) return size;
  }
  return min;
}

/** Rendered height of a text block, for stacking the layers below it. */
export function textHeight(text: string, family: string, style: string, size: number, width: number, lineHeight = 1, letterSpacing = 0): number {
  const node = new Konva.Text({ text, fontFamily: family, fontStyle: style, fontSize: size, width, lineHeight, letterSpacing, wrap: "word" });
  const h = node.height();
  node.destroy();
  return h;
}

// ── Art treatments ──────────────────────────────────────────────────────────

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const cache = new Map<string, HTMLCanvasElement>();
/** Map an image to two palette colours (shadows -> dark, highlights -> light), with a gentle S-curve. */
export function duotone(img: HTMLImageElement | HTMLCanvasElement, dark: string, light: string): HTMLCanvasElement {
  const key = `${(img as any).src || (img as any).dataset?.k || ""}|${dark}|${light}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = Math.min((img as any).naturalWidth || img.width, 1600);
  const h = Math.round(w * (((img as any).naturalHeight || img.height) / ((img as any).naturalWidth || img.width)));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const [r0, g0, b0] = hex(dark), [r1, g1, b1] = hex(light);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    let l = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
    l = l * l * (3 - 2 * l); // S-curve: deeper shadows, cleaner highlights
    p[i] = r0 + (r1 - r0) * l; p[i + 1] = g0 + (g1 - g0) * l; p[i + 2] = b0 + (b1 - b0) * l;
  }
  ctx.putImageData(data, 0, 0);
  cache.set(key, c);
  return c;
}

let grainCanvas: HTMLCanvasElement | null = null;
/** A tile of film grain, drawn once and laid over the whole flyer at low opacity. */
export function grain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = 540; c.height = 960;
  const ctx = c.getContext("2d")!;
  const d = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  grainCanvas = c;
  return c;
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ── Templates ───────────────────────────────────────────────────────────────

export interface TemplateCtx { w: number; h: number; f: Facts; p: Palette; hasArt: boolean }
export interface Template {
  id: string; name: string; note: string;
  /** Where the AI art should stay quiet for this layout's type. */
  calm: "top" | "bottom" | "center";
  treatment: "duotone" | "original";
  build: (c: TemplateCtx) => Layer[];
}

const M = 72; // outer margin at 1080 wide
const sans = "DM Sans";
const bgRect = (c: TemplateCtx, fill = c.p.bg): Layer => ({ id: "bg", kind: "rect", x: 0, y: 0, width: c.w, height: c.h, fill });
const art = (c: TemplateCtx, x: number, y: number, width: number, height: number, treatment: Layer["treatment"], opacity = 1): Layer =>
  ({ id: "art", kind: "image", role: "art", x, y, width, height, treatment, opacity });
const scrim = (id: string, c: TemplateCtx, y0: number, y1: number, alphaTop = 0, alphaBottom = 1): Layer => ({
  id, kind: "rect", x: 0, y: y0, width: c.w, height: y1 - y0,
  gradient: { from: [0, 0], to: [0, y1 - y0], stops: [0, rgba(c.p.bg, alphaTop), 1, rgba(c.p.bg, alphaBottom)] },
});
export function rgba(h: string, a: number) {
  const [r, g, b] = hex(h);
  return `rgba(${r},${g},${b},${a})`;
}
const T = (id: string, role: Role | undefined, text: string, x: number, y: number, width: number, fontFamily: string, fontStyle: string,
  fontSize: number, fill: string, extra: Partial<Layer> = {}): Layer =>
  ({ id, kind: "text", role, text, x, y, width, fontFamily, fontStyle, fontSize, fill, align: "left", lineHeight: 1.1, editable: true, ...extra });

export const TEMPLATES: Template[] = [
  {
    id: "headline", name: "Headline", note: "Huge condensed title under the artwork", calm: "bottom", treatment: "duotone",
    build: (c) => {
      const { w, h, f, p } = c;
      const artH = h * 0.6;
      const title = f.title.toUpperCase();
      const tw = w - M * 2;
      const size = fitText(title, "Anton", "normal", tw, h * 0.26, { max: 230, lineHeight: 0.95 });
      const th = textHeight(title, "Anton", "normal", size, tw, 0.95);
      const ty = Math.max(h * 0.5, h - M - 210 - th);
      let y = ty + th + 34;
      const out: Layer[] = [bgRect(c), art(c, 0, 0, w, artH, "duotone"), scrim("scrim", c, artH * 0.55, artH + 2),
        T("title", "title", title, M, ty, tw, "Anton", "normal", size, p.ink, { lineHeight: 0.95 }),
        { id: "rule", kind: "rect", x: M, y, width: 120, height: 10, fill: p.accent }];
      y += 40;
      out.push(T("date", "date", [f.dateLine, f.timeLine].filter(Boolean).join("  ·  "), M, y, tw, sans, "700", 42, p.accent));
      y += 62;
      if (f.venue) out.push(T("venue", "venue", f.venue, M, y, tw, sans, "normal", 36, p.ink));
      if (f.price) out.push(T("price", "price", f.price, M, h - M - 40, tw, sans, "700", 34, p.muted, { align: "right" }));
      if (f.host) out.push(T("host", "host", f.host, M, h - M - 40, tw * 0.6, sans, "normal", 30, p.muted));
      if (f.tagline) out.push(T("tagline", "tagline", f.tagline.toUpperCase(), M, M, tw, sans, "700", 28, p.ink, { letterSpacing: 4 }));
      return out;
    },
  },
  {
    id: "editorial", name: "Editorial", note: "Magazine cover: serif italic over the photo", calm: "bottom", treatment: "original",
    build: (c) => {
      const { w, h, f, p } = c;
      const tw = w - M * 2;
      const size = fitText(f.title, "Instrument Serif", "italic", tw, h * 0.3, { max: 250, lineHeight: 0.92 });
      const th = textHeight(f.title, "Instrument Serif", "italic", size, tw, 0.92);
      const ty = h - M - 150 - th;
      return [bgRect(c), art(c, 0, 0, w, h, "original"), scrim("scrim", c, h * 0.35, h, 0, 0.94),
        scrim("scrimTop", c, 0, 220, 0.55, 0),
        T("date", "date", f.dateLine, M, M, tw * 0.6, sans, "700", 30, p.ink, { letterSpacing: 6 }),
        T("time", "time", f.timeLine.toUpperCase(), M, M, tw, sans, "700", 30, p.ink, { letterSpacing: 6, align: "right" }),
        { id: "hair", kind: "rect", x: M, y: M + 54, width: tw, height: 2, fill: rgba(p.ink, 0.6) },
        ...(f.tagline ? [T("tagline", "tagline", f.tagline, M, ty - 64, tw, sans, "normal", 34, p.accent)] : []),
        T("title", "title", f.title, M - 6, ty, tw + 12, "Instrument Serif", "italic", size, p.ink, { lineHeight: 0.92 }),
        { id: "hair2", kind: "rect", x: M, y: h - M - 92, width: tw, height: 2, fill: rgba(p.ink, 0.5) },
        T("venue", "venue", f.venue, M, h - M - 60, tw * 0.68, sans, "normal", 32, p.ink),
        T("price", "price", f.price, M, h - M - 60, tw, sans, "700", 32, p.accent, { align: "right" })];
    },
  },
  {
    id: "ticket", name: "Ticket", note: "A paper ticket on the artwork", calm: "center", treatment: "duotone",
    build: (c) => {
      const { w, h, f, p } = c;
      const cw = w - M * 2.4, cx = (w - cw) / 2;
      const inner = cw - 112;
      const title = f.title.toUpperCase();
      const size = fitText(title, "Archivo Black", "normal", inner, h * 0.2, { max: 150, lineHeight: 0.98 });
      const th = textHeight(title, "Archivo Black", "normal", size, inner, 0.98);
      const ch = th + 470;
      const cy = (h - ch) / 2;
      const stub = cy + ch - 170;
      const paper = p.id === "paper" ? "#FFFDF8" : p.ink;
      const ink = p.id === "paper" ? p.ink : p.bg;
      return [bgRect(c), art(c, 0, 0, w, h, "duotone", 0.75),
        { id: "card", kind: "rect", x: cx, y: cy, width: cw, height: ch, fill: paper, cornerRadius: 18 },
        { id: "notchL", kind: "circle", x: cx, y: stub, radius: 30, fill: p.bg },
        { id: "notchR", kind: "circle", x: cx + cw, y: stub, radius: 30, fill: p.bg },
        { id: "perf", kind: "line", x: 0, y: 0, points: [cx + 44, stub, cx + cw - 44, stub], stroke: rgba(ink, 0.45), strokeWidth: 3, dash: [14, 12] },
        T("tagline", "tagline", (f.tagline || "Admit one").toUpperCase(), cx + 56, cy + 52, inner, sans, "700", 26, p.accent === "#C6F432" ? ink : p.accent, { letterSpacing: 6 }),
        T("title", "title", title, cx + 56, cy + 104, inner, "Archivo Black", "normal", size, ink, { lineHeight: 0.98 }),
        T("date", "date", [f.dateLine, f.timeLine].filter(Boolean).join("  ·  "), cx + 56, cy + 136 + th, inner, sans, "700", 36, ink),
        T("venue", "venue", f.venue, cx + 56, cy + 192 + th, inner, sans, "normal", 32, rgba(ink, 0.75)),
        T("price", "price", f.price || "Tickets on the link", cx + 56, stub + 52, inner, "Archivo Black", "normal", 52, ink),
        ...(f.host ? [T("host", "host", f.host, cx, cy + ch + 40, cw, sans, "normal", 30, p.ink, { align: "center" })] : [])];
    },
  },
  {
    id: "swiss", name: "Grid", note: "Big date numerals on a colour block", calm: "bottom", treatment: "duotone",
    build: (c) => {
      const { w, h, f, p } = c;
      const top = h * 0.42;
      const tw = w - M * 2;
      const title = f.title;
      const out: Layer[] = [bgRect(c, p.accent), art(c, 0, 0, w, top, "duotone")];
      let y = top + 40;
      if (f.dayNum) {
        // The day numeral is the layout's anchor: one line, sized to its column.
        const numW = 430;
        const numSize = fitText(f.dayNum, "Syne", "800", numW, 300, { max: 300, min: 120, lineHeight: 0.85 });
        out.push(T("day", "day", f.dayNum, M - 8, y, numW, "Syne", "800", numSize, p.bg, { lineHeight: 0.85, editable: false }),
          T("date", "date", `${f.month}\n${f.weekday}`.trim(), M + numW + 30, y + 30, tw - numW - 30, sans, "700", 40, p.bg, { lineHeight: 1.2 }),
          T("time", "time", f.timeLine, M + numW + 30, y + 150, tw - numW - 30, sans, "normal", 34, p.bg));
        y += 290;
      }
      out.push({ id: "rule", kind: "rect", x: M, y, width: tw, height: 4, fill: p.bg });
      y += 40;
      // Title gets whatever room is left above the venue and footer rows.
      const footer = h - M - 44;
      const room = footer - 80 - y - (f.venue ? 60 : 0);
      const size = fitText(title, "Syne", "800", tw, Math.max(room, 80), { max: 170, min: 40, lineHeight: 0.98 });
      const th = textHeight(title, "Syne", "800", size, tw, 0.98);
      out.push(T("title", "title", title, M, y, tw, "Syne", "800", size, p.bg, { lineHeight: 0.98 }));
      y += th + 28;
      if (f.venue) out.push(T("venue", "venue", f.venue, M, y, tw * 0.7, sans, "normal", 34, p.bg));
      if (f.price) out.push(T("price", "price", f.price, M, footer, tw, sans, "700", 36, p.bg, { align: "right" }));
      if (f.host) out.push(T("host", "host", f.host, M, footer, tw * 0.6, sans, "normal", 30, p.bg));
      return out;
    },
  },
  {
    id: "owambe", name: "Owambe", note: "Framed, centred, celebration poster", calm: "center", treatment: "duotone",
    build: (c) => {
      const { w, h, f, p } = c;
      const tw = w - M * 3;
      const title = f.title.toUpperCase();
      const size = fitText(title, "Bebas Neue", "normal", tw, h * 0.34, { max: 280, lineHeight: 0.92, letterSpacing: 4 });
      const th = textHeight(title, "Bebas Neue", "normal", size, tw, 0.92, 4);
      const ty = (h - th) / 2 - 40;
      return [bgRect(c), art(c, 0, 0, w, h, "duotone", 0.45),
        { id: "frame1", kind: "rect", x: 40, y: 40, width: w - 80, height: h - 80, stroke: p.accent, strokeWidth: 4 },
        { id: "frame2", kind: "rect", x: 58, y: 58, width: w - 116, height: h - 116, stroke: rgba(p.accent, 0.6), strokeWidth: 2 },
        T("host", "host", (f.host || f.tagline || "You are invited").toUpperCase(), M * 1.5, ty - 90, tw, "Bebas Neue", "normal", 46, p.accent, { align: "center", letterSpacing: 8 }),
        T("title", "title", title, M * 1.5, ty, tw, "Bebas Neue", "normal", size, p.ink, { align: "center", lineHeight: 0.92, letterSpacing: 4 }),
        { id: "orn", kind: "rect", x: w / 2 - 70, y: ty + th + 34, width: 140, height: 4, fill: p.accent },
        T("date", "date", [f.dateLine, f.timeLine].filter(Boolean).join("  ·  "), M * 1.5, ty + th + 70, tw, "Bebas Neue", "normal", 64, p.accent, { align: "center", letterSpacing: 4 }),
        T("venue", "venue", f.venue, M * 1.5, ty + th + 150, tw, sans, "normal", 34, p.ink, { align: "center" }),
        T("price", "price", f.price, M * 1.5, h - 140, tw, sans, "700", 32, p.muted, { align: "center" })];
    },
  },
  {
    id: "classic", name: "Classic", note: "Photo-led, Playfair title, gold rule", calm: "bottom", treatment: "original",
    build: (c) => {
      const { w, h, f, p } = c;
      const tw = w - M * 2;
      const size = fitText(f.title, "Playfair Display", "700", tw, h * 0.24, { max: 150, lineHeight: 1.02 });
      const th = textHeight(f.title, "Playfair Display", "700", size, tw, 1.02);
      const ty = h - M - 200 - th;
      return [bgRect(c), art(c, 0, 0, w, h, "original"), scrim("scrim", c, h * 0.3, h, 0, 0.96),
        T("date", "date", [f.dateLine, f.timeLine].filter(Boolean).join("  ·  "), M, ty - 64, tw, sans, "700", 30, p.muted, { letterSpacing: 5 }),
        T("title", "title", f.title, M, ty, tw, "Playfair Display", "700", size, p.ink, { lineHeight: 1.02 }),
        { id: "rule", kind: "rect", x: M, y: ty + th + 30, width: 64, height: 6, fill: p.accent },
        T("venue", "venue", f.venue, M, ty + th + 68, tw, sans, "normal", 34, p.ink),
        T("price", "price", f.price, M, h - M - 44, tw, sans, "700", 34, p.accent),
        ...(f.host ? [T("host", "host", f.host, M, h - M - 44, tw, sans, "normal", 30, p.muted, { align: "right" })] : [])];
    },
  },
];

export const ART_STYLES: { id: string; label: string }[] = [
  { id: "film", label: "Film photo" },
  { id: "texture", label: "Textures" },
  { id: "ankara", label: "Ankara print" },
  { id: "abstract", label: "Light and haze" },
  { id: "collage", label: "Paper collage" },
  { id: "minimal", label: "Minimal" },
];
