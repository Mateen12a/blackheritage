import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
  /** Organizer branding: their name and accent replace the platform defaults when set. */
  branding?: { displayName?: string; logoUrl?: string; accentHex?: string } | null;
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

function formatEventDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h = date.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} - ${hour12}:${minutes} ${ampm}`;
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
    page.drawText(spaced(brandName), {
      x: 48, y: 790, size: 20, font: helvBold, color: PAPER,
    });
    page.drawText(spaced("EVENT TICKET"), {
      x: 48, y: 768, size: 9, font: helv, color: GOLD,
    });
    page.drawText(ticket.code, {
      x: width - 48 - mono.widthOfTextAtSize(ticket.code, 12),
      y: 788, size: 12, font: mono, color: GOLD,
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

    // Code block: the thing the gate verifies
    page.drawRectangle({
      x: 48, y: 250, width: width - 96, height: 170,
      color: rgb(0.97, 0.965, 0.955),
      borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1,
    });
    page.drawText(spaced("TICKET CODE"), {
      x: width / 2 - mono.widthOfTextAtSize("TICKET CODE", 9) / 2,
      y: 388, size: 9, font: helvBold, color: MUTED,
    });
    page.drawText(ticket.code, {
      x: width / 2 - mono.widthOfTextAtSize(ticket.code, 30) / 2,
      y: 340, size: 30, font: mono, color: INK,
    });
    page.drawText("Present this code at the gate. One scan per ticket.", {
      x: width / 2 - helv.widthOfTextAtSize("Present this code at the gate. One scan per ticket.", 10) / 2,
      y: 305, size: 10, font: helv, color: MUTED,
    });
    page.drawText("Each code is single-use and tied to this ticket only.", {
      x: width / 2 - helv.widthOfTextAtSize("Each code is single-use and tied to this ticket only.", 10) / 2,
      y: 285, size: 10, font: helv, color: MUTED,
    });

    // Footer: platform credit survives any organizer branding
    page.drawText(
      event.branding?.displayName
        ? `This ticket was issued via BlackHeritage for ${safeText(event.branding.displayName)}. Keep it until the event ends.`
        : "This ticket was issued by BlackHeritage. Keep it until the event ends.",
      { x: 48, y: 60, size: 9, font: helv, color: MUTED },
    );
  }

  return pdf.save();
}
