import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import qrcode from "qrcode-generator";

// Gate codes use an unambiguous alphabet: no 0/O/1/I, so staff can read them
// off a phone screen or a printout without mistaking characters.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTicketCode(): string {
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `BH-${suffix}`;
}

export interface TicketPdfData {
  code: string;
  tierName: string;
  attendeeName: string;
  seat: number;
}

export interface TicketPdfEvent {
  title: string;
  date: Date;
  location: string;
  /** Organizer branding: their name, accent, and custom link replace the platform defaults when set. */
  branding?: { displayName?: string; logoUrl?: string; accentHex?: string; slug?: string } | null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!m) return { r: 0.89, g: 0.698, b: 0.235 }; // brand gold fallback
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// pdf-lib's standard fonts are WinAnsi-only. Thin-space separators keep the
// letter-spaced look without non-Latin glyphs. Names keep ASCII-safe spacing.
function spaced(text: string): string {
  return text.split("").join(" ").replace(/ {3}/g, "  ");
}

function safeText(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\x20-\x7E\n]/g, "");
}

const INK = rgb(0.06, 0.06, 0.07);
const MUTED = rgb(0.45, 0.45, 0.48);
const PAPER = rgb(1, 1, 1);

// Always Lagos time, whatever timezone the server runs in: the VM is UTC and
// getHours() printed a 6pm show as 5pm on the PDF.
function formatEventDate(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      weekday: "long", month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${parts.month} ${parts.day}, ${parts.year} - ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()}`;
}

/**
 * Build a branded PDF with one page per ticket. Single-use codes are drawn
 * large in monospace so gate staff can read or type them without error.
 */
export async function buildTicketPdf(
  tickets: TicketPdfData[],
  event: TicketPdfEvent,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tickets - ${event.title}`);
  pdf.setProducer("BlackHeritage");

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const dateLine = formatEventDate(event.date);
  const eventTitle = safeText(event.title);
  const eventLocation = safeText(event.location);

  // Branding lite: the organizer's display name and accent color take over
  // the header; BlackHeritage stays in the footer as the issuing platform.
  const brandName = safeText(event.branding?.displayName || "BLACKHERITAGE").toUpperCase();
  const accent = hexToRgb(event.branding?.accentHex || "");
  const GOLD = rgb(accent.r, accent.g, accent.b);

  for (const ticket of tickets) {
    const page = pdf.addPage([595, 842]); // A4
    const { width } = page.getSize();

    // Header band
    page.drawRectangle({ x: 0, y: 742, width, height: 100, color: INK });
    // The organizer name owns the header; long names shrink to fit. The code
    // lives in the QR block below, so the header never has to share a line.
    const headerText = spaced(brandName);
    let headerSize = 20;
    while (headerSize > 11 && helvBold.widthOfTextAtSize(headerText, headerSize) > width - 96) headerSize -= 1;
    page.drawText(headerText, {
      x: 48, y: 790, size: headerSize, font: helvBold, color: PAPER, maxWidth: width - 96,
    });
    page.drawText(spaced("EVENT TICKET"), {
      x: 48, y: 768, size: 9, font: helv, color: GOLD,
    });

    // Event block
    page.drawText(eventTitle, {
      x: 48, y: 660, size: 24, font: helvBold, color: INK, maxWidth: width - 96,
    });
    page.drawText(dateLine, { x: 48, y: 628, size: 12, font: helv, color: MUTED });
    page.drawText(eventLocation, {
      x: 48, y: 606, size: 12, font: helv, color: MUTED, maxWidth: width - 96,
    });

    // Gold rule
    page.drawRectangle({ x: 48, y: 575, width: width - 96, height: 2, color: GOLD });

    // Attendee grid
    const rows: [string, string][] = [
      ["ATTENDEE", safeText(ticket.attendeeName) || "Guest"],
      ["TIER", safeText(ticket.tierName)],
      ["SEAT", `Seat ${ticket.seat}`],
    ];
    let y = 540;
    for (const [label, value] of rows) {
      page.drawText(spaced(label), { x: 48, y, size: 8, font: helvBold, color: MUTED });
      page.drawText(value, {
        x: 200, y: y - 2, size: 13, font: helvBold, color: INK, maxWidth: width - 260,
      });
      y -= 42;
    }

    // Code block: the thing the gate verifies. The QR carries the same code
    // the gate camera reads; the printed code is the fallback for typing.
    page.drawRectangle({
      x: 48, y: 250, width: width - 96, height: 170,
      color: rgb(0.97, 0.965, 0.955),
      borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1,
    });
    const qrSize = 140;
    const qrX = 64;
    const qrY = 265;
    page.drawRectangle({ x: qrX, y: qrY, width: qrSize, height: qrSize, color: PAPER });
    const qr = qrcode(0, "M");
    qr.addData(ticket.code, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 2;
    const cell = qrSize / (n + quiet * 2);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        page.drawRectangle({
          x: qrX + (c + quiet) * cell,
          y: qrY + qrSize - (r + quiet + 1) * cell,
          width: cell + 0.2, height: cell + 0.2, color: INK,
        });
      }
    }
    const textX = qrX + qrSize + 28;
    page.drawText(spaced("TICKET CODE"), { x: textX, y: 380, size: 9, font: helvBold, color: MUTED });
    page.drawText(ticket.code, { x: textX, y: 345, size: 26, font: mono, color: INK });
    page.drawText("Show this QR at the gate. One scan per ticket.", { x: textX, y: 312, size: 10, font: helv, color: MUTED });
    page.drawText("No camera? Staff can type the code.", { x: textX, y: 294, size: 10, font: helv, color: MUTED });

    // Footer: platform credit survives any organizer branding
    const footerText = event.branding?.displayName
      ? `Tickets for ${safeText(event.branding.displayName)} by Black Heritage - blackhevents.com. Keep this until the event ends.`
      : "Issued by Black Heritage - blackhevents.com. Keep this until the event ends.";
    page.drawText(footerText, { x: 48, y: 60, size: 9, font: helv, color: MUTED });

    if (event.branding?.slug) {
      page.drawText(`Organizer Hub: blackhevents.com/o/${event.branding.slug}`, {
        x: 48, y: 46, size: 8, font: mono, color: GOLD,
      });
    }
  }

  return pdf.save();
}
