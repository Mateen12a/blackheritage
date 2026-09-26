import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

/**
 * The gate-fraud playbook, generated on demand.
 *
 * It lives in code, not in a static file, so the copy can be edited in one
 * place and there is never a stale PDF floating around. pdf-lib's standard
 * fonts cover WinAnsi only: keep the text ASCII (no naira sign, no em dashes).
 */

const GOLD = rgb(0.89, 0.698, 0.235);
const INK = rgb(0.07, 0.07, 0.08);
const MUTED = rgb(0.42, 0.42, 0.44);
const HAIRLINE = rgb(0.87, 0.86, 0.84);
const PAPER = rgb(0.98, 0.975, 0.965);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const PROMO_CODE = "FOUNDER100";

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  oblique: PDFFont;
}

class Layout {
  private doc: PDFDocument;
  private fonts: Fonts;
  private page: PDFPage;
  private y = 0;
  /** Baseline of the last text drawn. Null after a break or a separator. */
  private lastBaseline: number | null = null;

  constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  /**
   * A fresh page, with the running header the cover does not need.
   *
   * The header sits in its own band so a long section spilling over never
   * collides with the page furniture.
   */
  private newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    const top = PAGE_H - 50;
    this.page.drawText("BLACK HERITAGE EVENTS", {
      x: MARGIN,
      y: top,
      size: 8,
      font: this.fonts.bold,
      color: GOLD,
    });
    const label = "The gate-fraud playbook";
    const labelWidth = this.fonts.regular.widthOfTextAtSize(label, 8);
    this.page.drawText(label, {
      x: PAGE_W - MARGIN - labelWidth,
      y: top,
      size: 8,
      font: this.fonts.regular,
      color: MUTED,
    });
    this.page.drawLine({
      start: { x: MARGIN, y: top - 11 },
      end: { x: PAGE_W - MARGIN, y: top - 11 },
      thickness: 0.7,
      color: HAIRLINE,
    });
    this.y = top - 38;
    this.lastBaseline = null;
  }

  private ensure(space: number) {
    if (this.y - space < MARGIN + 28) this.newPage();
  }

  /**
   * Keep the next baseline clear of the previous one's type.
   *
   * This is what broke the old header: the eyebrow stepped down a fixed
   * 16pt, then a 26pt title was drawn on that baseline, so the title's
   * ascenders ran through the gold label. Reserving room for the size about
   * to be drawn fixes every pairing, not just that one.
   */
  private clearAscent(size: number) {
    if (this.lastBaseline === null) return;
    const minGap = size * 0.78 + 5;
    if (this.lastBaseline - this.y < minGap) this.y = this.lastBaseline - minGap;
  }

  /** Draw one line on the current baseline, then step down by the leading. */
  private line(
    text: string,
    x: number,
    size: number,
    font: PDFFont,
    color: RGB,
    leading: number,
  ) {
    this.clearAscent(size);
    this.page.drawText(text, { x, y: this.y, size, font, color });
    this.lastBaseline = this.y;
    this.y -= leading;
  }

  /** Page one: a full-bleed band, sized to the text it holds. */
  cover(eyebrow: string, title: string, subtitle: string) {
    const titleLines = wrapText(title, this.fonts.bold, 27, CONTENT_W);
    const subLines = wrapText(subtitle, this.fonts.oblique, 12.5, CONTENT_W - 20);
    const bandHeight = 54 + 30 + titleLines.length * 34 + 20 + subLines.length * 18 + 40;

    this.page.drawRectangle({
      x: 0,
      y: PAGE_H - bandHeight,
      width: PAGE_W,
      height: bandHeight,
      color: INK,
    });
    // Gold hairline along the bottom edge of the band.
    this.page.drawRectangle({
      x: 0,
      y: PAGE_H - bandHeight,
      width: PAGE_W,
      height: 2.5,
      color: GOLD,
    });

    let cursor = PAGE_H - 54;
    this.page.drawText(eyebrow.toUpperCase(), {
      x: MARGIN,
      y: cursor,
      size: 8.5,
      font: this.fonts.bold,
      color: GOLD,
    });
    cursor -= 30;
    for (const line of titleLines) {
      this.page.drawText(line, {
        x: MARGIN,
        y: cursor,
        size: 27,
        font: this.fonts.bold,
        color: rgb(1, 1, 1),
      });
      cursor -= 34;
    }
    cursor -= 20;
    for (const line of subLines) {
      this.page.drawText(line, {
        x: MARGIN,
        y: cursor,
        size: 12.5,
        font: this.fonts.oblique,
        color: rgb(0.76, 0.75, 0.73),
      });
      cursor -= 18;
    }

    // The body starts clear of the band.
    this.y = PAGE_H - bandHeight - 38;
    this.lastBaseline = null;
  }

  gap(px: number) {
    this.y -= px;
  }

  rule() {
    this.ensure(14);
    this.y -= 8;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.7,
      color: HAIRLINE,
    });
    this.y -= 14;
    this.lastBaseline = null;
  }

  eyebrow(text: string) {
    this.ensure(20);
    this.line(text.toUpperCase(), MARGIN, 8.5, this.fonts.bold, GOLD, 16);
  }

  title(text: string) {
    const lines = wrapText(text, this.fonts.bold, 26, CONTENT_W);
    this.ensure(lines.length * 32 + 8);
    for (const item of lines) {
      this.line(item, MARGIN, 26, this.fonts.bold, INK, 32);
    }
  }

  subtitle(text: string) {
    const lines = wrapText(text, this.fonts.regular, 12.5, CONTENT_W);
    this.ensure(lines.length * 18 + 10);
    for (const item of lines) {
      this.line(item, MARGIN, 12.5, this.fonts.regular, MUTED, 18);
    }
    this.y -= 6;
  }

  heading(text: string) {
    const lines = wrapText(text, this.fonts.bold, 15, CONTENT_W);
    this.ensure(lines.length * 21 + 22);
    this.y -= 10;
    for (const item of lines) {
      this.line(item, MARGIN, 15, this.fonts.bold, INK, 21);
    }
    this.y -= 4;
  }

  body(text: string, size = 10.5) {
    const lines = wrapText(text, this.fonts.regular, size, CONTENT_W);
    for (const item of lines) {
      this.ensure(size + 8);
      this.line(item, MARGIN, size, this.fonts.regular, INK, size + 5);
    }
    this.y -= 6;
  }

  /** Numbered item: bold label, then the instructions under it. */
  numbered(index: number, label: string, detail: string) {
    const indent = 24;
    const labelLines = wrapText(label, this.fonts.bold, 11, CONTENT_W - indent);
    const detailLines = wrapText(detail, this.fonts.regular, 10.5, CONTENT_W - indent);
    this.ensure(labelLines.length * 15 + detailLines.length * 15 + 12);

    const startY = this.y;
    this.page.drawText(String(index).padStart(2, "0"), {
      x: MARGIN,
      y: startY,
      size: 11,
      font: this.fonts.bold,
      color: GOLD,
    });

    for (const item of labelLines) {
      this.line(item, MARGIN + indent, 11, this.fonts.bold, INK, 15);
    }
    for (const item of detailLines) {
      this.ensure(15);
      this.line(item, MARGIN + indent, 10.5, this.fonts.regular, MUTED, 15);
    }
    this.y -= 10;
  }

  bullet(text: string) {
    const indent = 16;
    const lines = wrapText(text, this.fonts.regular, 10.5, CONTENT_W - indent);
    this.ensure(lines.length * 15 + 4);
    lines.forEach((item, i) => {
      this.ensure(15);
      const bulletY = this.y;
      this.line(item, MARGIN + indent, 10.5, this.fonts.regular, INK, 15);
      if (i === 0) {
        this.page.drawCircle({ x: MARGIN + 3, y: bulletY + 3.5, size: 1.7, color: GOLD });
      }
    });
    this.y -= 6;
  }

  /** Boxed callout, used once for the voucher. */
  callout(label: string, value: string, detail: string) {
    const detailLines = wrapText(detail, this.fonts.regular, 10, CONTENT_W - 40);
    const height = 60 + detailLines.length * 15;
    this.ensure(height + 16);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: CONTENT_W,
      height,
      color: PAPER,
      borderColor: GOLD,
      borderWidth: 1,
    });
    this.page.drawText(label.toUpperCase(), {
      x: MARGIN + 20,
      y: top - 24,
      size: 8.5,
      font: this.fonts.bold,
      color: MUTED,
    });
    this.page.drawText(value, {
      x: MARGIN + 20,
      y: top - 48,
      size: 20,
      font: this.fonts.bold,
      color: INK,
    });
    let cursor = top - 68;
    for (const line of detailLines) {
      this.page.drawText(line, { x: MARGIN + 20, y: cursor, size: 10, font: this.fonts.regular, color: MUTED });
      cursor -= 15;
    }
    this.y = top - height - 18;
    this.lastBaseline = null;
  }

  footer() {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      page.drawLine({
        start: { x: MARGIN, y: MARGIN - 4 },
        end: { x: PAGE_W - MARGIN, y: MARGIN - 4 },
        thickness: 0.7,
        color: HAIRLINE,
      });
      const text = `Black Heritage Events  |  blackhevents.com  |  page ${i + 1} of ${pages.length}`;
      page.drawText(text, {
        x: MARGIN,
        y: MARGIN - 16,
        size: 8,
        font: this.fonts.regular,
        color: MUTED,
      });
    });
  }
}

const CHECKLIST: Array<[string, string]> = [
  ["One person scans, everyone else watches.", "The person holding the phone should not also be taking money, checking the guest list, or answering questions. Split those jobs. A distracted scanner is the single most common reason a used ticket walks back in."],
  ["Two staff on the door at minimum, neither of them selling.", "The gate and the till are separate posts. The moment one person does both, nobody can tell which ticket was scanned and which was paid for in cash."],
  ["Scan every ticket, including the ones you know.", "Friends, regulars, your own DJ's manager. If the rule has exceptions on paper, your staff will invent exceptions at 1am. Scan first, greet after."],
  ["No screenshots.", "A pass that arrives as an image proves nothing. Ask the buyer to open the ticket in WhatsApp or their tickets page and let you scan that. The QR is tied to one ticket and works once."],
  ["Charge everything, and bring a power bank.", "A dead phone at the door means an open door. Two charged phones, one power bank, one spare cable. Offline mode keeps scanning when the network dies, so the only real failure is a flat battery."],
  ["Walk the line before the doors open.", "Thirty minutes early: who is on which lane, where refunds and disputes go, who your staff call when someone insists. Say the names out loud. Written instructions do not get read at the door."],
  ["Two lanes: pre-checked and general.", "Tables, VIP and guest-list names get a lane with a printed list and a person who knows the list. Mixing them into the general queue is how you lose your own comps."],
  ["Wristbands for re-entry, never the QR again.", "A ticket that scans twice looks like fraud to the scanner. Wristband on entry if people are stepping out for air, food, or the ATM."],
  ["Count as you go, not at the end.", "Total entries against scanned tickets, once an hour. A gap of five is a coaching conversation. A gap of fifty at midnight is a lost night's revenue you cannot recover."],
  ["Log every override in one place.", "Name, time, ticket code, reason. This is the only way to tell an honest exception from a pattern of them. Keep the log where the organizer can read it the same night."],
  ["One number for staff to call.", "Disputes get solved by one person, not by whoever is loudest. Brief that person in advance and make sure they are reachable and sober."],
  ["Close the gate properly.", "Last hour: one door, one scanner, and the money counted before staff go home. Most of the cash that goes missing disappears in the last thirty minutes, when everyone is tired and the count is rushed."],
];

const FRAUD_PLAYS: Array<[string, string]> = [
  ["The forwarded screenshot.", "One buyer shares their QR image with three friends. Stopped by scanning from the live ticket only, plus single-use codes: the second scan reads as already used, and the scanner says so out loud."],
  ["The edited screenshot.", "A general ticket is edited into a table tier in any free photo app. Stopped by checking tiers against the scanner rather than the image, and by knowing your table count before doors open."],
  ["The network excuse.", "Someone insists the ticket will not load because the network is down, and asks to explain it to you in person. Stopped by offline scanning: your gate works without data, so there is no reason to accept a story."],
  ["The borrowed real ticket.", "A legitimate ticket, bought by someone else, presented by whoever holds the phone first. Stopped by name checks on higher tiers and by treating a ticket transfer as a favour you did not agree to."],
  ["The quiet cash sale.", "A staff member takes cash at the door, pockets it, and waves the guest through with no scan. Stopped by separating gate from till, hourly counts, and paying gate staff properly so the risk is not worth it."],
  ["The after-hours re-entry.", "The same QR comes back in at 2am after the scanners have been put away. Stopped by one door, one scanner, and wristbands for anyone leaving."],
];

async function build(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  doc.setTitle("The gate-fraud playbook");
  doc.setAuthor("Black Heritage Events");
  doc.setSubject("How Nigerian promoters run the door");

  const L = new Layout(doc, fonts);

  L.cover(
    "Black Heritage Events",
    "The gate-fraud playbook",
    "How Nigerian promoters run the door, written for the people standing at it.",
  );
  L.body(
    "Most ticket fraud never touches your website. It happens in the twenty metres between the road and the gate, in the three minutes when the crowd pushes and your staff stop looking properly.",
  );
  L.body(
    "This is the procedure we hand to promoters selling on Black Heritage: the gate checklist, the six plays you will actually see at a Nigerian venue, the sponsor pitch outline, and the numbers worth writing down after every show.",
  );
  L.body("None of it needs new software. It needs a door policy your staff can follow when they are tired.");

  L.heading("What you are actually protecting");
  L.body(
    "Gate fraud costs you twice. Once in the ticket that never got scanned, and again when the same crowd pays you less next year because word got round that your door is soft.",
  );
  L.body("Three things go wrong at once when the gate leaks:");
  L.bullet("You lose revenue from tickets that were sold and then reused.");
  L.bullet("Your scanned numbers stop matching your sales, so you cannot plan staffing or next year's capacity.");
  L.bullet("Sponsors and vendors stop trusting your attendance figures, which is the number your pitch depends on.");

  L.heading("The 12-point gate checklist");
  L.body("Print it, hand it to your gate lead, and walk it once before doors open.");
  CHECKLIST.forEach(([label, detail], i) => L.numbered(i + 1, label, detail));

  L.heading("The six plays, and what stops them");
  FRAUD_PLAYS.forEach(([label, detail], i) => L.numbered(i + 1, label, detail));

  L.heading("The sponsor pitch outline");
  L.body(
    "Brands are not buying goodwill. They are buying a crowd, a photograph, and a story their marketing team can send upward. Give them all three in one short document.",
  );
  L.bullet("One page of numbers: attendance at your last two shows, ticket price range, and how many people actually came through the gate.");
  L.bullet("Who the crowd is: age range, where they live, what they spend on. If you do not know, ask at the door with a two-question form.");
  L.bullet("What the brand gets: stage backdrop, banner placement, cups, artist mentions, a branded photo moment, tagged posts.");
  L.bullet("What you need from them: money, product, or an activation team, with a figure next to each.");
  L.bullet("Production deadlines spelled out: artwork cut-off, banner printing lead time, when the payment lands relative to the flyer launch.");
  L.bullet("Alcohol brands usually want sampling, brand ambassadors and a responsible-drinking policy. Say yes to what you can run properly.");
  L.bullet("Banks usually want account sign-ups and on-site activations. Do not promise customer data you are not allowed to hand over.");

  L.heading("Numbers worth writing down after every show");
  L.body("Tickets sold against tickets scanned is your fraud alarm. Everything else tells you what to change next time.");
  L.bullet("Tickets sold, tickets scanned, and the gap between them. The gap is fraud plus no-shows, and you should know which.");
  L.bullet("Comps issued against comps scanned. Guest lists leak quietly.");
  L.bullet("Average ticket price, and how much of the total came from your top tier.");
  L.bullet("Refunds and chargebacks, with a reason next to each one.");
  L.bullet("Staff on the gate, and incidents logged. Staffing and incidents move together.");
  L.body("Keep the same sheet for every show. Two shows of history makes the third one predictable.");

  L.heading("Your code");
  L.callout(
    "Founder voucher",
    PROMO_CODE,
    "Waives the Black Heritage platform fee on your first 100 paid tickets. Enter it when you create your organizer account.",
  );
  L.body(
    "Your payment processor's own charge still applies, and the code covers paid tickets only. Comps, sponsor bands and guest lists already carry no platform fee.",
  );
  L.body("Questions about your gate setup? Reply to the email this came from. A person reads it.");

  L.footer();
  return doc.save();
}

let cached: Promise<Uint8Array> | null = null;

/** Memoized: the document is static, so build it once per process. */
export function playbookPdf(): Promise<Uint8Array> {
  if (!cached) {
    cached = build().catch((err) => {
      cached = null; // let the next request retry instead of caching a failure
      throw err;
    });
  }
  return cached;
}

export const PLAYBOOK_FILENAME = "black-heritage-gate-fraud-playbook.pdf";
export const PLAYBOOK_PROMO_CODE = PROMO_CODE;
