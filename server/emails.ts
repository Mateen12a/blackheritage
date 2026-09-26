import { Resend } from "resend";
import { PLAYBOOK_FILENAME } from "./playbook";

const FROM = "Black Heritage Events <tickets@blackhevents.com>";

interface Branding {
  displayName?: string;
  logoUrl?: string;
  accentHex?: string;
}

function safeHex(hex: string | undefined): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex || "") ? (hex as string) : "#E3B23C";
}

function escAttr(value: string): string {
  return esc(value).replace(/'/g, "&#39;");
}

/**
 * Email shell. With organizer branding, their name, logo, and accent take
 * over the header; the footer keeps the BlackHeritage platform credit.
 */
function shell(title: string, bodyHtml: string, branding?: Branding | null): string {
  const accent = safeHex(branding?.accentHex);
  const hasBrand = Boolean(branding?.displayName || branding?.logoUrl);
  const brandLabel = hasBrand ? esc((branding?.displayName || "").toUpperCase()) : "BLACKHERITAGE";
  const brandLogo = branding?.logoUrl
    ? `<img src="${escAttr(branding.logoUrl)}" alt="" width="40" height="40" style="display:block;border-radius:8px;object-fit:cover;" />`
    : "";
  const subLabel = hasBrand ? "IN PARTNERSHIP WITH BLACKHERITAGE" : "EVENT TICKETING";
  const footer = hasBrand
    ? `Issued via <strong>BlackHeritage</strong>${branding?.displayName ? ` for ${esc(branding.displayName)}` : ""}. Questions about this ticket? Reply to this email or contact the organizer.`
    : `Sent by BlackHeritage. Questions about this ticket? Reply to this email or message the event organizer from your dashboard.`;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f2ee;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#111;">
      <div style="background:#111114;padding:24px 28px;border-radius:12px 12px 0 0;">
        <table style="border-collapse:collapse;"><tr>
          ${brandLogo ? `<td style="padding-right:12px;">${brandLogo}</td>` : ""}
          <td>
            <div style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:2px;">${brandLabel}</div>
            <div style="color:${accent};font-size:10px;letter-spacing:3px;margin-top:4px;">${subLabel}</div>
          </td>
        </tr></table>
      </div>
      <div style="background:#ffffff;padding:28px;border:1px solid #e5e2dc;border-top:3px solid ${accent};">
        <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
        ${bodyHtml}
        <p style="margin-top:28px;font-size:12px;color:#777;">
          ${footer}
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EmailAddress {
  name: string;
  email: string;
}

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

function ticketRowsHtml(
  tickets: { code: string; tierName: string; attendeeName: string; seat: number }[],
): string {
  return tickets
    .map(
      (t) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;">
        <div style="font-weight:bold;font-family:monospace;font-size:15px;">${esc(t.code)}</div>
        <div style="color:#666;font-size:12px;margin-top:2px;">${esc(t.tierName)} · Seat ${t.seat}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;">
        <span style="display:inline-block;background:#faf5e6;border:1px solid #E3B23C;color:#8a6a1f;font-size:11px;padding:3px 8px;border-radius:999px;">VALID</span>
      </td>
    </tr>`,
    )
    .join("");
}

export interface TicketEmailData {
  eventTitle: string;
  eventDate: Date;
  eventLocation: string;
  tickets: { code: string; tierName: string; attendeeName: string; seat: number }[];
  totalPaidKobo: number;
  bookingRef: string;
  pdfBase64?: string; // omitted for refund-only sends
  branding?: Branding | null;
}

export async function sendTicketEmail(to: EmailAddress, data: TicketEmailData): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const dateStr = data.eventDate.toLocaleString("en-NG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
  });

  await resend.emails.send({
    from: FROM,
    to: [to.email],
    subject: `Your tickets for ${data.eventTitle}`,
    html: shell(
      "Your tickets are confirmed",
      `
      <p style="margin:0 0 4px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;">Your payment went through. Here are your tickets for ${esc(data.eventTitle)}.</p>

      <div style="background:#faf9f7;border:1px solid #e5e2dc;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:bold;">${esc(data.eventTitle)}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">${dateStr}</div>
        <div style="font-size:13px;color:#666;">${esc(data.eventLocation)}</div>
        <div style="margin-top:10px;font-size:13px;">Paid: <strong>${formatNaira(data.totalPaidKobo)}</strong> · Ref ${esc(data.bookingRef)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        ${ticketRowsHtml(data.tickets)}
      </table>

      <p style="margin:20px 0 0;font-size:13px;color:#444;">Your PDF ticket is attached. Present the code at the gate, on your phone or printed. Each code works once.</p>
      <p style="margin:8px 0 0;font-size:13px;">
        <a href="${process.env.PUBLIC_APP_URL || "http://localhost:5000"}/tickets" style="color:#111;font-weight:bold;">Re-download your tickets any time</a>
      </p>`,
      data.branding,
    ),
    attachments: data.pdfBase64
      ? [
          {
            filename: `blackheritage-tickets-${data.bookingRef}.pdf`,
            content: data.pdfBase64,
          },
        ]
      : undefined,
  });
}

export async function sendManualTicketEmail(
  to: EmailAddress,
  data: TicketEmailData & { eventTitle: string },
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const dateStr = data.eventDate.toLocaleString("en-NG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
  });

  await resend.emails.send({
    from: FROM,
    to: [to.email],
    subject: `You are on the list: ${data.eventTitle}`,
    html: shell(
      "You are on the list",
      `
      <p style="margin:0 0 20px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;">You have been added to the guest list for <strong>${esc(data.eventTitle)}</strong>. No payment needed.</p>

      <div style="background:#faf9f7;border:1px solid #e5e2dc;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:bold;">${esc(data.eventTitle)}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">${dateStr}</div>
        <div style="font-size:13px;color:#666;">${esc(data.eventLocation)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        ${ticketRowsHtml(data.tickets)}
      </table>

      <p style="margin:20px 0 0;font-size:13px;color:#444;">Your PDF ticket is attached. Present the code at the gate.</p>`,
      data.branding,
    ),
    attachments: [
      {
        filename: `blackheritage-tickets-${data.bookingRef}.pdf`,
        content: data.pdfBase64,
      },
    ],
  });
}

export async function sendRefundEmail(to: EmailAddress, data: {
  eventTitle: string;
  amountKobo: number;
  bookingRef: string;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: [to.email],
    subject: `Refund issued for ${data.eventTitle}`,
    html: shell(
      "Your refund is on the way",
      `
      <p style="margin:0 0 20px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#444;">The organizer refunded <strong>${formatNaira(data.amountKobo)}</strong> for ${esc(data.eventTitle)} (ref ${esc(data.bookingRef)}).</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;">Refunds are returned to the original payment method. Banks usually take 5 to 10 working days to post it.</p>
      <p style="margin:0;font-size:13px;color:#444;">Your ticket code has been voided and can no longer be used at the gate.</p>`,
    ),
  });
}

// Welcome email, one variant per role: the account they just opened decides
// what the first email tells them to do. One email, one job.
export async function sendWelcomeEmail(
  to: EmailAddress,
  role: "user" | "organizer" | "vendor" = "user",
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const base = process.env.PUBLIC_APP_URL || "http://localhost:5000";

  const bodies: Record<"user" | "organizer" | "vendor", { subject: string; title: string; html: string }> = {
    user: {
      subject: "Welcome to Black Heritage Events",
      title: "You're in",
      html: `
      <p style="margin:0 0 20px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#444;">Your account is live. Two things worth a minute:</p>
      <p style="margin:0 0 8px;font-size:14px;color:#444;"><strong>Find your next event.</strong> <a href="${base}/" style="color:#111;">Browse what's on sale</a> and book in under a minute.</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;"><strong>Keep tickets close.</strong> Every purchase lands in <a href="${base}/my-tickets" style="color:#111;">your tickets</a>, with a code that scans at the gate.</p>
      <p style="margin:0;font-size:14px;color:#444;">See you in the crowd.</p>`,
    },
    organizer: {
      subject: "Your Black Heritage Events dashboard is ready",
      title: "Your dashboard is ready",
      html: `
      <p style="margin:0 0 20px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#444;">Here is what to set up first:</p>
      <p style="margin:0 0 8px;font-size:14px;color:#444;"><strong>Create your first event.</strong> Tiers, sale windows, cover image, done in minutes. <a href="${base}/admin/events/new" style="color:#111;">Start now</a>.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#444;"><strong>Your booking link.</strong> A shareable page with your branding on it. Find it on any event you publish.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#444;"><strong>Gate day.</strong> Add entry staff and they check tickets from any phone, online or off.</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;">Complimentary tickets for VIPs and press carry no commission.</p>
      <p style="margin:0;font-size:14px;color:#444;">Questions? Reply to this email, a person reads it.</p>`,
    },
    vendor: {
      subject: "Your vendor profile is ready to set up",
      title: "Let's get you booked",
      html: `
      <p style="margin:0 0 20px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#444;">Your account is live. Here's how to start getting booked:</p>
      <p style="margin:0 0 8px;font-size:14px;color:#444;"><strong>Build your profile.</strong> Add your portfolio photos, videos, and service area. <a href="${base}/vendor-dashboard" style="color:#111;">Set it up now</a>.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#444;"><strong>Your shareable link.</strong> Once published, you get a profile page you can drop in any WhatsApp group or bio link.</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;"><strong>Get found.</strong> Organizers browse the vendor directory when planning events. A complete profile with real work gets enquiries.</p>
      <p style="margin:0;font-size:14px;color:#444;">Questions? Reply to this email.</p>`,
    },
  };

  const body = bodies[role];
  await resend.emails.send({
    from: FROM,
    to: [to.email],
    subject: body.subject,
    html: shell(body.title, body.html),
  });
}

// One email to a follower announcing a new event. Returns the Resend id so
// the caller can dedupe if a publish is retried. Unsubscribe link points at
// the platform route that flips the follower row off.
export async function sendFollowerDropEmail(
  to: EmailAddress,
  data: {
    organizerName: string;
    eventTitle: string;
    eventDate: Date;
    eventLocation: string;
    eventUrl: string;
    unsubscribeUrl: string;
  },
): Promise<string | undefined> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const dateStr = data.eventDate.toLocaleString("en-NG", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
  });
  const result = await resend.emails.send({
    from: FROM,
    to: [to.email],
    subject: `${data.organizerName}: ${data.eventTitle} is on sale`,
    html: shell(
      "New drop from " + data.organizerName,
      `
      <p style="margin:0 0 20px;font-size:14px;">Hi ${esc(to.name)},</p>
      <div style="background:#faf9f7;border:1px solid #e5e2dc;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:bold;">${esc(data.eventTitle)}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">${dateStr}</div>
        <div style="font-size:13px;color:#666;">${esc(data.eventLocation)}</div>
      </div>
      <p style="margin:0 0 20px;font-size:14px;">You follow ${esc(data.organizerName)} on BlackHeritage, so you hear about tickets before the crowd. Tiers are limited and these pages do sell out.</p>
      <p style="margin:0 0 8px;font-size:14px;">
        <a href="${esc(data.eventUrl)}" style="display:inline-block;background:#111114;color:#ffffff;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;">Get tickets before they go</a>
      </p>
      <p style="margin:20px 0 0;font-size:11px;color:#999;">
        You are getting this because you follow ${esc(data.organizerName)}.
        <a href="${esc(data.unsubscribeUrl)}" style="color:#999;">Stop these emails</a>.
      </p>`,
    ),
  });
  return result.data?.id;
}

export async function isEmailConfigured(): Promise<boolean> {
  return Boolean(process.env.RESEND_API_KEY);
}

// ── Organizer playbook (lead magnet) ──
// The PDF rides along as an attachment; the link covers the case where the
// attachment is stripped or the reader is on a phone with no PDF viewer.
export async function sendPlaybookEmail(
  to: EmailAddress,
  data: { promoCode: string; playbookUrl: string; pdfBase64: string },
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: [to.email],
    subject: "Your gate-fraud playbook",
    html: shell(
      "Your playbook is attached",
      `
      <p style="margin:0 0 4px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;">Thanks for asking. The gate-fraud playbook is attached as a PDF, and it opens at the link below.</p>

      <div style="background:#faf9f7;border:1px solid #e5e2dc;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="font-size:11px;letter-spacing:1px;color:#666;text-transform:uppercase;">Voucher code</div>
        <div style="font-size:22px;font-weight:bold;letter-spacing:2px;margin-top:6px;">${esc(data.promoCode)}</div>
        <div style="font-size:13px;color:#666;margin-top:6px;">Waives the platform fee on your first 100 paid tickets. Enter it when you create your organizer account.</div>
      </div>

      <p style="margin:0 0 8px;font-size:14px;"><strong>Inside the playbook.</strong> The 12-point gate checklist, the six fraud plays you will actually see, the sponsor pitch outline, and the numbers worth writing down after every show.</p>
      <p style="margin:16px 0 0;font-size:13px;">
        <a href="${esc(data.playbookUrl)}" style="color:#111;font-weight:bold;">Open the playbook</a>
      </p>`,
    ),
    attachments: [
      {
        filename: PLAYBOOK_FILENAME,
        content: data.pdfBase64,
      },
    ],
  });
}

// ── Private event invite ──
// Personal, calm, branded: the guest is being invited, not marketed at.
export async function sendEventInvite(
  to: EmailAddress,
  data: {
    eventTitle: string;
    eventDate: Date;
    eventLocation: string;
    inviteUrl: string;
    organizerName: string;
    branding?: Branding | null;
  },
): Promise<string | undefined> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const accent = safeHex(data.branding?.accentHex);
  const dateStr = data.eventDate.toLocaleString("en-NG", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
  });
  const result = await resend.emails.send({
    from: FROM,
    to: [to.email],
    subject: `You're invited: ${data.eventTitle}`,
    html: shell(
      data.branding?.displayName || data.organizerName,
      `
      <p style="margin:0 0 20px;font-size:14px;">Hi ${esc(to.name)},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#444;">${esc(data.branding?.displayName || data.organizerName)} has invited you to a private event.</p>
      <div style="background:#faf9f7;border:1px solid #e5e2dc;border-left:3px solid ${accent};border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:bold;">${esc(data.eventTitle)}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">${dateStr}</div>
        <div style="font-size:13px;color:#666;">${esc(data.eventLocation)}</div>
      </div>
      <p style="margin:0 0 8px;font-size:14px;">
        <a href="${esc(data.inviteUrl)}" style="display:inline-block;background:#111114;color:#ffffff;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;">View the invitation</a>
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#999;">This link is personal to you. If you were not expecting it, you can ignore this email.</p>`,
    ),
  });
  return result.data?.id;
}
