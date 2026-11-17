import type { Express, Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { z } from "zod";
import {
  User,
  EventModel,
  BookingModel,
  OrganizerFollowerModel,
  MarketingContactModel,
  OrganizerContactModel,
  BroadcastModel,
  BroadcastRecipientModel,
  EmailSuppressionModel,
} from "./models";
import { rateLimit } from "./auth";
import { renderBroadcastEmail, broadcastFrom, sendBroadcastBatch, type BroadcastReason, type BroadcastMail } from "./emails";

/**
 * Organizer email: an organizer writes one message and sends it, under their
 * own logo and name, to people who already have a reason to hear from them.
 *
 * Who is reachable (computed here, never trusted from the client):
 *  - guest:    paid ticket holders of an event that hasn't happened yet
 *  - checkout: buyers who ticked "keep me posted" on one of their events
 *  - follower: people who follow the organizer on Black Heritage
 *  - import:   addresses the organizer uploaded and vouched for
 * Past buyers who never opted in stay out: booking emails are transactional
 * consent only (see MarketingContact in models).
 *
 * Delivery runs through a queue with two daily caps (per organizer and for
 * the whole platform), counted on Resend's UTC day. On Resend's free plan the
 * platform cap leaves room for ticket emails, which share the same 100 a day.
 */

const BASE = () => (process.env.PUBLIC_APP_URL || "https://blackhevents.com").replace(/\/+$/, "");
const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const BATCH_MAX = 100; // Resend batch limit
const MAX_RECIPIENTS = 5000;
const MAX_IMPORT = 3000;
const TEST_SENDS_PER_DAY = 10;

function posInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function broadcastCaps() {
  return {
    org: posInt(process.env.BROADCAST_ORG_DAILY_CAP, 50),
    platform: posInt(process.env.BROADCAST_DAILY_CAP, 60),
  };
}

/** Resend's daily quota is a UTC calendar day, so ours is too. */
function utcDayStart(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function nextUtcMidnight(now = new Date()): Date {
  const d = utcDayStart(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// ── Auth: the organizer, or a manager on their team ──
async function requireSender(req: Request, res: Response): Promise<{ user: any; organizerId: string } | null> {
  if (!(req as any).isAuthenticated?.()) {
    res.status(401).json({ message: "Sign in to continue." });
    return null;
  }
  const user = req.user as any;
  if (user.teamOwnerId) {
    if (user.staffRole !== "manager") {
      res.status(403).json({ message: "Only the organizer or a manager can email guests." });
      return null;
    }
    return { user, organizerId: String(user.teamOwnerId) };
  }
  if (user.role !== "organizer" && user.role !== "admin") {
    res.status(403).json({ message: "Organizer access needed." });
    return null;
  }
  return { user, organizerId: String(user._id) };
}

// ── Unsubscribe tokens: HMAC, so a link only ever unsubscribes its own address ──
function unsubSig(organizerId: string, email: string): string {
  const secret = process.env.SESSION_SECRET || "dev-marketing-secret";
  return crypto.createHmac("sha256", secret).update(`org-unsub:${organizerId}|${email}`).digest("base64url").slice(0, 32);
}

function unsubToken(organizerId: string, email: string): string {
  const e = email.toLowerCase();
  return `${Buffer.from(`${organizerId}|${e}`).toString("base64url")}.${unsubSig(organizerId, e)}`;
}

function readUnsubToken(token: string): { organizerId: string; email: string } | null {
  try {
    const [b64, sig] = String(token).split(".");
    const [organizerId, email] = Buffer.from(b64, "base64url").toString("utf8").split("|");
    if (!organizerId || !email || !sig) return null;
    const expected = unsubSig(organizerId, email);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return { organizerId, email };
  } catch {
    return null;
  }
}

// ── Organizer identity on the email ──
async function organizerBrand(organizerId: string) {
  const org: any = await User.findById(organizerId).select("username displayName logoUrl accentHex email").lean();
  const name = org?.displayName || org?.username || "The organizer";
  return {
    name,
    email: org?.email || null,
    branding: { displayName: name, logoUrl: org?.logoUrl || undefined, accentHex: org?.accentHex || undefined },
  };
}

function eventUrl(ev: any): string {
  return `${BASE()}/${ev.slug ? `e/${ev.slug}` : `events/${String(ev._id)}`}`;
}

// ── Audience ──
interface AudienceRow {
  email: string;
  name: string | null;
  reasons: BroadcastReason[];
  eventIds: string[];
}

const REASON_ORDER: BroadcastReason[] = ["guest", "checkout", "follower", "import"];
const primaryReason = (r: BroadcastReason[]): BroadcastReason => REASON_ORDER.find((x) => r.includes(x)) || "import";

async function buildAudience(organizerId: string) {
  const now = Date.now();
  const events: any[] = await EventModel.find({ organizerId, isDemo: { $ne: true } })
    .select("_id title date slug status location imageUrl")
    .sort({ date: -1 })
    .lean();
  const eventIds = events.map((e) => e._id);
  // An event stays "upcoming" until the morning after, so day-of updates reach guests.
  const isUpcoming = (e: any) => e.date && new Date(e.date).getTime() > now - 12 * 3600 * 1000;
  const upcoming = new Set(events.filter(isUpcoming).map((e) => String(e._id)));

  const [bookings, followers, contacts, optins] = await Promise.all([
    eventIds.length
      ? BookingModel.find({ eventId: { $in: eventIds }, status: "paid", isDemo: { $ne: true } }).select("email name eventId").lean()
      : Promise.resolve([]),
    OrganizerFollowerModel.find({ organizerId, unsubscribed: { $ne: true } }).select("email").lean(),
    OrganizerContactModel.find({ organizerId }).select("email name source unsubscribed").lean(),
    eventIds.length
      ? MarketingContactModel.find({ eventId: { $in: eventIds.map(String) }, unsubscribed: { $ne: true }, email: { $ne: null } })
          .select("email name eventId")
          .lean()
      : Promise.resolve([]),
  ]);

  const rows = new Map<string, AudienceRow>();
  const add = (emailRaw: string, name: string | null | undefined, reason: BroadcastReason, eventId?: string) => {
    const email = String(emailRaw || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return;
    let row = rows.get(email);
    if (!row) {
      row = { email, name: null, reasons: [], eventIds: [] };
      rows.set(email, row);
    }
    if (!row.name && name && !String(name).includes("@")) row.name = String(name).trim().slice(0, 80);
    if (!row.reasons.includes(reason)) row.reasons.push(reason);
    if (eventId && !row.eventIds.includes(eventId)) row.eventIds.push(eventId);
  };

  const optedIn = new Set<string>();
  for (const o of optins as any[]) optedIn.add(String(o.email).toLowerCase());
  for (const c of contacts as any[]) if (c.source === "checkout" && !c.unsubscribed) optedIn.add(c.email);

  const pastOnly = new Set<string>();
  for (const b of bookings as any[]) {
    const id = String(b.eventId);
    const email = String(b.email || "").toLowerCase();
    if (upcoming.has(id)) add(email, b.name, "guest", id);
    else if (optedIn.has(email)) add(email, b.name, "checkout", id);
    else pastOnly.add(email);
  }
  for (const o of optins as any[]) add(o.email, o.name, "checkout", String(o.eventId || "") || undefined);
  for (const f of followers as any[]) add(f.email, null, "follower");
  for (const c of contacts as any[]) {
    if (c.unsubscribed || c.source === "unsubscribe") continue;
    add(c.email, c.name, c.source === "checkout" ? "checkout" : "import");
  }

  // Per-organizer opt-outs and platform bounces/complaints win over everything.
  const blocked = new Set((contacts as any[]).filter((c) => c.unsubscribed).map((c) => c.email));
  const candidates = Array.from(rows.keys());
  const suppressedDocs: any[] = candidates.length
    ? await EmailSuppressionModel.find({ email: { $in: candidates } }).select("email").lean()
    : [];
  const suppressed = new Set(suppressedDocs.map((d) => d.email));
  for (const email of candidates) if (blocked.has(email) || suppressed.has(email)) rows.delete(email);

  let hiddenPastGuests = 0;
  pastOnly.forEach((email) => {
    if (!rows.has(email) && !blocked.has(email)) hiddenPastGuests++;
  });

  const list = Array.from(rows.values()).sort((a, b) => a.email.localeCompare(b.email));
  const guestCounts = new Map<string, number>();
  for (const r of list) for (const id of r.eventIds) guestCounts.set(id, (guestCounts.get(id) || 0) + 1);

  return {
    contacts: list.map((r) => ({ ...r, reason: primaryReason(r.reasons) })),
    events: events.map((e) => ({
      id: String(e._id),
      title: e.title,
      date: e.date || null,
      upcoming: upcoming.has(String(e._id)),
      status: e.status,
      reachable: guestCounts.get(String(e._id)) || 0,
    })),
    stats: {
      total: list.length,
      guests: list.filter((r) => r.reasons.includes("guest")).length,
      optedIn: list.filter((r) => r.reasons.includes("checkout")).length,
      followers: list.filter((r) => r.reasons.includes("follower")).length,
      imported: list.filter((r) => r.reasons.includes("import")).length,
      unsubscribed: blocked.size,
      bounced: suppressed.size,
      hiddenPastGuests,
    },
  };
}

// ── Import: paste or CSV text in, clean addresses out ──
const HEADER_WORDS = /^(name|full ?name|first ?name|email|e-mail|phone|ticket|tier|date|status)$/i;

export function parseContactText(text: string): { rows: { email: string; name: string | null }[]; invalid: number } {
  const out = new Map<string, { email: string; name: string | null }>();
  let invalid = 0;
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("@")) continue;
    const found = trimmed.match(/[^\s,;<>"'()\t|]+@[^\s,;<>"'()\t|]+/g) || [];
    for (const raw of found) {
      const email = raw.replace(/^mailto:/i, "").replace(/[.]+$/, "").toLowerCase();
      if (!EMAIL_RE.test(email)) {
        invalid++;
        continue;
      }
      let name: string | null = null;
      if (found.length === 1) {
        const cells = trimmed.replace(raw, "\u0000").split(/[,;\t|]|\u0000/).map((c) => c.replace(/["'<>]/g, "").trim());
        name = cells.find((c) => c && /[a-z]/i.test(c) && !c.includes("@") && c.length <= 60 && !HEADER_WORDS.test(c) && !/\d{3,}/.test(c)) || null;
      }
      if (!out.has(email)) out.set(email, { email, name });
      if (out.size >= MAX_IMPORT) return { rows: Array.from(out.values()), invalid };
    }
  }
  return { rows: Array.from(out.values()), invalid };
}

// ── Compose ──
const composeSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject line").max(120, "Keep the subject under 120 characters"),
  message: z.string().trim().min(10, "Write a short message").max(5000, "Keep the message under 5,000 characters"),
  eventId: z.string().trim().optional().nullable(),
  ctaLabel: z.string().trim().max(40, "Keep the button text short").optional().nullable(),
  ctaUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), "Button links must start with https://"),
  replyTo: z.string().trim().max(120).optional().nullable().refine((v) => !v || EMAIL_RE.test(v), "Check the reply-to email"),
});
type ComposeInput = z.infer<typeof composeSchema>;

async function resolveCompose(organizerId: string, input: ComposeInput) {
  let event: any = null;
  if (input.eventId) {
    if (!mongoose.isValidObjectId(input.eventId)) throw new Error("Pick one of your events");
    event = await EventModel.findOne({ _id: input.eventId, organizerId }).select("_id title date slug location imageUrl branding").lean();
    if (!event) throw new Error("Pick one of your events");
  }
  const brand = await organizerBrand(organizerId);
  // An event's own branding (set per event) wins over the organizer profile.
  const branding = {
    displayName: event?.branding?.displayName || brand.branding.displayName,
    logoUrl: event?.branding?.logoUrl || brand.branding.logoUrl,
    accentHex: event?.branding?.accentHex || brand.branding.accentHex,
  };
  const ctaUrl = input.ctaUrl || (event ? `${eventUrl(event)}?via=email` : null);
  const ctaLabel = ctaUrl ? input.ctaLabel || (event ? "Get tickets" : "Open link") : null;
  return {
    organizerName: branding.displayName || brand.name,
    branding,
    replyTo: input.replyTo || brand.email,
    event: event
      ? { id: String(event._id), title: event.title, date: event.date ? new Date(event.date) : null, location: event.location || "", imageUrl: event.imageUrl || null }
      : null,
    ctaUrl,
    ctaLabel,
  };
}

function mailFor(
  organizerId: string,
  ctx: Awaited<ReturnType<typeof resolveCompose>>,
  subject: string,
  message: string,
  to: { email: string; name: string | null; reason: BroadcastReason },
): BroadcastMail {
  const token = unsubToken(organizerId, to.email);
  const { html, text } = renderBroadcastEmail({
    organizerName: ctx.organizerName,
    branding: ctx.branding,
    subject,
    message,
    recipientName: to.name,
    event: ctx.event,
    ctaLabel: ctx.ctaLabel,
    ctaUrl: ctx.ctaUrl,
    reason: to.reason,
    unsubscribeUrl: `${BASE()}/unsubscribe?t=${encodeURIComponent(token)}`,
  });
  return {
    from: broadcastFrom(ctx.organizerName),
    to: to.email,
    subject,
    html,
    text,
    replyTo: ctx.replyTo,
    unsubscribeUrl: `${BASE()}/unsubscribe?t=${encodeURIComponent(token)}`,
    oneClickUrl: `${BASE()}/api/email/unsubscribe/${encodeURIComponent(token)}`,
  };
}

async function sentToday(filter: Record<string, unknown> = {}): Promise<number> {
  return BroadcastRecipientModel.countDocuments({ ...filter, status: "sent", sentAt: { $gte: utcDayStart() } });
}

async function quotaFor(organizerId: string) {
  const caps = broadcastCaps();
  const [orgSent, platformSent, queued] = await Promise.all([
    sentToday({ organizerId }),
    sentToday(),
    BroadcastRecipientModel.countDocuments({ organizerId, status: "queued" }),
  ]);
  const leftToday = Math.max(0, Math.min(caps.org - orgSent, caps.platform - platformSent));
  return {
    orgCap: caps.org,
    sentToday: orgSent,
    leftToday,
    queued,
    resetsAt: nextUtcMidnight().toISOString(),
    configured: Boolean(process.env.RESEND_API_KEY),
    fromAddress: (process.env.BROADCAST_FROM_EMAIL || "tickets@blackhevents.com").trim(),
  };
}

// ── Queue worker ──
let working = false;

export async function processBroadcastQueue(): Promise<void> {
  if (working || !process.env.RESEND_API_KEY) return;
  working = true;
  try {
    const caps = broadcastCaps();
    const atCap = new Set<string>();
    for (let round = 0; round < 60; round++) {
      const platformLeft = caps.platform - (await sentToday());
      if (platformLeft <= 0) return;

      const next: any = await BroadcastRecipientModel.findOne({
        status: "queued",
        broadcastId: { $ne: null },
        organizerId: { $nin: Array.from(atCap) },
      })
        .sort({ createdAt: 1 })
        .lean();
      if (!next) return;

      const orgLeft = caps.org - (await sentToday({ organizerId: next.organizerId }));
      if (orgLeft <= 0) {
        atCap.add(next.organizerId);
        continue;
      }

      const broadcast: any = await BroadcastModel.findById(next.broadcastId).lean();
      if (!broadcast || broadcast.status === "stopped") {
        await BroadcastRecipientModel.updateMany(
          { broadcastId: next.broadcastId, status: "queued" },
          { $set: { status: "skipped", error: "stopped" } },
        );
        continue;
      }

      const take = Math.min(BATCH_MAX, orgLeft, platformLeft);
      const batch: any[] = await BroadcastRecipientModel.find({ broadcastId: next.broadcastId, status: "queued" })
        .sort({ createdAt: 1, _id: 1 })
        .limit(take)
        .lean();

      // Someone may have unsubscribed or bounced since the send was queued.
      const emails = batch.map((r) => r.email);
      const [suppressed, optedOut] = await Promise.all([
        EmailSuppressionModel.find({ email: { $in: emails } }).select("email").lean(),
        OrganizerContactModel.find({ organizerId: broadcast.organizerId, email: { $in: emails }, unsubscribed: true }).select("email").lean(),
      ]);
      const skip = new Set([...suppressed, ...optedOut].map((d: any) => d.email));
      const sendable = batch.filter((r) => !skip.has(r.email));
      if (skip.size) {
        await BroadcastRecipientModel.updateMany(
          { broadcastId: next.broadcastId, email: { $in: Array.from(skip) }, status: "queued" },
          { $set: { status: "skipped", error: "unsubscribed or bounced" } },
        );
      }
      if (sendable.length === 0) {
        await finishIfDone(String(broadcast._id));
        continue;
      }

      let ctx;
      try {
        ctx = await resolveCompose(broadcast.organizerId, {
          subject: broadcast.subject,
          message: broadcast.message,
          eventId: broadcast.eventId,
          ctaLabel: broadcast.ctaLabel,
          ctaUrl: broadcast.ctaUrl,
          replyTo: broadcast.replyTo,
        });
      } catch {
        // The event was deleted after queueing: send without the card.
        ctx = await resolveCompose(broadcast.organizerId, {
          subject: broadcast.subject,
          message: broadcast.message,
          eventId: null,
          ctaLabel: broadcast.ctaLabel,
          ctaUrl: broadcast.ctaUrl,
          replyTo: broadcast.replyTo,
        });
      }
      const mails = sendable.map((r) => mailFor(broadcast.organizerId, ctx, broadcast.subject, broadcast.message, r));

      let result = await sendBroadcastBatch(mails, `bc-${broadcast._id}-${sendable[0]._id}-${sendable.length}`);
      if (!result.ok && result.code === "invalid_idempotent_request") {
        result = await sendBroadcastBatch(mails, `bc-${broadcast._id}-${sendable[0]._id}-${Date.now()}`);
      }
      if (!result.ok) {
        if (result.code === "rate_limit_exceeded") {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        // Quota hit, bad sender address, bad key: leave the queue as it is and
        // retry on the next sweep, so nothing is lost while it gets fixed.
        console.error(`[broadcasts] batch held (${result.code}): ${result.message}`);
        return;
      }

      const now = new Date();
      let sent = 0;
      let failed = 0;
      const ops = sendable.map((r, i) => {
        const out = result.ok ? result.results[i] : { error: "unknown" };
        if ("id" in out) sent++;
        else failed++;
        return {
          updateOne: {
            filter: { _id: r._id },
            update: "id" in out
              ? { $set: { status: "sent", resendId: out.id, sentAt: now, error: null } }
              : { $set: { status: "failed", error: String(out.error).slice(0, 200) } },
          },
        };
      });
      await BroadcastRecipientModel.bulkWrite(ops as any[], { ordered: false });
      await BroadcastModel.updateOne({ _id: broadcast._id }, { $inc: { sentCount: sent, failedCount: failed } });
      await finishIfDone(String(broadcast._id));
    }
  } catch (err: any) {
    console.error("[broadcasts] queue error:", err?.message);
  } finally {
    working = false;
  }
}

async function finishIfDone(broadcastId: string): Promise<void> {
  const left = await BroadcastRecipientModel.countDocuments({ broadcastId, status: "queued" });
  if (left === 0) {
    await BroadcastModel.updateOne({ _id: broadcastId, status: "sending" }, { $set: { status: "sent", completedAt: new Date() } });
  }
}

let workerStarted = false;
export function startBroadcastWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  setTimeout(() => void processBroadcastQueue(), 60 * 1000);
  // Every 10 minutes: picks up spill-over after the UTC midnight reset and
  // anything held back by a quota or config error.
  setInterval(() => void processBroadcastQueue(), 10 * 60 * 1000);
  console.log("[broadcasts] queue worker on (every 10 min)");
}

// ── Opt-out ──
async function unsubscribe(organizerId: string, email: string): Promise<void> {
  const now = new Date();
  await Promise.all([
    OrganizerContactModel.updateOne(
      { organizerId, email },
      { $set: { unsubscribed: true, unsubscribedAt: now }, $setOnInsert: { source: "unsubscribe", createdAt: now } },
      { upsert: true },
    ),
    OrganizerFollowerModel.updateOne({ organizerId, email }, { $set: { unsubscribed: true } }),
    BroadcastRecipientModel.updateMany({ organizerId, email, status: "queued" }, { $set: { status: "skipped", error: "unsubscribed" } }),
  ]);
}

// ── Resend webhook: Svix-signed. Hard bounces and spam complaints go on the
// platform suppression list so no organizer can keep mailing a dead or angry address.
function svixValid(req: Request): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const raw: Buffer | undefined = (req as any).rawBody;
  if (!secret || !raw) return false;
  const id = String(req.headers["svix-id"] || "");
  const ts = String(req.headers["svix-timestamp"] || "");
  const sigHeader = String(req.headers["svix-signature"] || "");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${raw.toString("utf8")}`).digest("base64");
  return sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && !!sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
}

export function registerBroadcastRoutes(app: Express): void {
  const importLimit = rateLimit(20, 60 * 60 * 1000);
  const sendLimit = rateLimit(10, 10 * 60 * 1000);

  app.get("/api/organizer/email/audience", async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    try {
      res.json(await buildAudience(ctx.organizerId));
    } catch (err: any) {
      console.error("audience error:", err?.message);
      res.status(500).json({ message: "We couldn't load your guest list just now. Try again in a moment." });
    }
  });

  app.get("/api/organizer/email/quota", async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    res.json(await quotaFor(ctx.organizerId));
  });

  app.post("/api/organizer/email/contacts/import", importLimit, async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    if (req.body?.consent !== true) {
      return res.status(400).json({ message: "Tick the box to confirm these people agreed to hear from you." });
    }
    const { rows, invalid } = parseContactText(String(req.body?.text || "").slice(0, 2_000_000));
    if (rows.length === 0) {
      return res.status(400).json({ message: "We couldn't find any email addresses in that. Paste one per line, or upload a CSV." });
    }
    const now = new Date();
    const existing: any[] = await OrganizerContactModel.find({ organizerId: ctx.organizerId, email: { $in: rows.map((r) => r.email) } })
      .select("email unsubscribed")
      .lean();
    const unsubscribed = existing.filter((e) => e.unsubscribed).length;
    const result = await OrganizerContactModel.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { organizerId: ctx.organizerId, email: r.email },
          // Insert only: a re-import never overrides an unsubscribe.
          update: { $setOnInsert: { source: "import", consentAt: now, name: r.name, unsubscribed: false, createdAt: now } },
          upsert: true,
        },
      })) as any[],
      { ordered: false },
    );
    res.json({
      added: result.upsertedCount || 0,
      alreadyOnList: rows.length - (result.upsertedCount || 0) - unsubscribed,
      unsubscribed,
      invalid,
    });
  });

  // Removes an imported address from the organizer's list (not an opt-out).
  app.delete("/api/organizer/email/contacts", async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    const email = String(req.body?.email || "").trim().toLowerCase();
    await OrganizerContactModel.deleteOne({ organizerId: ctx.organizerId, email, source: "import" });
    res.json({ ok: true });
  });

  app.post("/api/organizer/email/preview", async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    try {
      const input = composeSchema.partial({ subject: true, message: true }).parse(req.body || {});
      const resolved = await resolveCompose(ctx.organizerId, input as ComposeInput);
      const subject = input.subject || "Your subject line";
      const message = input.message || "Your message shows here.";
      const mail = mailFor(ctx.organizerId, resolved, subject, message, {
        email: "guest@example.com",
        name: "Ada",
        reason: input.eventId ? "guest" : "follower",
      });
      res.json({ html: mail.html, from: mail.from, replyTo: mail.replyTo, subject });
    } catch (err: any) {
      const msg = err instanceof z.ZodError ? err.errors[0].message : err?.message;
      res.status(400).json({ message: msg || "Check the message and try again." });
    }
  });

  app.post("/api/organizer/email/test", sendLimit, async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    if (!process.env.RESEND_API_KEY) return res.status(503).json({ message: "Email isn't set up on this server yet." });
    try {
      const input = composeSchema.parse(req.body || {});
      const caps = broadcastCaps();
      const [tests, platform] = await Promise.all([
        BroadcastRecipientModel.countDocuments({ organizerId: ctx.organizerId, reason: "test", sentAt: { $gte: utcDayStart() } }),
        sentToday(),
      ]);
      if (tests >= TEST_SENDS_PER_DAY) return res.status(429).json({ message: `That's ${TEST_SENDS_PER_DAY} test emails today. Use the preview, or try again tomorrow.` });
      if (platform >= caps.platform) return res.status(429).json({ message: "Today's sending limit is used up. Try again after 1 AM." });
      const to = String(ctx.user.email || "").toLowerCase();
      if (!EMAIL_RE.test(to)) return res.status(400).json({ message: "Your account has no email address to send the test to." });
      const resolved = await resolveCompose(ctx.organizerId, input);
      const mail = mailFor(ctx.organizerId, resolved, `[Test] ${input.subject}`, input.message, {
        email: to,
        name: ctx.user.displayName || ctx.user.username,
        reason: "test",
      });
      const result = await sendBroadcastBatch([mail], `test-${ctx.organizerId}-${crypto.randomUUID()}`);
      const first = result.ok ? result.results[0] : null;
      if (!result.ok || !first || !("id" in first)) {
        const why = !result.ok ? result.message : first && "error" in first ? first.error : "unknown";
        console.error("test send failed:", why);
        return res.status(502).json({ message: "The test didn't send. Try again in a minute." });
      }
      await BroadcastRecipientModel.create({
        broadcastId: null, organizerId: ctx.organizerId, email: to, reason: "test", status: "sent", resendId: first.id, sentAt: new Date(),
      });
      res.json({ ok: true, to });
    } catch (err: any) {
      const msg = err instanceof z.ZodError ? err.errors[0].message : err?.message;
      res.status(400).json({ message: msg || "Check the message and try again." });
    }
  });

  app.post("/api/organizer/email/broadcasts", sendLimit, async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    if (!process.env.RESEND_API_KEY) return res.status(503).json({ message: "Email isn't set up on this server yet." });
    try {
      const input = composeSchema.parse(req.body || {});
      const wanted = new Set(
        (Array.isArray(req.body?.recipients) ? req.body.recipients : [])
          .map((e: unknown) => String(e).trim().toLowerCase())
          .slice(0, MAX_RECIPIENTS),
      );
      if (wanted.size === 0) return res.status(400).json({ message: "Pick at least one person to email." });
      await resolveCompose(ctx.organizerId, input); // validates the event belongs to them

      // Only addresses this organizer may actually reach, whatever the client sent.
      const audience = await buildAudience(ctx.organizerId);
      const chosen = audience.contacts.filter((c) => wanted.has(c.email));
      if (chosen.length === 0) return res.status(400).json({ message: "None of those people can be emailed from your list." });

      const broadcast = await BroadcastModel.create({
        organizerId: ctx.organizerId,
        createdBy: String(ctx.user._id),
        subject: input.subject,
        message: input.message,
        eventId: input.eventId || null,
        ctaLabel: input.ctaLabel || null,
        ctaUrl: input.ctaUrl || null,
        replyTo: input.replyTo || null,
        recipientCount: chosen.length,
      });
      const t0 = Date.now();
      await BroadcastRecipientModel.insertMany(
        chosen.map((c, i) => ({
          broadcastId: String(broadcast._id),
          organizerId: ctx.organizerId,
          email: c.email,
          name: c.name,
          reason: c.reason,
          status: "queued",
          createdAt: new Date(t0 + i), // keeps the queue order stable
        })),
        { ordered: false },
      );

      const quota = await quotaFor(ctx.organizerId);
      const aheadOfThis = Math.max(0, quota.queued - chosen.length);
      const today = Math.max(0, Math.min(chosen.length, quota.leftToday - aheadOfThis));
      const rest = chosen.length - today;
      const extraDays = rest > 0 ? Math.ceil(rest / Math.max(1, quota.orgCap)) : 0;
      void processBroadcastQueue();
      res.status(201).json({
        id: String(broadcast._id),
        recipients: chosen.length,
        dropped: wanted.size - chosen.length,
        sendingToday: today,
        extraDays,
      });
    } catch (err: any) {
      const msg = err instanceof z.ZodError ? err.errors[0].message : err?.message;
      res.status(400).json({ message: msg || "Check the message and try again." });
    }
  });

  app.get("/api/organizer/email/broadcasts", async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    const list: any[] = await BroadcastModel.find({ organizerId: ctx.organizerId }).sort({ createdAt: -1 }).limit(25).lean();
    const ids = list.map((b) => String(b._id));
    const queued: any[] = ids.length
      ? await BroadcastRecipientModel.aggregate([
          { $match: { broadcastId: { $in: ids }, status: "queued" } },
          { $group: { _id: "$broadcastId", n: { $sum: 1 } } },
        ])
      : [];
    const q = new Map(queued.map((r) => [r._id, r.n]));
    res.json(
      list.map((b) => ({
        id: String(b._id),
        subject: b.subject,
        eventId: b.eventId,
        status: b.status,
        recipientCount: b.recipientCount,
        sentCount: b.sentCount,
        failedCount: b.failedCount,
        queued: q.get(String(b._id)) || 0,
        createdAt: b.createdAt,
        completedAt: b.completedAt,
      })),
    );
  });

  app.post("/api/organizer/email/broadcasts/:id/stop", async (req, res) => {
    const ctx = await requireSender(req, res);
    if (!ctx) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const b = await BroadcastModel.findOneAndUpdate(
      { _id: req.params.id, organizerId: ctx.organizerId, status: "sending" },
      { $set: { status: "stopped", completedAt: new Date() } },
    );
    if (!b) return res.status(404).json({ message: "That email has already finished sending." });
    const r = await BroadcastRecipientModel.updateMany(
      { broadcastId: String(b._id), status: "queued" },
      { $set: { status: "skipped", error: "stopped" } },
    );
    res.json({ ok: true, cancelled: r.modifiedCount || 0 });
  });

  // Public: who is this unsubscribe link for? (The page asks before acting,
  // so link scanners that open every URL can't unsubscribe anyone.)
  app.get("/api/email/unsubscribe/:token/info", async (req, res) => {
    const parsed = readUnsubToken(req.params.token);
    if (!parsed) return res.status(404).json({ message: "This link isn't valid." });
    const brand = await organizerBrand(parsed.organizerId);
    const row: any = await OrganizerContactModel.findOne({ organizerId: parsed.organizerId, email: parsed.email }).select("unsubscribed").lean();
    res.json({ organizerName: brand.name, email: parsed.email, unsubscribed: Boolean(row?.unsubscribed) });
  });

  // POST does the opt-out: the page's button, and mail apps' one-click
  // unsubscribe (RFC 8058, the List-Unsubscribe-Post header).
  app.post("/api/email/unsubscribe/:token", async (req, res) => {
    const parsed = readUnsubToken(req.params.token);
    if (!parsed) return res.status(404).json({ message: "This link isn't valid." });
    await unsubscribe(parsed.organizerId, parsed.email);
    res.json({ ok: true });
  });
  app.get("/api/email/unsubscribe/:token", (req, res) => {
    res.redirect(302, `/unsubscribe?t=${encodeURIComponent(req.params.token)}`);
  });

  app.post("/api/webhooks/resend", async (req, res) => {
    if (!svixValid(req)) return res.status(401).json({ message: "Bad signature" });
    try {
      const event = req.body || {};
      const to: string[] = (Array.isArray(event?.data?.to) ? event.data.to : [event?.data?.to]).filter(Boolean);
      const bounceType = String(event?.data?.bounce?.type || "");
      const reason = event.type === "email.complained" ? "complaint" : event.type === "email.bounced" && !/transient/i.test(bounceType) ? "bounce" : null;
      if (reason) {
        for (const raw of to) {
          const email = String(raw).toLowerCase().trim();
          await EmailSuppressionModel.updateOne({ email }, { $setOnInsert: { email, reason, createdAt: new Date() } }, { upsert: true });
        }
        if (event?.data?.email_id) {
          await BroadcastRecipientModel.updateOne({ resendId: event.data.email_id }, { $set: { error: reason } });
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      console.error("resend webhook error:", err?.message);
      res.status(500).json({ message: "error" });
    }
  });
}

/** Checkout "keep me posted": consent to hear from this organizer too. */
export async function recordCheckoutOptIn(organizerId: string | null | undefined, email: string, name: string | null): Promise<void> {
  if (!organizerId) return;
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return;
  // Ticking the box again after unsubscribing is fresh consent.
  await OrganizerContactModel.updateOne(
    { organizerId, email: e },
    {
      $set: { source: "checkout", consentAt: new Date(), unsubscribed: false, unsubscribedAt: null },
      $setOnInsert: { name, createdAt: new Date() },
    },
    { upsert: true },
  );
}
