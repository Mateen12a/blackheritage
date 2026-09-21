import { drawQRCode } from "./qr";

export type FlyerFormat = "story" | "square"; // 9:16 (1080x1920) or 1:1 (1080x1080)
export type FlyerTheme = "midnight" | "stage" | "editorial" | "vibrant";

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

/**
 * Renders the entire flyer directly to the provided HTML5 Canvas element.
 */
export async function renderFlyerToCanvas(
  canvas: HTMLCanvasElement,
  options: FlyerOptions
): Promise<void> {
  // Ensure fonts are ready
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Font loading failure fallback to system serif/sans
    }
  }

  const isStory = options.format === "story";
  const width = 1080;
  const height = isStory ? 1920 : 1080;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const style = THEME_STYLES[options.theme] || THEME_STYLES.midnight;
  const accent = options.accentColor || style.accent;

  // 1. Draw solid background
  ctx.fillStyle = style.bgBase;
  ctx.fillRect(0, 0, width, height);

  // 2. Render Hero/Flyer Artwork if available
  const imageSource = options.customImageDataUrl || options.imageUrl;
  if (imageSource) {
    const img = await loadImage(imageSource);
    if (img) {
      ctx.save();
      // Draw image in cover mode taking up upper 65% for story or full background for square
      const imgTargetHeight = isStory ? height * 0.72 : height * 0.85;
      const imgRatio = img.width / img.height;
      const targetRatio = width / imgTargetHeight;

      let sx = 0;
      let sy = 0;
      let sWidth = img.width;
      let sHeight = img.height;

      if (imgRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
      } else {
        sHeight = img.width / targetRatio;
        sy = (img.height - sHeight) / 2;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, imgTargetHeight);
      ctx.restore();
    }
  } else {
    // Elegant geometric / ambient background if no image
    const ambientGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.35,
      100,
      width * 0.5,
      height * 0.35,
      width * 0.7
    );
    ambientGrad.addColorStop(0, style.accentGlow);
    ambientGrad.addColorStop(1, "transparent");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // 3. Cinematic Gradients & Shadows for high contrast text readability
  ctx.save();
  // Top subtle scrim
  const topScrim = ctx.createLinearGradient(0, 0, 0, 320);
  topScrim.addColorStop(0, "rgba(5, 5, 8, 0.85)");
  topScrim.addColorStop(0.6, "rgba(5, 5, 8, 0.4)");
  topScrim.addColorStop(1, "transparent");
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, width, 320);

  // Bottom text darkening gradient
  const bottomGradientHeight = isStory ? 1050 : 720;
  const bottomGrad = ctx.createLinearGradient(0, height - bottomGradientHeight, 0, height);
  bottomGrad.addColorStop(0, "transparent");
  bottomGrad.addColorStop(0.25, "rgba(8, 8, 12, 0.75)");
  bottomGrad.addColorStop(0.55, style.bgBase + "FA");
  bottomGrad.addColorStop(1, style.bgBase);
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - bottomGradientHeight, width, bottomGradientHeight);

  // Vignette edges
  const radialVignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    width * 0.4,
    width / 2,
    height / 2,
    width * 0.9
  );
  radialVignette.addColorStop(0, "transparent");
  radialVignette.addColorStop(1, "rgba(0, 0, 0, 0.65)");
  ctx.fillStyle = radialVignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 4. Double-Bezel Architectural Inset Frame
  const frameInset = isStory ? 54 : 44;
  ctx.save();
  ctx.strokeStyle = style.frameColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(frameInset, frameInset, width - frameInset * 2, height - frameInset * 2);

  // Corner decorative marks
  const cornerLen = 24;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(frameInset - 1, frameInset + cornerLen);
  ctx.lineTo(frameInset - 1, frameInset - 1);
  ctx.lineTo(frameInset + cornerLen, frameInset - 1);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(width - frameInset + 1 - cornerLen, frameInset - 1);
  ctx.lineTo(width - frameInset + 1, frameInset - 1);
  ctx.lineTo(width - frameInset + 1, frameInset + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(frameInset - 1, height - frameInset - cornerLen);
  ctx.lineTo(frameInset - 1, height - frameInset + 1);
  ctx.lineTo(frameInset + cornerLen, height - frameInset + 1);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(width - frameInset + 1 - cornerLen, height - frameInset + 1);
  ctx.lineTo(width - frameInset + 1, height - frameInset + 1);
  ctx.lineTo(width - frameInset + 1, height - frameInset - cornerLen);
  ctx.stroke();
  ctx.restore();

  // 5. Header / Brand Mark
  const headerY = frameInset + (isStory ? 70 : 56);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const presenterText = options.organizerName
    ? `${options.organizerName.toUpperCase()} PRESENTS`
    : "BLACK HERITAGE • LAGOS";

  // Pill badge background for presenter
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

  // 6. Attendee Pass Stamp (if attendee mode)
  if (options.isAttendeePass) {
    const stampY = headerY + 70;
    ctx.save();
    ctx.textAlign = "center";
    const passTag = "ATTENDEE PASS";
    ctx.font = "700 20px 'DM Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";

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

  // 7. Event Details Block (Bottom Half)
  const paddingX = frameInset + (isStory ? 54 : 44);
  const contentWidth = width - paddingX * 2;

  // Let's compute vertical anchor from bottom
  const footerH = options.showQr ? (isStory ? 240 : 180) : isStory ? 140 : 100;
  const bottomAnchor = height - frameInset - footerH;

  // Date formatting
  const eventDate = new Date(options.date);
  const dayName = isNaN(eventDate.getTime())
    ? "UPCOMING"
    : eventDate.toLocaleDateString("en-NG", { weekday: "long" }).toUpperCase();
  const dateStr = isNaN(eventDate.getTime())
    ? ""
    : eventDate.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).toUpperCase();
  const timeStr = isNaN(eventDate.getTime())
    ? ""
    : eventDate.toLocaleTimeString("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toUpperCase();

  // Draw Title & Metadata
  ctx.save();
  ctx.textAlign = "left";

  // Category or Eyebrow above title
  let currentY = isStory ? bottomAnchor - 380 : bottomAnchor - 280;

  // Eyebrow
  const eyebrowText = options.organizerName
    ? options.organizerName.toUpperCase()
    : "LIVE EVENT";
  ctx.font = "700 20px 'DM Sans', sans-serif";
  ctx.fillStyle = accent;
  ctx.letterSpacing = "2px";
  ctx.fillText(eyebrowText, paddingX, currentY);
  currentY += 36;

  // Title
  ctx.font = "800 68px 'Playfair Display', serif";
  if (!isStory) {
    ctx.font = "800 56px 'Playfair Display', serif";
  }
  ctx.fillStyle = style.textPrimary;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  currentY = wrapText(ctx, options.title, paddingX, currentY, contentWidth, isStory ? 80 : 66, isStory ? 3 : 2);

  // Gold accent rule line
  ctx.shadowColor = "transparent";
  ctx.fillStyle = accent;
  ctx.fillRect(paddingX, currentY + 4, 80, 4);
  currentY += 36;

  // Date & Time line
  ctx.font = "600 28px 'DM Sans', sans-serif";
  ctx.fillStyle = style.textPrimary;
  const dateFormatted = `${dayName}, ${dateStr}${timeStr ? ` • ${timeStr}` : ""}`;
  ctx.fillText(dateFormatted, paddingX, currentY);
  currentY += 38;

  // Location line
  if (options.showLocation !== false && options.location) {
    ctx.font = "400 25px 'DM Sans', sans-serif";
    ctx.fillStyle = style.textMuted;
    const locMetrics = ctx.measureText(options.location);
    if (locMetrics.width > contentWidth) {
      // Truncate if location is very long
      wrapText(ctx, options.location, paddingX, currentY, contentWidth, 32, 1);
    } else {
      ctx.fillText(options.location, paddingX, currentY);
    }
    currentY += 38;
  }

  // Price & Ticket Status Pill (optional)
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

  // Attendee Pass Personalized Card
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

    // Attendee label & name
    ctx.font = "600 18px 'DM Sans', sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText("TICKET HOLDER", paddingX + 24, cardY + 30);

    ctx.font = "700 28px 'DM Sans', sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(options.attendeeName, paddingX + 24, cardY + 68);

    // Tier badge on right side of card
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

  // 8. Footer Section with Scannable QR Code & Canonical URL
  const footerY = height - frameInset - (isStory ? 180 : 140);

  if (options.showQr && options.qrUrl) {
    const qrSize = isStory ? 140 : 110;
    const qrX = paddingX;
    const qrY = footerY;

    // QR container background
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();

    // Draw QR Code
    drawQRCode(ctx, options.qrUrl, qrX, qrY, qrSize, {
      darkColor: "#0B0B0F",
      lightColor: "#FFFFFF",
      margin: 1,
      rounded: false,
    });

    // Callout text next to QR
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
    // Minimal footer bar with brand and website
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
