import { drawQRCode } from "./qr";

export type FlyerFormat = "story" | "square"; // 9:16 (1080x1920) or 1:1 (1080x1080)
export type FlyerTheme = "midnight" | "stage" | "editorial" | "vibrant";
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

/**
 * Text wrapping utility for HTML5 canvas.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      lineCount++;
      if (lineCount >= maxLines) {
        // Truncate with ellipsis
        ctx.fillText(line.trim() + "…", x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

/** Centered multi-line title. Returns the y below the last line. */
function wrapCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
): number {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const test = line + words[n] + " ";
    if (ctx.measureText(test).width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + " ";
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  const visible = lines.slice(0, maxLines);
  visible.forEach((l, i) => {
    if (i === maxLines - 1 && lines.length > maxLines) {
      ctx.fillText(l + "…", cx, y + i * lineHeight);
    } else {
      ctx.fillText(l, cx, y + i * lineHeight);
    }
  });
  return y + visible.length * lineHeight;
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
  opts?: { font?: string; fill?: string; textColor?: string; padX?: number; height?: number; radius?: number; borderColor?: string }
): number {
  const font = opts?.font ?? "600 24px 'DM Sans', sans-serif";
  const padX = opts?.padX ?? 24;
  const h = opts?.height ?? 44;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = opts?.fill ?? "rgba(15, 15, 20, 0.75)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, opts?.radius ?? h / 2);
  ctx.fill();
  ctx.strokeStyle = opts?.borderColor ?? style.badgeBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = opts?.textColor ?? accent;
  ctx.fillText(text, cx, cy + 1);
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

  // 3. Cinematic gradients & shadows
  ctx.save();
  const topScrim = ctx.createLinearGradient(0, 0, 0, 320);
  topScrim.addColorStop(0, "rgba(5, 5, 8, 0.85)");
  topScrim.addColorStop(0.6, "rgba(5, 5, 8, 0.4)");
  topScrim.addColorStop(1, "transparent");
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, width, 320);

  const bottomGradientHeight = isStory ? 1050 : 720;
  const bottomGrad = ctx.createLinearGradient(0, height - bottomGradientHeight, 0, height);
  bottomGrad.addColorStop(0, "transparent");
  bottomGrad.addColorStop(0.25, "rgba(8, 8, 12, 0.75)");
  bottomGrad.addColorStop(0.55, style.bgBase + "FA");
  bottomGrad.addColorStop(1, style.bgBase);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - bottomGradientHeight, width, bottomGradientHeight);

  const radialVignette = ctx.createRadialGradient(
    width / 2, height / 2, width * 0.4,
    width / 2, height / 2, width * 0.9
  );
  radialVignette.addColorStop(0, "transparent");
  radialVignette.addColorStop(1, "rgba(0, 0, 0, 0.65)");
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

  ctx.fillStyle = "rgba(15, 15, 20, 0.75)";
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

  // 7. Event details block
  const paddingX = frameInset + (isStory ? 54 : 44);
  const contentWidth = width - paddingX * 2;
  const footerH = options.showQr ? (isStory ? 240 : 180) : isStory ? 140 : 100;
  const bottomAnchor = height - frameInset - footerH;
  const parts = eventDateParts(options.date);

  ctx.save();
  ctx.textAlign = "left";

  let currentY = isStory ? bottomAnchor - 380 : bottomAnchor - 280;

  const eyebrowText = options.organizerName
    ? options.organizerName.toUpperCase()
    : "LIVE EVENT";
  ctx.font = "700 20px 'DM Sans', sans-serif";
  ctx.fillStyle = accent;
  ctx.letterSpacing = "2px";
  ctx.fillText(eyebrowText, paddingX, currentY);
  currentY += 36;

  ctx.font = "800 68px 'Playfair Display', serif";
  if (!isStory) {
    ctx.font = "800 56px 'Playfair Display', serif";
  }
  ctx.fillStyle = style.textPrimary;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  currentY = wrapText(ctx, options.title, paddingX, currentY, contentWidth, isStory ? 80 : 66, isStory ? 3 : 2);

  ctx.shadowColor = "transparent";
  ctx.fillStyle = accent;
  ctx.fillRect(paddingX, currentY + 4, 80, 4);
  currentY += 36;

  ctx.font = "600 28px 'DM Sans', sans-serif";
  ctx.fillStyle = style.textPrimary;
  const dateFormatted = `${parts.dayName}, ${parts.dateStr}${parts.timeStr ? ` • ${parts.timeStr}` : ""}`;
  ctx.fillText(dateFormatted, paddingX, currentY);
  currentY += 38;

  if (options.showLocation !== false && options.location) {
    ctx.font = "400 25px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textMuted;
    const locMetrics = ctx.measureText(options.location);
    if (locMetrics.width > contentWidth) {
      wrapText(ctx, options.location, paddingX, currentY, contentWidth, 32, 1);
    } else {
      ctx.fillText(options.location, paddingX, currentY);
    }
    currentY += 38;
  }

  if (options.showPrice && options.price) {
    const priceText = options.price.toUpperCase();
    ctx.font = "700 22px 'DM Sans', sans-serif";
    const priceW = ctx.measureText(priceText).width + 36;
    const priceH = 40;

    ctx.fillStyle = "rgba(227, 178, 60, 0.15)";
    ctx.beginPath();
    ctx.roundRect(paddingX, currentY, priceW, priceH, 6);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.fillText(priceText, paddingX + 18, currentY + 26);
    currentY += 56;
  }

  if (options.isAttendeePass && options.attendeeName) {
    const cardY = currentY + 10;
    const cardH = isStory ? 100 : 80;

    ctx.fillStyle = "rgba(25, 25, 31, 0.85)";
    ctx.beginPath();
    ctx.roundRect(paddingX, cardY, contentWidth, cardH, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(227, 178, 60, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "600 18px 'DM Sans', sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText("TICKET HOLDER", paddingX + 24, cardY + 30);

    ctx.font = "700 28px 'DM Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(options.attendeeName, paddingX + 24, cardY + 68);

    if (options.ticketTier) {
      ctx.textAlign = "right";
      ctx.font = "600 18px 'DM Sans', sans-serif";
      ctx.fillStyle = style.textMuted;
      ctx.fillText("TIER", paddingX + contentWidth - 24, cardY + 30);

      ctx.font = "700 24px 'DM Sans', sans-serif";
      ctx.fillStyle = accent;
      ctx.fillText(options.ticketTier, paddingX + contentWidth - 24, cardY + 68);
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
  ctx.textBaseline = "middle";
  ctx.font = "700 22px 'DM Sans', sans-serif";
  ctx.fillStyle = accent;
  ctx.letterSpacing = "6px";
  ctx.fillText("THE ANNOUNCEMENT", width / 2, eyebrowY);
  ctx.letterSpacing = "0px";

  // Title, big and centered
  ctx.font = `800 ${isStory ? 96 : 68}px 'Playfair Display', serif`;
  ctx.fillStyle = style.textPrimary;
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 18;
  const titleY = eyebrowY + (isStory ? 90 : 74);
  const titleEnd = wrapCentered(ctx, options.title || "Something Is Coming", width / 2, titleY, contentWidth, isStory ? 108 : 80, isStory ? 3 : 2);
  ctx.shadowColor = "transparent";

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
    wrapCentered(ctx, teaserText, width / 2, belowRule, contentWidth, isStory ? 40 : 36, 2);
    ctx.restore();
    belowRule += isStory ? 90 : 76;
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
      { fill: style.badgeBg, borderColor: accent, textColor: accent, font: "700 24px 'DM Sans', sans-serif", height: 52, padX: 32 }
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
      { fill: "rgba(15,15,20,0.75)", textColor: style.textPrimary, font: "600 22px 'DM Sans', sans-serif", height: 46 }
    );
  }

  // Footer: follow CTA with optional QR
  const footerY = height - frameInset - (isStory ? 150 : 110);
  if (options.showQr && options.qrUrl) {
    const qrSize = isStory ? 130 : 100;
    const qrY = footerY;
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

  // Title
  const titleY = pillY + (isStory ? 92 : 76);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${isStory ? 76 : 58}px 'Playfair Display', serif`;
  ctx.fillStyle = style.textPrimary;
  const titleEnd = wrapCentered(ctx, options.title || "A Private Gathering", width / 2, titleY, contentWidth, isStory ? 88 : 68, 2);
  ctx.restore();

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

  // QR to the gated link
  if (options.showQr && options.qrUrl) {
    const qrSize = isStory ? 140 : 110;
    const qrY = height - frameInset - (isStory ? 250 : 200);
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

  // Portrait: photo in a rounded window, or a monogram seal
  const photoY = frameInset + (isStory ? 130 : 104);
  const photoH = isStory ? height * 0.34 : height * 0.36;
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

  // Name
  const nameY = photoY + photoH + (isStory ? 92 : 84);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${isStory ? 68 : 60}px 'Playfair Display', serif`;
  ctx.fillStyle = style.textPrimary;
  const nameEnd = wrapCentered(ctx, options.title, width / 2, nameY, contentWidth, isStory ? 80 : 72, 2);
  ctx.restore();

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
      { fill: style.badgeBg, borderColor: accent, font: "700 22px 'DM Sans', sans-serif", height: 46 }
    );
    belowName += 92;
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

  // CTA pill + link
  const ctaY = height - frameInset - (options.showQr && options.qrUrl ? (isStory ? 330 : 250) : (isStory ? 150 : 120));
  drawPill(
    ctx,
    "BOOK ME ON BLACK HERITAGE",
    width / 2,
    ctaY,
    style,
    accent,
    { fill: accent, borderColor: accent, textColor: "#0B0B0E", font: "800 24px 'DM Sans', sans-serif", height: 56, padX: 36 }
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

  const style = THEME_STYLES[options.theme] || THEME_STYLES.midnight;
  const accent = options.accentColor || style.accent;
  const frameInset = isStory ? 54 : 44;

  // Presets that draw a photo need it decoded before layout math runs.
  const studioOpts = options as CreativeStudioOptions;
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
