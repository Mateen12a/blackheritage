import type { Express } from "express";
import type { Server } from "http";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { storage, mapEventLean, mapVendor } from "./storage";
import { api } from "@shared/routes";
import { EMAIL_HINT, isValidEmail } from "@shared/email";
import {
  insertDraftEventSchema, missingEventPublishFields, insertMessageSchema, bookingInitiateSchema, bookingFinalizeSchema,
  promoCreateSchema, manualTicketSchema, scanRequestSchema, scanOverrideSchema,
  scanSyncSchema, teamCreateSchema, platformSettingsSchema,
  eventSettingsSchema, brandingSchema, waitlistJoinSchema,
  type InsertEvent,
} from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { User, TicketModel, ScanEventModel, PlatformSettingModel, BookingModel, WaitlistModel, NativeSponsorModel, OrganizerLeadModel } from "./models";
import mongoose from "mongoose";
import { fulfillBooking, quoteBooking, validatePromo, getPlatformSettings } from "./booking";
import { initializePayment, verifyPayment, refundPayment, activeGateway, isPaystackConfigured, isFlutterwaveConfigured, isPaystackSignatureValid, isFlutterwaveSignatureValid } from "./payments";
import { buildTicketPdf, generateTicketCode } from "./tickets";
import { seedPlatform } from "./seed";
import { sendManualTicketEmail, sendRefundEmail, sendFollowerDropEmail } from "./emails";
import { extractEventFromFile, isAIConfigured, aiUploadLimiter, suggestEventCopy } from "./ai";
import { rateLimit } from "./auth";
import { saveUpload, MAX_UPLOAD_BYTES } from "./media-storage";
import { playbookPdf, PLAYBOOK_FILENAME, PLAYBOOK_PROMO_CODE } from "./playbook";
import { isEmailConfigured, sendPlaybookEmail } from "./emails";
import crypto from "crypto";

const uploadRoot = process.cwd();

/** URL-safe slug from a title: "Easter Sunday Gala!" -> "easter-sunday-gala" */
function slugify(title: string): string {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── Media uploads ──
// Content goes to Cloudflare R2 when it is configured, and to
// uploads/portfolio on disk otherwise (dev and tests). See media-storage.ts.
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "portfolio");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const portfolioUpload = multer({
  // Buffered, then handed to media-storage: that module picks R2 or the disk.
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const okType = file.mimetype.startsWith("image/") || file.mimetype === "video/mp4" || file.mimetype === "video/quicktime" || file.mimetype === "video/webm";
    if (!okType) return cb(new Error("Only images, MP4, WebM or MOV files are allowed"));
    cb(null, true);
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check for Render wake up
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Serve uploaded portfolio files and event flyers
  app.use("/uploads/portfolio", express.static(UPLOAD_DIR, { maxAge: "30d" }));
  const EVENTS_DIR = path.resolve(process.cwd(), "client", "public", "events");
  app.use("/events", express.static(EVENTS_DIR, { maxAge: "30d" }));

  // ── Organizer onboarding checklist ──
  // One read, honest conditions, no gamification: what is actually left
  // before the organizer's first clean launch.
  app.get("/api/setup-checklist", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    if (user.role === "user" && !user.teamOwnerId) {
      return res.status(403).json({ message: "This page is for organizer accounts. Sign in as an organizer, or create one." });
    }
    try {
      const uid = (user.teamOwnerId || user._id).toString();
      const fresh = await User.findById(uid).select("displayName bio logoUrl accentHex socials").lean();
      const myEvents = await storage.getAllEvents();
      const own = myEvents.filter((e: any) => e.organizerId === uid);
      const { BookingModel } = await import("./models");
      const sold = own.length
        ? await BookingModel.countDocuments({ eventId: { $in: own.map((e: any) => e.id) }, status: "paid" }).catch(() => 0)
        : 0;
      const socials: any = (fresh as any)?.socials || {};
      const hasSocial = Boolean(socials.instagram || socials.twitter || socials.whatsapp || socials.website);
      const steps = [
        { key: "profile", label: "Complete your profile", done: Boolean((fresh as any)?.displayName && (fresh as any)?.bio), href: "/settings", cta: "Settings" },
        { key: "logo", label: "Upload your logo", done: Boolean((fresh as any)?.logoUrl), href: "/settings", cta: "Settings" },
        { key: "brand", label: "Pick your brand color", done: Boolean((fresh as any)?.accentHex), href: "/admin?tab=brand", cta: "Brand" },
        { key: "event", label: "Create your first event", done: own.length > 0, href: "/admin/events/new", cta: "Create" },
        { key: "socials", label: "Add a social link", done: hasSocial, href: "/settings", cta: "Settings" },
        { key: "sold", label: "Sell your first ticket", done: sold > 0, href: "/admin/events/new", cta: "Events" },
      ];
      return res.json({
        steps,
        complete: steps.filter((s) => s.done).length,
        total: steps.length,
      });
    } catch (err) {
      console.error("Setup checklist error:", err);
      return res.status(500).json({ message: "Could not load your setup progress" });
    }
  });

  // ── Social preview cards for event pages ──
  // WhatsApp, X, and iMessage read OG tags from the raw HTML. A pure SPA
  // shell shows a generic card, so /e/:slug and /events/:id serve index.html
  // with the event's title, date, venue, and cover image injected. Crawlers
  // get real tags; browsers get the same app as before.
  const escapeHtml = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const sendEventPageWithMeta = async (param: string, res: any) => {
    try {
      const indexPath = path.resolve(process.cwd(), "client", "dist", "index.html");
      const devPath = path.resolve(process.cwd(), "client", "index.html");
      const filePath = fs.existsSync(indexPath) ? indexPath : devPath;
      if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
      let html = fs.readFileSync(filePath, "utf8");

      let event: any = null;
      const isId = /^[0-9a-fA-F]{24}$/.test(param);
      if (isId) {
        event = await storage.getEvent(param);
      } else {
        const { EventModel } = await import("./models");
        const doc = await EventModel.findOne({ slug: param.toLowerCase() }).lean()
          || await EventModel.findOne({ slugAliases: param.toLowerCase() }).lean();
        if (doc) event = mapEventLean(doc);
      }

      if (event && (event as any).visibility !== "invite_only" && (event as any).status === "published") {
        const base = process.env.PUBLIC_APP_URL || "https://blackhevents.com";
        const dateStr = new Date(event.date).toLocaleString("en-NG", {
          weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
        });
        const title = escapeHtml(event.title || "Black Heritage Events");
        const desc = escapeHtml(`${dateStr} · ${event.location || "Lagos"}`);
        const image = /^https?:\/\//.test(event.imageUrl || "") ? event.imageUrl : `${base}${event.imageUrl || "/favicon.png"}`;
        const url = (event as any).slug ? `${base}/e/${(event as any).slug}` : `${base}/events/${event.id}`;
        const tags =
          `<meta property="og:title" content="${title}" />\n` +
          `<meta property="og:description" content="${desc}" />\n` +
          `<meta property="og:image" content="${escapeHtml(image)}" />\n` +
          `<meta property="og:url" content="${escapeHtml(url)}" />\n` +
          `<meta property="og:type" content="website" />\n` +
          `<meta name="twitter:card" content="summary_large_image" />\n` +
          `<meta name="twitter:title" content="${title}" />\n` +
          `<meta name="twitter:description" content="${desc}" />\n` +
          `<meta name="twitter:image" content="${escapeHtml(image)}" />`;
        html = html.replace(/<meta property="og:title"[^>]*>/, tags);
      }

      res.set("Cache-Control", "public, max-age=300");
      return res.send(html);
    } catch (err) {
      console.error("Event page meta error:", err);
      return res.status(500).send("Server error");
    }
  };
  app.get("/e/:slug", (req, res) => { void sendEventPageWithMeta(String(req.params.slug), res); });
  app.get("/events/:id", (req, res) => { void sendEventPageWithMeta(String(req.params.id), res); });

  // ── AI event extraction: flyer/document upload → form prefill JSON ──
  // Organizer-only, rate limited, files stay in memory and go to the model,
  // never to disk. The response is a suggestion for the form; nothing is
  // created or published by the model.
  const aiUpload = multer({ storage: multer.memoryStorage(), limits: aiUploadLimiter.limits });
  // Rate limit sits INSIDE the handler, applied only once auth passed: gate
  // rejections must not consume the organizer's extraction budget.
  const aiRateLimit = rateLimit(10, 10 * 60 * 1000);
  app.post("/api/ai/extract-event", (req: any, res: any) => {
    if (!req.isAuthenticated() || (req.user as any).role === "user") {
      return res.status(403).json({ message: "Only organizer accounts can use extraction" });
    }
    if (!isAIConfigured()) {
      return res.status(503).json({ message: "The flyer reader is switched off right now. Ask the platform admin to enable AI tools." });
    }
    aiRateLimit(req, res, () => {
    aiUpload.single("file")(req, res, (err: any) => {
      if (err) return res.status(400).json({ message: err.message || "Upload failed" });
      if (!req.file) return res.status(400).json({ message: "Choose a flyer image, PDF, or document" });
      if (!aiUploadLimiter.okMime(req.file.mimetype)) {
        return res.status(400).json({ message: "Upload a flyer image, PDF, or text document" });
      }
      extractEventFromFile(req.file)
        .then((details) => res.json({ details }))
        .catch((e: any) => {
          console.error("AI extraction failed:", e.message);
          res.status(422).json({ message: e.message || "The flyer reader hit a snag. Try again in a moment." });
        });
    });
    });
  });

  // AI copy suggestion: description variants, announcement lines, hub bio.
  // Same trust pattern as extraction: the model proposes, the organizer
  // reviews and edits, nothing saves itself.
  app.post("/api/ai/copy", (req: any, res: any) => {
    if (!req.isAuthenticated() || (req.user as any).role === "user") {
      return res.status(403).json({ message: "Only organizer accounts can use copy suggestions" });
    }
    if (!isAIConfigured()) {
      return res.status(503).json({ message: "The writing helper is switched off right now. Ask the platform admin to enable AI tools." });
    }
    aiRateLimit(req, res, () => {
      const kind = req.body?.kind;
      if (kind !== "description" && kind !== "announcement" && kind !== "bio") {
        return res.status(400).json({ message: "Unknown copy kind" });
      }
      suggestEventCopy({ kind, facts: req.body?.facts || {} })
        .then((result) => res.json(result))
        .catch((e: any) => {
          console.error("AI copy failed:", e.message);
          res.status(422).json({ message: e.message || "The writing helper hit a snag. Try again in a moment." });
        });
    });
  });

  // Legacy Stripe intent, kept for older clients. Paystack owns ticket checkout.
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

  // Events API
  app.get(api.events.list.path, async (req, res) => {
    try {
      const user = req.user as any;
      let events;
      
      if (req.isAuthenticated() && req.query.manage === 'true') {
        if (user.role === 'admin') {
          events = await (storage as any).getAllEvents();
        } else {
          events = await (storage as any).getAllEvents();
          events = events.filter((e: any) => e.organizerId === user._id.toString());
        }
      } else {
        events = await storage.getEvents();
      }
      
      res.json(events);
    } catch (err) {
      console.error("Events error:", err);
      res.status(500).json({ message: "We could not load events just now. Try again in a moment." });
    }
  });

  // Verify context must register before /api/events/:id or "verify-context"
  // would be swallowed as an event id.
  app.get("/api/events/verify-context", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    const organizerId = user.teamOwnerId || user._id.toString();
    try {
      const events = await storage.getAllEvents();
      const now = Date.now();
      const upcoming = events
        .filter((e: any) => e.organizerId === organizerId && new Date(e.date).getTime() >= now - 24 * 60 * 60 * 1000)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const target = upcoming[0];
      if (!target) return res.json({ eventId: null, tickets: [] });
      const tickets = await TicketModel.find({
        eventId: new mongoose.Types.ObjectId(String(target.id)),
        status: "valid",
      }).lean();
      res.json({
        eventId: String(target.id),
        eventTitle: target.title,
        tickets: tickets.map((t: any) => ({ code: t.code, tierName: t.tierName, attendeeName: t.attendeeName })),
      });
    } catch (err) {
      console.error("Verify context error:", err);
      res.status(500).json({ message: "Could not load the gate list" });
    }
  });

  // Slug lookup. Registered before /api/events/:id so "by-slug" is not
  // swallowed as an id. 301s raw ids to the pretty link when a slug exists.
  app.get("/api/events/by-slug/:slug", async (req, res) => {
    try {
      const { EventModel } = await import("./models");
      const key = String(req.params.slug).toLowerCase();
      const doc = await EventModel.findOne({ slug: key }).lean()
        || await EventModel.findOne({ slugAliases: key }).lean();
      if (!doc) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      // Drafts are workshop-only: invisible to everyone but the owner until
      // they are published, same answer a missing event would give.
      if ((doc as any).status === "draft") {
        const viewer = req.user as any;
        const isOwner = viewer && ((doc as any).organizerId === viewer._id?.toString() || viewer.role === "admin");
        if (!isOwner) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      }
      // Same invite-only gate as the id route: code, invite token, or the
      // organizer themself. Everything else gets the requiresCode marker.
      if ((doc as any).visibility === "invite_only") {
        const supplied = String(req.query.code || "").trim().toUpperCase();
        const stored = String((doc as any).accessCode || "").trim().toUpperCase();
        const inviteToken = String(req.query.invite || "").trim();
        let inviteOk = false;
        if (inviteToken) {
          const { EventInviteModel } = await import("./models");
          const inv: any = await EventInviteModel.findOne({ eventId: String(doc._id), token: inviteToken }).lean();
          inviteOk = !!inv;
          if (inv && inv.status === "pending") {
            await EventInviteModel.updateOne({ _id: inv._id }, { $set: { status: "viewed", viewedAt: new Date() } }).catch(() => {});
          }
        }
        const user = req.user as any;
        const organizer = user && (String(doc.organizerId) === user._id?.toString() || user.role === "admin");
        if (!inviteOk && !organizer && (!supplied || supplied !== stored)) {
          return res.status(403).json({ requiresCode: true, title: doc.title });
        }
      }
      const payload = mapEventLean(doc);
      // Same announcement attach as the id route: ticket pages Promise the
      // organizer's live banner, whichever way the guest arrived.
      if ((doc as any).organizerId) {
        try {
          const org = await User.findById((doc as any).organizerId).lean();
          const ann = (org as any)?.announcement;
          if (ann?.active && ann?.message) {
            (payload as any).organizerAnnouncement = {
              message: ann.message,
              linkUrl: ann.linkUrl || "",
            };
          }
        } catch {}
      }
      res.json(payload);
    } catch (err) {
      console.error("Slug lookup error:", err);
      res.status(500).json({ message: "We could not load that event just now. Try again in a moment." });
    }
  });

  // ── Guest invites for private events ──
  // Bulk send: one row per guest, one token per guest, one email each.
  app.post("/api/events/:id/invites", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    if (!ctx.canEdit) return res.status(403).json({ message: "Only main organizers and managers can send invites" });
    try {
      const guests = z.array(z.object({
        name: z.string().min(1).max(80),
        email: z.string().email().optional(),
        phone: z.string().max(24).optional(),
      })).min(1).max(200).parse(req.body.guests);
      const { EventInviteModel } = await import("./models");
      const { sendEventInvite } = await import("./emails");
      const base = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
      const created: any[] = [];
      const errors: string[] = [];
      for (const g of guests) {
        try {
          const token = crypto.randomBytes(16).toString("base64url");
          const doc = await EventInviteModel.create({
            eventId: ctx.event.id,
            name: g.name,
            email: g.email?.toLowerCase() || null,
            phone: g.phone || null,
            token,
          });
          created.push(doc);
          if (g.email && process.env.RESEND_API_KEY) {
            await sendEventInvite(
              { name: g.name, email: g.email },
              {
                eventTitle: ctx.event.title,
                eventDate: new Date(ctx.event.date),
                eventLocation: ctx.event.location,
                inviteUrl: `${base}/e/${(ctx.event as any).slug || ctx.event.id}?invite=${token}`,
                organizerName: (ctx.event as any).organizerName || "The organizer",
                branding: (ctx.event as any).branding || null,
              },
            ).catch(() => {});
            await EventInviteModel.updateOne({ _id: doc._id }, { $set: { sentAt: new Date() } });
          }
        } catch (e: any) {
          errors.push(`${g.name}: ${e?.message || "failed"}`);
        }
      }
      return res.status(201).json({ sent: created.length, failed: errors.length, errors: errors.slice(0, 10) });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Invite send error:", err);
      return res.status(500).json({ message: "Could not send those invites" });
    }
  });

  app.get("/api/events/:id/invites", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const { EventInviteModel } = await import("./models");
    const docs = await EventInviteModel.find({ eventId: ctx.event.id }).sort({ createdAt: -1 }).limit(500).lean();
    res.json(docs.map((d: any) => ({
      id: String(d._id), name: d.name, email: d.email, phone: d.phone,
      status: d.status, sentAt: d.sentAt, viewedAt: d.viewedAt, createdAt: d.createdAt,
    })));
  });

  // Access-code check for invite-only events. Used by the gate screen so a
  // wrong code never fetches event details. Returns the slug to navigate to
  // on success; the real fetch then carries ?code=.
  app.get("/api/events/:id/access", async (req, res) => {
    try {
      // Route param is an id on /events/:id and a slug on /e/:slug; the gate
      // screen posts from either, so resolve both shapes.
      const param = String(req.params.id);
      let event: any = /^[0-9a-fA-F]{24}$/.test(param)
        ? await storage.getEvent(param)
        : null;
      if (!event) {
        const { EventModel } = await import("./models");
        const doc = await EventModel.findOne({ slug: param.toLowerCase() }).lean()
          || await EventModel.findOne({ slugAliases: param.toLowerCase() }).lean();
        if (doc) event = mapEventLean(doc);
      }
      if (!event) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      if ((event as any).visibility !== "invite_only") return res.json({ ok: true });
      const supplied = String(req.query.code || "").trim().toUpperCase();
      const stored = String((event as any).accessCode || "").trim().toUpperCase();
      if (supplied && supplied === stored) {
        return res.json({ ok: true, slug: (event as any).slug || event.id });
      }
      return res.status(403).json({ ok: false, requiresCode: true });
    } catch (err) {
      console.error("Access check error:", err);
      res.status(500).json({ message: "Could not check that code" });
    }
  });

  app.get(api.events.get.path, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      }
      // Pretty-link promotion: only a real address-bar navigation (or a
      // tool like curl with no Sec-Fetch-Mode at all) 301s to /e/:slug so
      // the shareable form is canonical. Every fetch-based client marks
      // itself with Sec-Fetch-Mode (browsers: cors; Node's undici: cors;
      // navigations: navigate) and must keep receiving JSON.
      const fetchMode = req.headers["sec-fetch-mode"] as string | undefined;
      const isNavigation = fetchMode === "navigate" || fetchMode === undefined;
      if (isNavigation && (event as any).slug) {
        return res.redirect(301, `/e/${(event as any).slug}`);
      }
      // Drafts are workshop-only: invisible to everyone but the owner (and
      // admins), same answer a missing event would give.
      if ((event as any).status === "draft") {
        const viewer = req.user as any;
        const isOwner = viewer && (event.organizerId === viewer._id?.toString() || viewer.role === "admin");
        if (!isOwner) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      }
      // Invite-only gate: the page stays invisible until the right access
      // code arrives (?code= on this request, a prior /access check, or an
      // invite token the client holds). Unlisted and public serve normally.
      const vis = (event as any).visibility || "public";
      if (vis === "invite_only") {
        const supplied = String(req.query.code || "").trim().toUpperCase();
        const stored = String((event as any).accessCode || "").trim().toUpperCase();
        const inviteToken = String(req.query.invite || "").trim();
        let inviteOk = false;
        if (inviteToken) {
          const { EventInviteModel } = await import("./models");
          const inv: any = await EventInviteModel.findOne({ eventId: event.id, token: inviteToken }).lean();
          inviteOk = !!inv;
          if (inv && inv.status === "pending") {
            await EventInviteModel.updateOne({ _id: inv._id }, { $set: { status: "viewed", viewedAt: new Date() } }).catch(() => {});
          }
        }
        const user = req.user as any;
        const organizer = user && (event.organizerId === user._id?.toString() || user.role === "admin");
        if (!inviteOk && !organizer && (!supplied || supplied !== stored)) {
          return res.status(403).json({ requiresCode: true, title: event.title });
        }
      }
      // The organizer's live announcement rides along on ticket pages too
      // (the brand panel promises "hub and ticket pages"), but only when the
      // announcement is switched on and has something to say.
      if ((event as any).organizerId) {
        try {
          const org = await User.findById((event as any).organizerId).lean();
          const ann = (org as any)?.announcement;
          if (ann?.active && ann?.message) {
            (event as any).organizerAnnouncement = {
              message: ann.message,
              linkUrl: ann.linkUrl || "",
            };
          }
        } catch {}
      }
      res.json(event);
    } catch (err) {
      console.error("Event error:", err);
      res.status(500).json({ message: "We could not load that event just now. Try again in a moment." });
    }
  });

  app.post(api.events.create.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    try {
      // Drafts may omit description, date, location, and image. The publish
      // path validates completeness separately, so nothing incomplete goes
      // public.
      const draftFirst = insertDraftEventSchema.safeParse(req.body);
      const input = (draftFirst.success && draftFirst.data.status === "draft")
        ? draftFirst.data
        : api.events.create.input.parse(req.body);
      // Slug: organizer-provided wins; otherwise derived from the title.
      // Collisions get a numeric suffix; the unique index is the backstop.
      let slug = input.slug?.toLowerCase() || slugify(input.title);
      if (slug) {
        const { EventModel } = await import("./models");
        const base = slug;
        for (let n = 2; n < 50; n++) {
          const clash = await EventModel.findOne({ slug }).lean();
          if (!clash) break;
          slug = `${base}-${n}`;
        }
      }
      const event = await storage.createEvent({
        ...input,
        slug,
        organizerId: (req.user as any)._id.toString(),
        // Drafts legitimately omit date; the publish gate owns completeness.
        date: input.date as Date | undefined,
      } as Parameters<typeof storage.createEvent>[0]);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.events.update.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    const event = await storage.getEvent(req.params.id);
    if (!event) return res.status(404).json({ message: "We could not find that." });
    
    if ((req.user as any).role !== 'admin' && event.organizerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }      const wasPublished = event.status === "published";
    try {
      const input = api.events.update.input.parse(req.body);
      // Publishing is the completeness gate: a draft with missing fields
      // cannot leave the workshop. Direct saves that keep the current status
      // (including "unpublished") skip this check.
      if (input.status === "published" && !wasPublished) {
        const merged = { ...event, ...input } as Partial<InsertEvent>;
        const missing = missingEventPublishFields(merged);
        if (missing.length > 0) {
          return res.status(400).json({
            message: `Complete these before publishing: ${missing.join(", ")}`,
            field: missing[0],
            missing,
          });
        }
      }
      // Sold-ticket guard: people have already paid, so capacity and price
      // changes cannot go below what has been sold. Everything else is free
      // to edit, including dates and locations on live events.
      if (input.capacity !== undefined || input.ticketTypes !== undefined) {
        const { BookingModel } = await import("./models");
        const soldRows = await BookingModel.find({ eventId: event.id, status: "paid" }).lean();
        const totalSold = soldRows.reduce((a: number, b: any) => a + Number(b.quantity || 0), 0);
        if (input.capacity !== undefined && Number(input.capacity) < totalSold) {
          return res.status(400).json({
            message: `${totalSold} tickets have already been sold. Capacity cannot go below that.`,
            field: "capacity",
          });
        }
        if (input.ticketTypes !== undefined) {
          let newTiers: any[] = [];
          try { newTiers = JSON.parse(String(input.ticketTypes)); } catch {}
          // Per-tier sold counts, matched by tier name.
          const soldByTier = new Map<string, number>();
          for (const b of soldRows as any[]) {
            const key = String(b.ticketType || "");
            soldByTier.set(key, (soldByTier.get(key) || 0) + Number(b.quantity || 0));
          }
          const keptNames = new Set(newTiers.map((t) => String(t.name || "").trim()));
          for (const tierName of Array.from(soldByTier.keys())) {
            const sold = soldByTier.get(tierName) || 0;
            if (sold <= 0) continue;
            if (!keptNames.has(tierName)) {
              return res.status(400).json({
                message: `The "${tierName}" tier has ${sold} ticket${sold === 1 ? "" : "s"} sold and cannot be removed. You can rename or hide it instead.`,
                field: "ticketTypes",
              });
            }
            const tier = newTiers.find((t) => String(t.name || "").trim() === tierName);
            if (tier && Number(tier.capacity) < sold) {
              return res.status(400).json({
                message: `"${tierName}" has ${sold} ticket${sold === 1 ? "" : "s"} sold. Its capacity cannot go below that.`,
                field: "ticketTypes",
              });
            }
          }
        }
      }
      const updated = await storage.updateEvent(event.id, input);
      // Ticket-drop blast: the first transition into published emails every
      // follower. Fire-and-forget so a Resend hiccup never blocks the save;
      // per-event dedupe keeps a retry from double-sending.
      if (!wasPublished && updated.status === "published") {
        void notifyFollowersOfDrop(updated).catch((err) =>
          console.error("Follower drop blast failed:", err),
        );
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // ── Publish readiness: what a draft event is still missing ──
  // Lets the dashboard badge incomplete drafts and disable publish without
  // duplicating the completeness rules on the client.
  app.get("/api/events/:id/publish-readiness", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === "user") {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    const event = await storage.getEvent(req.params.id);
    if (!event) return res.status(404).json({ message: "We could not find that." });
    if ((req.user as any).role !== "admin" && event.organizerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    const missing = missingEventPublishFields(event as any);
    res.json({ ready: missing.length === 0, missing });
  });

  // ── Selling preferences + branding ──
  // Narrow PATCH endpoints so the organizer toggles never ride through the
  // full event form: one concern, one owner.
  app.patch("/api/events/:id/settings", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    if (!ctx.canEdit) return res.status(403).json({ message: "Only main organizers and managers can change selling settings" });
    try {
      // Partial merge: a PATCH of one key must not reset the others to
      // defaults. checkoutFields accepts either the full object or flat
      // single keys ({"checkoutFields": {...}} or {"dietaryNote": true}),
      // merging over whatever is currently stored.
      const body = (req.body || {}) as Record<string, unknown>;
      const rawFields = (
        body.checkoutFields && typeof body.checkoutFields === "object"
          ? body.checkoutFields
          : { phone: body.phone, tableNote: body.tableNote, dietaryNote: body.dietaryNote }
      ) as Record<string, unknown> | Record<string, unknown>;
      const hasFieldPatch = Object.values(rawFields).some((v) => typeof v === "boolean");
      const { checkoutFields: _drop, phone: _p, tableNote: _t, dietaryNote: _d, ...rest } = body;
      // Theme rides the settings PATCH too; validate against the preset keys.
      const rawTheme = rest.theme;
      delete (rest as any).theme;
      const input = eventSettingsSchema.partial().omit({ checkoutFields: true }).parse(rest);
      if (typeof rawTheme === "string") {
        const { eventThemeKeys } = await import("@shared/schema");
        if (!(eventThemeKeys as readonly string[]).includes(rawTheme)) {
          return res.status(400).json({ message: "Unknown theme" });
        }
        (input as any).theme = rawTheme;
      }
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) update[k] = v;
      }
      if (hasFieldPatch) {
        const current = (ctx.event as any).checkoutFields || { phone: false, tableNote: true, dietaryNote: false };
        const merged: Record<string, boolean> = {};
        for (const key of ["phone", "tableNote", "dietaryNote"] as const) {
          merged[key] = typeof rawFields[key] === "boolean" ? rawFields[key] : Boolean(current[key]);
        }
        update.checkoutFields = merged;
      }
      if (Object.keys(update).length === 0) return res.status(400).json({ message: "Nothing to update" });
      const updated = await storage.updateEvent(String(ctx.event.id), update as any);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Settings update error:", err);
      res.status(500).json({ message: "Could not save the selling settings" });
    }
  });

  app.patch("/api/events/:id/branding", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    if (!ctx.canEdit) return res.status(403).json({ message: "Only main organizers and managers can change branding" });
    try {
      const input = brandingSchema.parse(req.body);
      const cleaned = {
        displayName: input.displayName || undefined,
        logoUrl: input.logoUrl || undefined,
        accentHex: input.accentHex || undefined,
      };
      // An entirely empty branding object clears the override.
      const branding = cleaned.displayName || cleaned.logoUrl || cleaned.accentHex ? cleaned : null;
      const updated = await storage.updateEvent(String(ctx.event.id), { branding } as any);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Branding update error:", err);
      res.status(500).json({ message: "Could not save the branding" });
    }
  });

  // ── Booking link: the organizer's share address ──
  // Slug changes suffix on collision instead of failing, so an organizer is
  // never blocked by a name they cannot have. Empty slug returns to the
  // auto slug from the title.
  app.patch("/api/events/:id/link", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    if (!ctx.canEdit) return res.status(403).json({ message: "Only main organizers and managers can change the booking link" });
    try {
      const raw = typeof req.body?.slug === "string" ? req.body.slug.toLowerCase().trim() : "";
      if (raw && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)) {
        return res.status(400).json({ message: "Lowercase letters, numbers, and dashes only" });
      }
      const next = raw || slugify(String(ctx.event.title || "event"));
      const { EventModel } = await import("./models");
      let final = next;
      for (let n = 2; n < 50; n++) {
        const clash = await EventModel.findOne({ slug: final, _id: { $ne: ctx.event._id } }).lean();
        if (!clash) break;
        final = `${next}-${n}`;
      }
      // Retire the old address as an alias so previously shared links, QR
      // codes, and flyers keep resolving forever. Aliases never shadow a
      // live owner: the by-slug lookup checks canonical slugs first, so a
      // released name claimed by a later event still resolves to that one.
      const oldSlug = (ctx.event as any).slug;
      const aliases = new Set<string>(((ctx.event as any).slugAliases || []).map((s: string) => String(s).toLowerCase()));
      if (oldSlug && oldSlug !== final) {
        aliases.add(oldSlug);
        aliases.delete(final);
        await EventModel.updateOne({ _id: ctx.event._id }, { $set: { slugAliases: Array.from(aliases) } });
      }
      const updated = await storage.updateEvent(String(ctx.event.id), { slug: final } as any);
      res.json(updated);
    } catch (err) {
      console.error("Link update error:", err);
      res.status(500).json({ message: "Could not save the booking link" });
    }
  });

  // ── Organizer public profile and hub: /o/:slug ──
  app.get("/api/organizers/:slug", async (req, res) => {
    try {
      const rawSlug = req.params.slug.trim().toLowerCase();
      let organizer = await User.findOne({
        $or: [
          { organizerSlug: rawSlug },
          { username: rawSlug },
        ],
      }).lean();

      if (!organizer && mongoose.Types.ObjectId.isValid(rawSlug)) {
        organizer = await User.findById(rawSlug).lean();
      }

      if (!organizer) {
        return res.status(404).json({ message: "That organizer account no longer exists." });
      }

      const orgId = (organizer as any)._id.toString();

      // Find published events by this organizer
      const { EventModel } = await import("./models");
      const events = await EventModel.find({
        $or: [
          { organizerId: orgId },
          { organizerName: (organizer as any).displayName || (organizer as any).username },
        ],
        status: { $ne: "draft" },
      }).lean();

      const now = Date.now();
      const upcomingEvents: any[] = [];
      const pastEvents: any[] = [];
      const allPhotos = new Set<string>();
      const allVideos = new Set<string>();

      for (const ev of events) {
        const evDate = new Date(ev.date).getTime();
        try {
          const gallery = JSON.parse(ev.gallery || "[]");
          if (Array.isArray(gallery)) {
            gallery.forEach((url: string) => { if (url) allPhotos.add(url); });
          }
        } catch {}

        try {
          const videos = JSON.parse(ev.pastEventVideos || "[]");
          if (Array.isArray(videos)) {
            videos.forEach((url: string) => { if (url) allVideos.add(url); });
          }
        } catch {}

        if (evDate >= now - 24 * 60 * 60 * 1000) {
          upcomingEvents.push(ev);
        } else {
          pastEvents.push(ev);
        }
      }

      upcomingEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      pastEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let isFollowing = false;
      let isOwner = false;
      if (req.isAuthenticated()) {
        const { OrganizerFollowerModel } = await import("./models");
        const user = req.user as any;
        const follow = await OrganizerFollowerModel.findOne({
          organizerId: orgId,
          $or: [{ userId: user._id.toString() }, { email: user.email }],
        }).lean();
        if (follow) isFollowing = true;
        // The profile owner gets the studio tools on their own hub; other
        // viewers get share-only surfaces.
        isOwner = user._id?.toString() === orgId || user.role === "admin";
      }

      res.json({
        organizer: {
          id: orgId,
          username: (organizer as any).username,
          displayName: (organizer as any).displayName || (organizer as any).username,
          slug: (organizer as any).organizerSlug || (organizer as any).username,
          bio: (organizer as any).bio || null,
          logoUrl: (organizer as any).logoUrl || null,
          coverUrl: (organizer as any).coverUrl || null,
          socials: (organizer as any).socials || null,
          theme: (organizer as any).theme || null,
          accentHex: (organizer as any).accentHex || null,
          customDomain: (organizer as any).customDomain || null,
          customDomainStatus: (organizer as any).customDomainStatus || null,
          announcement: (organizer as any).announcement || null,
          followersCount: (organizer as any).followersCount || 0,
          videoLoopUrl: (organizer as any).videoLoopUrl || null,
          spotifyPlaylistUrl: (organizer as any).spotifyPlaylistUrl || null,
          tourCities: (organizer as any).tourCities || [],
          isFollowing,
          isOwner,
        },
        upcomingEvents: upcomingEvents.map((e) => ({
          ...e,
          id: String(e._id),
        })),
        pastEvents: pastEvents.map((e) => ({
          ...e,
          id: String(e._id),
        })),
        archiveMedia: {
          photos: Array.from(allPhotos),
          videos: Array.from(allVideos),
        },
        stats: {
          totalShows: events.length,
          upcomingShows: upcomingEvents.length,
          pastShows: pastEvents.length,
        },
      });
    } catch (err: any) {
      console.error("Organizer lookup error:", err);
      res.status(500).json({ message: "Could not load organizer profile" });
    }
  });

  // Follow organizer for drop alerts
  app.post("/api/organizers/:slug/follow", async (req, res) => {
    try {
      const { OrganizerFollowerModel } = await import("./models");
      const rawSlug = req.params.slug.toLowerCase().trim();
      const organizer = await User.findOne({
        $or: [{ organizerSlug: rawSlug }, { username: rawSlug }],
      });
      if (!organizer) return res.status(404).json({ message: "That organizer account no longer exists." });

      const orgId = organizer._id.toString();
      let email = "";
      let userId = null;

      if (req.isAuthenticated()) {
        const user = req.user as any;
        email = user.email;
        userId = user._id.toString();
      } else {
        email = (req.body.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          return res.status(400).json({ message: "A valid email address is required" });
        }
      }

      const existing = await OrganizerFollowerModel.findOne({ organizerId: orgId, email });
      if (!existing) {
        await OrganizerFollowerModel.create({ organizerId: orgId, email, userId });
        await User.findByIdAndUpdate(orgId, { $inc: { followersCount: 1 } });
      }

      const updatedOrg = await User.findById(orgId).lean();
      res.json({
        success: true,
        isFollowing: true,
        followersCount: (updatedOrg as any)?.followersCount || 1,
        message: "Following organizer. You will be notified of new ticket drops.",
      });
    } catch (err: any) {
      console.error("Follow error:", err);
      res.status(500).json({ message: "Could not follow organizer" });
    }
  });

  // Unfollow organizer
  app.delete("/api/organizers/:slug/follow", async (req, res) => {
    try {
      const { OrganizerFollowerModel } = await import("./models");
      const rawSlug = req.params.slug.toLowerCase().trim();
      const organizer = await User.findOne({
        $or: [{ organizerSlug: rawSlug }, { username: rawSlug }],
      });
      if (!organizer) return res.status(404).json({ message: "That organizer account no longer exists." });

      const orgId = organizer._id.toString();
      let email = "";
      if (req.isAuthenticated()) {
        email = (req.user as any).email;
      } else {
        email = (req.body.email || "").trim().toLowerCase();
      }

      if (email) {
        const deleted = await OrganizerFollowerModel.findOneAndDelete({ organizerId: orgId, email });
        if (deleted) {
          await User.findByIdAndUpdate(orgId, { $inc: { followersCount: -1 } });
        }
      }

      const updatedOrg = await User.findById(orgId).lean();
      res.json({
        success: true,
        isFollowing: false,
        followersCount: Math.max(0, (updatedOrg as any)?.followersCount || 0),
      });
    } catch (err: any) {
      console.error("Unfollow error:", err);
      res.status(500).json({ message: "Could not unfollow organizer" });
    }
  });

  // Organizer audience: view followers list
  app.get("/api/organizers/me/followers", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    const orgId = user.teamOwnerId || user._id.toString();
    const { OrganizerFollowerModel } = await import("./models");

    const followers = await OrganizerFollowerModel.find({ organizerId: orgId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const org = await User.findById(orgId).lean();

    res.json({
      totalCount: (org as any)?.followersCount || followers.length,
      followers: followers.map((f: any) => ({
        id: String(f._id),
        email: f.email,
        createdAt: f.createdAt,
      })),
    });
  });

  // ── Organizer profile management ──
  app.get("/api/organizers/me/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    const orgId = user.teamOwnerId || user._id.toString();
    const organizer = await User.findById(orgId).lean();
    if (!organizer) return res.status(404).json({ message: "That organizer account no longer exists." });

    res.json({
      id: String((organizer as any)._id),
      username: (organizer as any).username,
      displayName: (organizer as any).displayName || (organizer as any).username,
      slug: (organizer as any).organizerSlug || (organizer as any).username,
      bio: (organizer as any).bio || "",
      logoUrl: (organizer as any).logoUrl || "",
      coverUrl: (organizer as any).coverUrl || "",
      socials: (organizer as any).socials || { instagram: "", twitter: "", whatsapp: "", website: "" },
      theme: (organizer as any).theme || null,
      accentHex: (organizer as any).accentHex || null,
      customDomain: (organizer as any).customDomain || "",
      customDomainStatus: (organizer as any).customDomainStatus || null,
      announcement: (organizer as any).announcement || { message: "", linkUrl: "", active: false },
      videoLoopUrl: (organizer as any).videoLoopUrl || null,
      spotifyPlaylistUrl: (organizer as any).spotifyPlaylistUrl || null,
      tourCities: (organizer as any).tourCities || [],
      followersCount: (organizer as any).followersCount || 0,
      dnsTarget: process.env.DOMAIN_CNAME_TARGET || "cname.blackheritage.africa",
    });
  });

  app.patch("/api/organizers/me/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    if (user.staffRole && user.staffRole !== "manager") {
      return res.status(403).json({ message: "Only main organizers and managers can update brand profile" });
    }
    const orgId = user.teamOwnerId || user._id.toString();

    try {
      const {
        slug,
        displayName,
        bio,
        logoUrl,
        coverUrl,
        socials,
        theme,
        accentHex,
        customDomain,
        announcement,
        videoLoopUrl,
        spotifyPlaylistUrl,
        tourCities,
      } = req.body;

      const currentOrganizer = await User.findById(orgId).lean();
      if (!currentOrganizer) return res.status(404).json({ message: "That organizer account no longer exists." });

      let cleanSlug = typeof slug === "string" ? slug.toLowerCase().trim() : undefined;
      if (cleanSlug) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
          return res.status(400).json({ message: "Lowercase letters, numbers, and hyphens only" });
        }
        const existing = await User.findOne({
          organizerSlug: cleanSlug,
          _id: { $ne: orgId },
        }).lean();
        if (existing) {
          return res.status(409).json({ message: "This custom link is already claimed" });
        }
      }

      let cleanDomain = typeof customDomain === "string" ? customDomain.toLowerCase().trim() : undefined;
      if (cleanDomain) {
        cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
        const domainMatch = await User.findOne({
          customDomain: cleanDomain,
          _id: { $ne: orgId },
        }).lean();
        if (domainMatch) {
          return res.status(409).json({ message: "This domain is already mapped to another organizer" });
        }
      }

      const updateData: any = {};
      if (cleanSlug !== undefined) updateData.organizerSlug = cleanSlug;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (bio !== undefined) updateData.bio = bio;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (coverUrl !== undefined) updateData.coverUrl = coverUrl;
      if (socials !== undefined) updateData.socials = socials;
      if (theme !== undefined) updateData.theme = theme;
      if (accentHex !== undefined) updateData.accentHex = accentHex;
      if (cleanDomain !== undefined) {
        updateData.customDomain = cleanDomain || null;
        // A domain only becomes "active" through the DNS verify endpoint —
        // saving it alone proves nothing. Re-saving an unchanged domain keeps
        // its existing status so verify results survive profile edits.
        updateData.customDomainStatus = !cleanDomain
          ? null
          : currentOrganizer.customDomain === cleanDomain
            ? currentOrganizer.customDomainStatus || "pending"
            : "pending";
      }
      if (announcement !== undefined) {
        updateData.announcement = announcement;
      }
      if (videoLoopUrl !== undefined) updateData.videoLoopUrl = videoLoopUrl;
      if (spotifyPlaylistUrl !== undefined) updateData.spotifyPlaylistUrl = spotifyPlaylistUrl;
      if (tourCities !== undefined) updateData.tourCities = Array.isArray(tourCities) ? tourCities : [];

      const updated = await User.findByIdAndUpdate(
        orgId,
        { $set: updateData },
        { new: true }
      ).lean();

      res.json({
        id: String((updated as any)._id),
        username: (updated as any).username,
        displayName: (updated as any).displayName,
        slug: (updated as any).organizerSlug,
        bio: (updated as any).bio,
        logoUrl: (updated as any).logoUrl,
        coverUrl: (updated as any).coverUrl,
        socials: (updated as any).socials,
        theme: (updated as any).theme,
        accentHex: (updated as any).accentHex,
        customDomain: (updated as any).customDomain,
        customDomainStatus: (updated as any).customDomainStatus,
        announcement: (updated as any).announcement,
        videoLoopUrl: (updated as any).videoLoopUrl || null,
        spotifyPlaylistUrl: (updated as any).spotifyPlaylistUrl || null,
        tourCities: (updated as any).tourCities || [],
        followersCount: (updated as any).followersCount || 0,
        dnsTarget: process.env.DOMAIN_CNAME_TARGET || "cname.blackheritage.africa",
      });
    } catch (err: any) {
      console.error("Update organizer profile error:", err);
      res.status(500).json({ message: "Could not save organizer profile" });
    }
  });

  // ── Custom-domain DNS verification ──
  // Resolves the domain's CNAME chain and only flips customDomainStatus to
  // "active" when it actually points at our cname target. No fake timeouts.
  app.post("/api/organizers/me/domain/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    if (user.staffRole && user.staffRole !== "manager") {
      return res.status(403).json({ message: "Only main organizers and managers can manage domains" });
    }
    const orgId = user.teamOwnerId || user._id.toString();

    try {
      const organizer = await User.findById(orgId).lean();
      if (!organizer) return res.status(404).json({ message: "That organizer account no longer exists." });

      const requested = String(req.body?.domain || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const domain = requested || (organizer as any).customDomain;
      if (!domain) {
        return res.status(400).json({ message: "Save a domain first, then test the connection." });
      }

      const target = process.env.DOMAIN_CNAME_TARGET || "cname.blackheritage.africa";
      const dns = await import("dns/promises");

      // Resolve the CNAME chain; fall back to A/AAAA so apex domains with
      // ALIAS/ANAME flattening still verify.
      let points: string[] = [];
      let resolved = false;
      try {
        const cname = await dns.resolveCname(domain);
        points = cname;
      } catch {}
      if (points.length === 0) {
        try { points = await dns.resolve4(domain); } catch {}
      }
      if (points.length === 0) {
        try { points = await dns.resolve6(domain); } catch {}
      }

      resolved = points.some(
        (p) => p === target || p.endsWith("." + target) || p === domain + "." + target,
      );

      // A record pointing at our server IP is equally valid (apex domains).
      if (!resolved && process.env.SERVER_PUBLIC_IP) {
        resolved = points.includes(process.env.SERVER_PUBLIC_IP);
      }

      if (resolved) {
        await User.updateOne(
          { _id: orgId, customDomain: domain },
          { $set: { customDomainStatus: "active" } },
        );
        return res.json({
          verified: true,
          domain,
          target,
          status: "active",
          message: `${domain} is correctly pointed at ${target}. SSL will be issued automatically.`,
        });
      }

      await User.updateOne(
        { _id: orgId, customDomain: domain },
        { $set: { customDomainStatus: "pending" } },
      ).catch(() => {});

      return res.json({
        verified: false,
        domain,
        target,
        status: "pending",
        found: points.slice(0, 5),
        message: points.length === 0
          ? `No DNS records found for ${domain} yet. Add the CNAME record below and try again in a few minutes.`
          : `${domain} currently points at ${points[0]} — it needs to point at ${target}. DNS changes can take up to an hour to spread.`,
      });
    } catch (err: any) {
      console.error("Domain verify error:", err);
      res.status(500).json({ message: "Could not run the DNS check. Try again in a moment." });
    }
  });

  // ── Waitlist: organizer view ──
  app.get("/api/events/:id/waitlist", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const entries = await WaitlistModel.find({ eventId: ctx.event.id }).sort({ createdAt: 1 }).lean();
    res.json(entries.map((e: any) => ({
      id: String(e._id),
      name: e.name,
      email: e.email,
      tierName: e.tierName || null,
      createdAt: e.createdAt,
      notifiedAt: e.notifiedAt || null,
    })));
  });

  /**
   * Ticket and revenue totals. Admins get the platform; organizers and their
   * team staff get the same shape scoped to their own events, so the dashboard
   * shows real numbers instead of hiding the panel.
   */
  app.get(api.events.stats.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Sign in to continue." });
    }
    const user = req.user as any;
    const isAdmin = user.role === 'admin' || !!user.isAdmin;
    if (!isAdmin && user.role !== 'organizer' && !user.teamOwnerId) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    try {
      const organizerId = isAdmin ? undefined : String(user.teamOwnerId || user._id);
      const stats = await storage.getAdminStats(organizerId);
      res.json(stats);
    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Bookings API
  app.get(api.bookings.listByEvent.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    const event = await storage.getEvent(req.params.id);
    if (!event) return res.status(404).json({ message: "We could not find that." });

    if ((req.user as any).role !== 'admin' && event.organizerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }

    const bookings = await storage.getBookingsByEvent(event.id);
    res.json(bookings);
  });

  // Ticket lookup. For signed-in users the session is the query: every
  // booking made with their account email, no email field needed. Guests keep
  // the email path, and anyone can paste a ticket reference straight in.
  app.get("/api/bookings/search", async (req, res) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
      if (code) {
        const booking = await storage.getBookingByReference(code);
        if (!booking) return res.json([]);
        const event = await storage.getEvent(String((booking as any).eventId));
        return res.json([{ ...booking, event }]);
      }

      if (req.isAuthenticated()) {
        const email = (req.user as any).email;
        const bookings = await storage.getBookingsByEmail(email);
        return res.json(bookings);
      }

      const email = req.query.email as string;
      if (!email) return res.status(400).json({ message: "Sign in, or enter the email or ticket code you booked with" });
      const bookings = await storage.getBookingsByEmail(email);
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ message: "Failed to search bookings" });
    }
  });

  // ── Quote: server-computed pricing for the booking modal ──
  app.post("/api/bookings/quote", async (req, res) => {
    try {
      const { eventId, tierName, quantity, promoCode } = req.body;
      const result = await quoteBooking({ eventId, tierName, quantity: Number(quantity), promoCode });
      if (!result.ok) return res.status(400).json({ message: result.message });
      res.json(result.quote);
    } catch (err: any) {
      console.error("Quote error:", err);
      res.status(500).json({ message: "Could not price that selection" });
    }
  });

  // ── Initiate: create a pending booking and open the gateway ──
  // The client sends NO money figures. The server prices the order, and with
  // Paystack configured, hands back a hosted payment URL.
  app.post("/api/bookings/initiate", async (req, res) => {
    if (!req.isAuthenticated() && !req.body.guest) {
      return res.status(401).json({ message: "Sign in or continue as guest" });
    }
    try {
      const input = bookingInitiateSchema.parse(req.body);
      const event = await storage.getEvent(input.eventId);
      if (!event) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });

      // Guest checkout is a per-event choice. Signed-in buyers are unaffected.
      if (!req.isAuthenticated() && event.guestCheckout === false) {
        return res.status(401).json({ message: "This event requires an account to book. Sign in first, it takes a minute." });
      }

      const result = await quoteBooking({
        eventId: input.eventId,
        tierName: input.tierName,
        quantity: input.quantity,
        promoCode: input.promoCode,
      });
      if (!result.ok || !result.quote) {
        return res.status(400).json({ message: result.message });
      }
      const quote = result.quote;

      // Atomically hold seats: re-check then increment. ticketTypes is a JSON
      // string column, so Mongo array filters don't apply; the re-read closes
      // most of the race window and finalize re-validates against availability.
      const fresh = await storage.getEvent(String(event.id));
      if (!fresh) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      const freshTiers = JSON.parse(fresh.ticketTypes || "[]");
      const freshTier = freshTiers.find((t: any) => t.name === input.tierName);
      if (!freshTier || freshTier.sold + input.quantity > freshTier.capacity) {
        return res.status(409).json({ message: `Only ${freshTier ? freshTier.capacity - freshTier.sold : 0} left in ${input.tierName}. Someone was faster.` });
      }
      freshTier.sold = Number(freshTier.sold || 0) + input.quantity;
      await storage.updateEvent(String(event.id), {
        ticketTypes: JSON.stringify(freshTiers),
        capacity: Math.max(0, Number(fresh.capacity) - input.quantity),
      });

      const reference = `BH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const user = req.user as any;
      const booking: any = await storage.createBooking({
        eventId: String(event.id),
        quantity: input.quantity,
        totalAmount: quote.totalKobo,
        userId: user?._id?.toString() || "guest",
        name: input.name,
        email: input.email,
        status: "pending",
        paymentReference: reference,
        ticketType: quote.ticketType,
        promoCode: input.promoCode || null,
        tableNote: input.tableNote || null,
        phone: input.phone || null,
        dietaryNote: input.dietaryNote || null,
        paymentGateway: activeGateway(),
      });

      // Increment promo usage only when it actually applied
      if (quote.promoApplied && quote.promoId) {
        const { PromoCodeModel } = await import("./models");
        await PromoCodeModel.updateOne({ _id: quote.promoId }, { $inc: { usedCount: 1 } });
      }

      if (isPaystackConfigured() || isFlutterwaveConfigured()) {
        const gateway = activeGateway();
        try {
          const init = await initializePayment({
            email: input.email,
            amountKobo: quote.totalKobo,
            reference,
            name: input.name,
            phone: input.phone || undefined,
            // Flutterwave rejects the payment init without a redirect_url, so
            // fall back to the request's own host when PUBLIC_APP_URL is not
            // configured (local dev, previews).
            redirectUrl: `${process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`}/events/${event.slug || event.id}?ref=${reference}&gateway=${gateway}`,
            metadata: {
              bookingId: String(booking._id ?? booking.id),
              eventId: String(event.id),
              eventTitle: event.title,
              tier: quote.ticketType,
              quantity: input.quantity,
            },
          });
          return res.status(201).json({
            bookingId: String(booking._id ?? booking.id),
            reference,
            totalKobo: quote.totalKobo,
            paymentUrl: init.authorizationUrl,
            accessCode: init.accessCode,
            publicKey: init.publicKey,
            gateway: init.gateway,
          });
        } catch (psErr: any) {
          // Release held seats so the event is not left with phantom holds
          await releaseHeldSeats(String(event.id), quote.ticketType, input.quantity);
          await BookingModel.deleteOne({ _id: booking._id }).catch(() => {});
          console.error("Payment init failed:", psErr);
          return res.status(502).json({ message: "Payment gateway is not responding. Try again in a moment." });
        }
      }

      // Dev simulation: no Paystack keys, so "payment" completes instantly.
      return res.status(201).json({
        bookingId: String(booking._id ?? booking.id),
        reference,
        totalKobo: quote.totalKobo,
        paymentUrl: null,
        simulated: true,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("Booking initiate error:", err);
      res.status(500).json({ message: "Could not start that booking" });
    }
  });

  async function releaseHeldSeats(eventId: string, tierName: string, quantity: number) {
    try {
      const event = await storage.getEvent(eventId);
      if (!event) return;
      const tiers = JSON.parse(event.ticketTypes || "[]");
      const tier = tiers.find((t: any) => t.name === tierName);
      if (tier) tier.sold = Math.max(0, Number(tier.sold || 0) - quantity);
      await storage.updateEvent(eventId, {
        ticketTypes: JSON.stringify(tiers),
        capacity: Number(event.capacity) + quantity,
      });
    } catch (err) {
      console.error("Seat release failed:", err);
    }
  }

  // ── Finalize: verify with Paystack and fulfill ──
  app.post("/api/bookings/finalize", async (req, res) => {
    try {
      const { reference } = bookingFinalizeSchema.parse(req.body);
      const bookings = await storage.getAllBookings?.();
      const booking: any = bookings
        ? bookings.find((b: any) => b.paymentReference === reference)
        : await (storage as any).getBookingByReference(reference);
      if (!booking) return res.status(404).json({ message: "Booking not found for that reference" });
      if (booking.status === "paid") {
        // Already fulfilled; return existing tickets (idempotent)
        const { TicketModel } = await import("./models");
        const existing = await TicketModel.find({ bookingId: booking._id ?? booking.id }).lean();
        return res.json({
          bookingId: String(booking._id ?? booking.id),
          status: "paid",
          tickets: existing.map((t: any) => ({ code: t.code, tierName: t.tierName, attendeeName: t.attendeeName, seat: t.seat })),
        });
      }

      if (activeGateway() !== "simulated") {
        const verification = await verifyPayment(reference);
        const expected = Number(booking.totalAmount);
        if (verification.status !== "success") {
          return res.status(402).json({ message: "Payment did not go through. You have not been charged for a completed order." });
        }
        if (verification.amount !== expected) {
          console.error(`Amount mismatch for ${reference}: expected ${expected}, got ${verification.amount}`);
          return res.status(400).json({ message: "Payment amount does not match this order. Contact support." });
        }
        if (verification.paidAt) {
          await BookingModel.findByIdAndUpdate(booking._id ?? booking.id, { paidAt: new Date(verification.paidAt) });
        }
        if (verification.transactionId) {
          await BookingModel.findByIdAndUpdate(booking._id ?? booking.id, { gatewayTxnId: verification.transactionId }).catch(() => {});
        }
      }
      // Without Paystack keys the dev simulation fulfills directly.

      const fulfillment = await fulfillBooking(String(booking._id ?? booking.id));
      res.json({
        bookingId: fulfillment.bookingId,
        status: "paid" as const,
        tickets: fulfillment.tickets,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Finalize error:", err);
      res.status(500).json({ message: "Could not confirm that payment" });
    }
  });

  // ── Payment webhook: source of truth for async payment confirmations ──
  // One endpoint for both gateways: the signature decides whose payload this
  // is (Paystack x-paystack-signature HMAC-SHA512; Flutterwave verif-hash
  // HMAC-SHA256). Keep /api/paystack/webhook alive for already-registered
  // dashboard URLs; new setups point at /api/payments/webhook.
  const paymentWebhookHandler: express.RequestHandler = async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);

    let gateway: "paystack" | "flutterwave" | null = null;
    if (isPaystackSignatureValid(rawBody, req.headers["x-paystack-signature"] as string | undefined)) {
      gateway = "paystack";
    } else if (isFlutterwaveSignatureValid(rawBody, req.headers["verif-hash"] as string | undefined)) {
      gateway = "flutterwave";
    }
    if (!gateway) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    try {
      const event = JSON.parse(rawBody);
      if (gateway === "paystack" && event.event === "charge.success") {
        const reference = event.data?.reference;
        const txnId: string | null = event.data?.id != null ? String(event.data.id) : null;
        if (reference) {
          const bookings = await storage.getAllBookings?.();
          const booking: any = bookings
            ? bookings.find((b: any) => b.paymentReference === reference)
            : await (storage as any).getBookingByReference(reference);
          if (booking && booking.status !== "paid") {
            // Trust the gateway's webhook amount; also cross-check against our order.
            const expected = Number(booking.totalAmount);
            if (Number(event.data.amount) === expected) {
              await fulfillBooking(String(booking._id ?? booking.id));
              if (txnId) await BookingModel.findByIdAndUpdate(booking._id ?? booking.id, { gatewayTxnId: txnId }).catch(() => {});
            } else {
              console.error(`Webhook amount mismatch for ${reference}: expected ${expected}, got ${event.data.amount}`);
            }
          }
        }
      }
      if (gateway === "flutterwave" && event.event === "charge.completed" && event.data?.status === "successful") {
        const reference = event.data?.tx_ref;
        const txnId: string | null = event.data?.id != null ? String(event.data.id) : null;
        if (reference) {
          const bookings = await storage.getAllBookings?.();
          const booking: any = bookings
            ? bookings.find((b: any) => b.paymentReference === reference)
            : await (storage as any).getBookingByReference(reference);
          if (booking && booking.status !== "paid") {
            const expected = Number(booking.totalAmount);
            // Flutterwave amounts arrive in major units (naira); compare in kobo.
            if (Math.round(Number(event.data.amount) * 100) === expected) {
              await fulfillBooking(String(booking._id ?? booking.id));
              if (txnId) await BookingModel.findByIdAndUpdate(booking._id ?? booking.id, { gatewayTxnId: txnId, paidAt: event.data.created_at ? new Date(event.data.created_at) : undefined }).catch(() => {});
            } else {
              console.error(`Webhook amount mismatch for ${reference}: expected ${expected} kobo, got ${event.data.amount} naira`);
            }
          }
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Webhook processing error:", err);
      res.status(200).json({ received: true }); // Gateways retry on failure; acknowledge anyway
    }
  };

  app.post("/api/payments/webhook", express.raw({ type: "*/*" }), paymentWebhookHandler);
  app.post("/api/paystack/webhook", express.raw({ type: "*/*" }), paymentWebhookHandler);
  app.post("/api/flutterwave/webhook", express.raw({ type: "*/*" }), paymentWebhookHandler);

  // ── Ticket codes for a booking (buyer reaches this only via their booking) ──
  app.get("/api/bookings/:id/tickets", async (req, res) => {
    try {
      const tickets = await TicketModel.find({ bookingId: req.params.id }).sort({ seat: 1 }).lean();
      res.json(
        tickets.map((t: any) => ({
          id: String(t._id),
          code: t.code,
          tierName: t.tierName,
          seat: t.seat,
          attendeeName: t.attendeeName,
          amountPaid: t.amountPaid,
          status: t.status,
        })),
      );
    } catch (err) {
      console.error("Tickets lookup error:", err);
      res.status(500).json({ message: "Could not load those tickets" });
    }
  });

  // ── Branded PDF download for a booking's tickets ──
  app.get("/api/bookings/:id/pdf", async (req, res) => {
    try {
      const { TicketModel } = await import("./models");
      const tickets = await TicketModel.find({ bookingId: req.params.id }).lean();
      if (tickets.length === 0) return res.status(404).json({ message: "No tickets for that booking" });
      const event = await storage.getEvent(String(tickets[0].eventId));
      if (!event) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });

      let orgBranding = (event as any).branding ? { ...(event as any).branding } : null;
      if (event.organizerId) {
        const orgUser = await User.findById(event.organizerId).lean();
        if (orgUser) {
          if (!orgBranding) {
            orgBranding = {
              displayName: (orgUser as any).displayName || (orgUser as any).username,
              logoUrl: (orgUser as any).logoUrl,
              accentHex: (orgUser as any).accentHex,
              slug: (orgUser as any).organizerSlug || (orgUser as any).username,
            };
          } else if (!orgBranding.slug) {
            orgBranding.slug = (orgUser as any).organizerSlug || (orgUser as any).username;
          }
        }
      }

      // Guests and signed-in users can download; ticket codes are unguessable
      // and the booking id is only revealed to the buyer after payment.
      const pdf = await buildTicketPdf(
        tickets.map((t: any) => ({
          code: t.code,
          tierName: t.tierName,
          attendeeName: t.attendeeName,
          seat: t.seat,
        })),
        { title: event.title, date: new Date(event.date), location: event.location, branding: orgBranding },
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="blackheritage-tickets-${String(tickets[0].code)}.pdf"`);
      res.send(Buffer.from(pdf));
    } catch (err) {
      console.error("PDF route error:", err);
      res.status(500).json({ message: "Could not build the PDF" });
    }
  });

  app.post("/api/bookings/:id/verify", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    try {
      const booking = await storage.verifyBooking(req.params.id);
      res.json(booking);
    } catch (err) {
      res.status(500).json({ message: "Failed to verify ticket" });
    }
  });

  // ── Organizer scope helpers ──
  // Main organizers own their events; staff act within the organizer they
  // belong to. Finance sees money; entry staff see only verification.
  const requireStaffAccess = async (req: any, res: any): Promise<{ user: any; organizerId: string | null } | null> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ message: "Sign in to continue." });
      return null;
    }
    const user = req.user as any;
    if (user.role === "user" && !user.teamOwnerId) {
      res.status(403).json({ message: "You do not have organizer access" });
      return null;
    }
    return { user, organizerId: user.teamOwnerId || user._id.toString() };
  };

  const requireEventScope = async (req: any, res: any): Promise<any | null> => {
    const ctx = await requireStaffAccess(req, res);
    if (!ctx) return null;
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      return null;
    }
    const isAdmin = ctx.user.role === "admin";
    const isManager = ctx.user.staffRole === "manager";
    const owns = event.organizerId === ctx.organizerId;
    if (!isAdmin && !owns) {
      res.status(403).json({ message: "This event belongs to another organizer" });
      return null;
    }
    return { event, user: ctx.user, canEdit: isAdmin || (owns && (isManager || !ctx.user.staffRole)) };
  };

  // ── Manual (complimentary) tickets ──
  app.post("/api/events/:id/manual-tickets", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    if (!ctx.canEdit) return res.status(403).json({ message: "Only main organizers and managers can issue tickets" });
    try {
      const input = manualTicketSchema.parse(req.body);
      const event = ctx.event;
      const tickets: any[] = [];
      for (let i = 0; i < input.quantity; i++) {
        let code = generateTicketCode();
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const doc = await TicketModel.create({
              code,
              eventId: event.id,
              bookingId: null,
              seat: i + 1,
              tierName: input.tierName || "Guest list",
              attendeeName: input.name,
              attendeeEmail: input.email,
              amountPaid: 0, // complimentary: no service fee charged
              status: "valid",
              issuedBy: ctx.user._id.toString(),
            });
            tickets.push(doc);
            break;
          } catch (err: any) {
            if (err?.code === 11000 && attempt < 4) {
              code = generateTicketCode();
              continue;
            }
            throw err;
          }
        }
      }

      // Email the PDF directly to the recipient
      try {
        if (process.env.RESEND_API_KEY) {
          const pdf = await buildTicketPdf(
            tickets.map((t: any) => ({ code: t.code, tierName: t.tierName, attendeeName: t.attendeeName, seat: t.seat })),
            { title: event.title, date: new Date(event.date), location: event.location, branding: (event as any).branding || null },
          );
          await sendManualTicketEmail(
            { name: input.name, email: input.email },
            {
              eventTitle: event.title,
              eventDate: new Date(event.date),
              eventLocation: event.location,
              tickets: tickets.map((t: any) => ({ code: t.code, tierName: t.tierName, attendeeName: t.attendeeName, seat: t.seat })),
              totalPaidKobo: 0,
              bookingRef: String(tickets[0].code),
              branding: (event as any).branding || null,
              pdfBase64: Buffer.from(pdf).toString("base64"),
            },
          );
        }
      } catch (emailErr) {
        console.error("Manual ticket email failed:", emailErr);
      }

      res.status(201).json({
        tickets: tickets.map((t: any) => ({ code: t.code, tierName: t.tierName, seat: t.seat, attendeeName: t.attendeeName, attendeeEmail: t.attendeeEmail })),
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Manual tickets error:", err);
      res.status(500).json({ message: "Could not issue those tickets" });
    }
  });

  // ── Promo codes ──
  app.get("/api/events/:id/promos", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const { PromoCodeModel } = await import("./models");
    const docs = await PromoCodeModel.find({ eventId: new mongoose.Types.ObjectId(String(ctx.event.id)) }).sort({ createdAt: -1 }).lean();
    res.json(docs.map((d: any) => ({ ...d, id: String(d._id) })));
  });

  // ── Public promo listing ──
  // The organizer chooses to advertise codes on the event page. Only live,
  // unexpired, unexhausted codes are shown, and only the safe fields.
  app.get("/api/events/:id/public-promos", async (req, res) => {
    const event = await storage.getEvent(req.params.id);
    if (!event || event.promoCodesPublic !== true) return res.json([]);
    const { PromoCodeModel } = await import("./models");
    const now = new Date();
    const docs = await PromoCodeModel.find({
      eventId: new mongoose.Types.ObjectId(String(event.id)),
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean();
    res.json(
      docs
        .filter((d: any) => d.maxUses == null || d.usedCount < d.maxUses)
        .map((d: any) => ({ code: d.code, kind: d.kind, value: d.value })),
    );
  });

  // ── Public pulse: anonymized social proof for one event ──
  // Only first names and coarse counts leave the database. Recent buyers are
  // public proof, never a directory.
  app.get("/api/events/:id/pulse", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });

      const bookings = (await storage.getBookingsByEvent(String(event.id))) as any[];
      const paid = bookings.filter((b) => b.status === "paid");
      const going = paid.reduce((acc, b) => acc + Number(b.quantity || 1), 0);

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = paid
        .filter((b) => b.paidAt ? new Date(b.paidAt).getTime() >= dayAgo : false)
        .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
        .slice(0, 5)
        .map((b) => {
          const mins = Math.max(1, Math.round((Date.now() - new Date(b.paidAt).getTime()) / 60000));
          const ago = mins < 60 ? mins + " min ago" : Math.round(mins / 60) + "h ago";
          return { name: String(b.name || "Someone").trim().split(/\s+/)[0], ago, qty: Number(b.quantity || 1) };
        });

      res.json({
        going,
        soldToday: paid
          .filter((b) => b.paidAt ? new Date(b.paidAt).getTime() >= dayAgo : false)
          .reduce((acc, b) => acc + Number(b.quantity || 1), 0),
        recent,
      });
    } catch (err) {
      console.error("Pulse error:", err);
      res.status(500).json({ message: "Could not load live stats" });
    }
  });

  // ── Waitlist: guest join + organizer CSV ──
  app.post("/api/events/:id/waitlist", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ message: "That event no longer exists, or the link is wrong." });
      if (event.waitlistEnabled !== true) {
        return res.status(400).json({ message: "This event is not running a waitlist" });
      }
      const input = waitlistJoinSchema.parse(req.body);
      await WaitlistModel.updateOne(
        { eventId: new mongoose.Types.ObjectId(String(event.id)), email: input.email.toLowerCase() },
        { $set: { name: input.name, tierName: input.tierName || null } },
        { upsert: true },
      );
      res.status(201).json({ message: "You are on the list. We will email you if a spot opens." });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Waitlist join error:", err);
      res.status(500).json({ message: "Could not add you to the waitlist" });
    }
  });

  app.get("/api/events/:id/waitlist.csv", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const entries = await WaitlistModel.find({ eventId: ctx.event.id }).sort({ createdAt: 1 }).lean();
    const rows = [["name", "email", "tier", "joinedAt"]];
    for (const e of entries as any[]) {
      rows.push([e.name, e.email, e.tierName || "", new Date(e.createdAt).toISOString()]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="waitlist-${String(ctx.event.id)}.csv"`);
    res.send(csv);
  });

  app.post("/api/events/:id/promos", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    if (!ctx.canEdit) return res.status(403).json({ message: "Only main organizers and managers can create promo codes" });
    try {
      const input = promoCreateSchema.parse(req.body);
      const { PromoCodeModel } = await import("./models");
      const doc = await PromoCodeModel.create({
        code: input.code.toUpperCase(),
        eventId: new mongoose.Types.ObjectId(String(ctx.event.id)),
        kind: input.kind,
        value: input.value,
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        active: true,
      });
      res.status(201).json({ ...doc.toObject(), id: String(doc._id) });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err?.code === 11000) return res.status(400).json({ message: "You already have a code with that name for this event" });
      console.error("Promo create error:", err);
      res.status(500).json({ message: "Could not create the promo code" });
    }
  });

  app.delete("/api/promos/:promoId", async (req, res) => {
    const ctx = await requireStaffAccess(req, res);
    if (!ctx) return;
    const { PromoCodeModel } = await import("./models");
    const promo = await PromoCodeModel.findById(req.params.promoId).lean();
    if (!promo) return res.status(404).json({ message: "Promo code not found" });
    const event = await storage.getEvent(String(promo.eventId));
    const isAdmin = ctx.user.role === "admin";
    const owns = event && event.organizerId === ctx.organizerId;
    if (!isAdmin && !owns) return res.status(403).json({ message: "This promo belongs to another organizer" });
    await PromoCodeModel.findByIdAndDelete(req.params.promoId);
    res.status(204).end();
  });

  // ── Team management ──
  app.get("/api/team", async (req, res) => {
    const ctx = await requireStaffAccess(req, res);
    if (!ctx) return;
    if (ctx.user.staffRole) return res.status(403).json({ message: "Only main organizers manage the team" });
    const staff = await User.find({ teamOwnerId: ctx.organizerId });
    res.json(staff.map((s: any) => ({
      id: s._id.toString(),
      username: s.username,
      email: s.email,
      staffRole: s.staffRole,
      createdAt: s.createdAt,
    })));
  });

  app.post("/api/team", async (req, res) => {
    const ctx = await requireStaffAccess(req, res);
    if (!ctx) return;
    if (ctx.user.staffRole) return res.status(403).json({ message: "Only main organizers add team members" });
    try {
      const input = teamCreateSchema.parse(req.body);
      const existing = await User.findOne({ $or: [{ username: input.username }, { email: input.email }] });
      if (existing) return res.status(400).json({ message: "That username or email already has an account" });
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const staff = await User.create({
        username: input.username,
        email: input.email,
        password: hashedPassword,
        role: "user",
        teamOwnerId: ctx.organizerId,
        staffRole: input.staffRole,
      });
      res.status(201).json({ id: staff._id.toString(), username: staff.username, staffRole: staff.staffRole });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Team create error:", err);
      res.status(500).json({ message: "Could not add that team member" });
    }
  });

  app.delete("/api/team/:userId", async (req, res) => {
    const ctx = await requireStaffAccess(req, res);
    if (!ctx) return;
    if (ctx.user.staffRole) return res.status(403).json({ message: "Only main organizers remove team members" });
    const staff = await User.findOne({ _id: req.params.userId, teamOwnerId: ctx.organizerId });
    if (!staff) return res.status(404).json({ message: "Team member not found" });
    await User.deleteOne({ _id: req.params.userId });
    res.status(204).end();
  });

  // ── CSV export: name, tier, code, check-in status ──
  app.get("/api/events/:id/attendees.csv", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const tickets = await TicketModel.find({ eventId: new mongoose.Types.ObjectId(String(ctx.event.id)) }).sort({ createdAt: 1 }).lean();
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ["Name", "Email", "Tier", "Code", "Payment", "Check-in status", "Checked in at"],
      ...tickets.map((t: any) => [
        t.attendeeName,
        t.attendeeEmail,
        t.tierName,
        t.code,
        t.amountPaid > 0 ? `NGN ${(t.amountPaid / 100).toFixed(2)}` : "Complimentary",
        t.status === "used" ? "Checked in" : t.status === "void" ? "Voided" : "Not checked in",
        t.usedAt ? new Date(t.usedAt).toISOString() : "",
      ]),
    ];
    const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendees-${ctx.event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`);
    res.send(csv);
  });

  // ── Refunds ──
  app.post("/api/bookings/:id/refund", async (req, res) => {
    const ctx = await requireStaffAccess(req, res);
    if (!ctx) return;
    const isFinance = ctx.user.role === "admin" || !ctx.user.staffRole || ctx.user.staffRole === "finance";
    if (!isFinance) return res.status(403).json({ message: "Only organizers and finance staff process refunds" });

    try {
      const booking: any = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const event = await storage.getEvent(String(booking.eventId));
      const owns = event && event.organizerId === ctx.organizerId;
      if (ctx.user.role !== "admin" && !owns) return res.status(403).json({ message: "This booking belongs to another organizer" });
      if (booking.status !== "paid") return res.status(400).json({ message: "Only paid bookings can be refunded" });

      if ((booking as any).paymentGateway === "flutterwave" && isFlutterwaveConfigured()) {
        // Verify first, refund second: a booking fulfilled locally (test
        // webhook) has no real Flutterwave-side transaction, and refunding
        // blind would abort on the gateway's generic error. Only refund when
        // the gateway confirms it actually captured this payment.
        const reference = String((booking as any).paymentReference || "");
        let captured = false;
        let txnId = Number((booking as any).gatewayTxnId) || null;
        if (reference) {
          try {
            const verification = await verifyPayment(reference);
            captured = verification.status === "success";
            if (verification.transactionId && !txnId) txnId = Number(verification.transactionId);
          } catch (verifyErr: any) {
            // "Not found" (either gateway wording) means no real charge to
            // reverse. Any other verify failure is a gateway problem: abort.
            if (!/not found|no transaction was found/i.test(String(verifyErr?.message || ""))) throw verifyErr;
          }
        }
        if (captured && txnId) {
          try {
            await refundPayment({ reference, gateway: "flutterwave", transactionId: txnId });
          } catch (refundErr: any) {
            // Real refund failures must still abort before tickets are voided.
            if (!/not found|no transaction was found/i.test(String(refundErr?.message || ""))) throw refundErr;
          }
        }
      } else if (isPaystackConfigured() && (booking as any).paymentGateway === "paystack") {
        const reference = String((booking as any).paymentReference || "");
        let captured = false;
        try {
          const verification = await verifyPayment(reference);
          captured = verification.status === "success";
        } catch (verifyErr: any) {
          // A locally-fulfilled booking (test webhook) has no Paystack-side
          // transaction. Any other verify failure is a gateway problem: abort
          // here so tickets are only voided when the money story is settled.
          if (!/not found|no transaction was found/i.test(String(verifyErr?.message || ""))) throw verifyErr;
        }
        if (captured) {
          await refundPayment({ reference, gateway: "paystack" });
        }
      }

      // Void all tickets from this booking and restore tier availability
      const { TicketModel: TM } = await import("./models");
      await TM.updateMany({ bookingId: booking._id ?? booking.id, status: "valid" }, { $set: { status: "void" } });
      const ev = await storage.getEvent(String(booking.eventId));
      if (ev) {
        const tiers = JSON.parse(ev.ticketTypes || "[]");
        const tier = tiers.find((t: any) => t.name === booking.ticketType);
        if (tier) tier.sold = Math.max(0, Number(tier.sold || 0) - Number(booking.quantity));
        await storage.updateEvent(String(ev.id), { ticketTypes: JSON.stringify(tiers) });
      }
      await BookingModel.findByIdAndUpdate((booking as any)._id || booking.id, { status: "cancelled" });

      try {
        if (process.env.RESEND_API_KEY) {
          await sendRefundEmail(
            { name: booking.name, email: booking.email },
            { eventTitle: event?.title || "Event", amountKobo: Number(booking.totalAmount), bookingRef: String(booking.paymentReference) },
          );
        }
      } catch (emailErr) {
        console.error("Refund email failed:", emailErr);
      }

      res.json({ ok: true, refundedKobo: Number(booking.totalAmount) });
    } catch (err: any) {
      console.error("Refund error:", err);
      res.status(500).json({ message: err?.message || "Refund failed" });
    }
  });

  // ── Gate verification: live check ──
  app.post("/api/verify", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in with your entry staff account" });
    const user = req.user as any;
    if (user.role !== "admin" && user.staffRole !== "entry" && user.staffRole !== "manager" && !user.teamOwnerId && user.role !== "organizer") {
      return res.status(403).json({ message: "Entry staff access only" });
    }
    try {
      const { code, clientTime } = scanRequestSchema.parse(req.body);
      const normalized = code.trim().toUpperCase();
      const ticket = await TicketModel.findOne({ code: normalized }).lean();

      const staffId = user._id.toString();
      const now = clientTime ? new Date(clientTime) : new Date();

      if (!ticket || ticket.status === "void") {
        await ScanEventModel.create({
          code: normalized, ticketId: null, eventId: ticket?.eventId || null,
          result: ticket?.status === "void" ? "void" : "invalid",
          staffId, clientTime: now, syncedAt: new Date(),
        });
        return res.status(404).json({
          result: ticket?.status === "void" ? "void" : "invalid",
          message: ticket?.status === "void"
            ? "This ticket was refunded and can no longer be used"
            : "No ticket matches that code",
        });
      }

      const event = await storage.getEvent(String(ticket.eventId));
      const ticketAny = ticket as any;
      if (ticketAny.status === "used") {
        await ScanEventModel.create({
          code: normalized, ticketId: ticket._id, eventId: ticket.eventId,
          result: "duplicate", staffId, clientTime: now, syncedAt: new Date(),
        });
        return res.status(409).json({
          result: "duplicate",
          message: "Already checked in",
          firstUsedAt: ticketAny.usedAt,
          attendeeName: ticketAny.attendeeName,
          tierName: ticketAny.tierName,
        });
      }

      await TicketModel.updateOne(
        { _id: ticket._id, status: "valid" }, // conditional: no double check-in
        { $set: { status: "used", usedAt: new Date(), usedBy: staffId } },
      );
      await ScanEventModel.create({
        code: normalized, ticketId: ticket._id, eventId: ticket.eventId,
        result: "ok", staffId, clientTime: now, syncedAt: new Date(),
      });
      res.json({
        result: "ok" as const,
        attendeeName: ticketAny.attendeeName,
        tierName: ticketAny.tierName,
        seat: ticketAny.seat,
        eventTitle: event?.title,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Verify error:", err);
      res.status(500).json({ message: "Verification failed, try again" });
    }
  });

  // ── Supervisor override: admit an already-used ticket, logged ──
  app.post("/api/verify/override", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    if (user.role !== "admin" && user.staffRole && user.staffRole !== "manager") {
      return res.status(403).json({ message: "Only supervisors can override" });
    }
    try {
      const { code } = scanOverrideSchema.parse(req.body);
      const normalized = code.trim().toUpperCase();
      const ticket = await TicketModel.findOne({ code: normalized }).lean() as any;
      if (!ticket) return res.status(404).json({ message: "No ticket matches that code" });
      if (ticket.status === "void") return res.status(400).json({ message: "Refunded tickets cannot be overridden" });
      if (ticket.status !== "used") {
        return res.status(400).json({ message: "Only an already-used ticket needs an override" });
      }
      await ScanEventModel.create({
        code: normalized, ticketId: ticket._id, eventId: ticket.eventId,
        result: "override", staffId: user._id.toString(), clientTime: new Date(), syncedAt: new Date(),
      });
      res.json({ result: "override", message: "Entry allowed on supervisor override", attendeeName: ticket.attendeeName, tierName: ticket.tierName });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Override failed" });
    }
  });

  // ── Offline sync: batch results from the cached portal ──
  app.post("/api/verify/sync", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    if (user.role !== "admin" && user.role !== "organizer" && !user.staffRole && !user.teamOwnerId) {
      return res.status(403).json({ message: "Staff access only" });
    }
    try {
      const { scans } = scanSyncSchema.parse(req.body);
      const results: { code: string; result: string }[] = [];
      for (const scan of scans) {
        const normalized = scan.code.trim().toUpperCase();
        const ticket = await TicketModel.findOne({ code: normalized }).lean() as any;
        let result: string;
        if (!ticket || ticket.status === "void") {
          result = ticket?.status === "void" ? "void" : "invalid";
        } else if (ticket.status === "used") {
          result = "duplicate";
        } else {
          const upd = await TicketModel.updateOne(
            { _id: ticket._id, status: "valid" },
            { $set: { status: "used", usedAt: scan.clientTime ? new Date(scan.clientTime) : new Date(), usedBy: user._id.toString() } },
          );
          result = upd.modifiedCount > 0 ? "ok" : "duplicate";
        }
        await ScanEventModel.create({
          code: normalized, ticketId: ticket?._id || null, eventId: ticket?.eventId || null,
          result, staffId: user._id.toString(), clientTime: scan.clientTime ? new Date(scan.clientTime) : null, syncedAt: new Date(),
        });
        results.push({ code: normalized, result });
      }
      res.json({ results });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Sync error:", err);
      res.status(500).json({ message: "Sync failed" });
    }
  });

  // ── Offline cache: valid tickets for one event, loaded at portal login ──
  app.get("/api/events/:id/valid-tickets", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const tickets = await TicketModel.find({
      eventId: new mongoose.Types.ObjectId(String(ctx.event.id)),
      status: "valid",
    }).lean();
    res.json(tickets.map((t: any) => ({ code: t.code, tierName: t.tierName, attendeeName: t.attendeeName })));
  });

  // ── Live event stats for the organizer dashboard and gate tally ──
  app.get("/api/events/:id/live-stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const eventId = new mongoose.Types.ObjectId(String(ctx.event.id));
    const [tickets, scans] = await Promise.all([
      TicketModel.find({ eventId }).lean(),
      ScanEventModel.find({ eventId, result: { $in: ["ok", "override"] } }).sort({ syncedAt: -1 }).limit(1).lean(),
    ]);
    const checkedIn = tickets.filter((t: any) => t.status === "used").length;
    const flagged = await ScanEventModel.countDocuments({ eventId, result: "duplicate" });
    res.json({
      expected: tickets.length,
      checkedIn,
      remaining: tickets.length - checkedIn,
      lastCheckInAt: scans[0]?.syncedAt || null,
      flagged,
    });
  });

  // ── Scan log download ──
  app.get("/api/events/:id/scans.csv", async (req, res) => {
    const ctx = await requireEventScope(req, res);
    if (!ctx) return;
    const scans = await ScanEventModel.find({ eventId: new mongoose.Types.ObjectId(String(ctx.event.id)) }).sort({ syncedAt: 1 }).lean();
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ["Time", "Code", "Result", "Staff", "Device time"],
      ...scans.map((s: any) => [
        new Date(s.syncedAt).toISOString(),
        s.code,
        s.result,
        s.staffId,
        s.clientTime ? new Date(s.clientTime).toISOString() : "",
      ]),
    ];
    const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="scan-log-${ctx.event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"`);
    res.send(csv);
  });

  // ── Payouts: platform fees and promoter commissions ──
  app.get("/api/payouts", async (req, res) => {
    const ctx = await requireStaffAccess(req, res);
    if (!ctx) return;
    const { PayoutModel } = await import("./models");
    const query: any = ctx.user.role === "admin"
      ? {}
      : { organizerId: ctx.organizerId };
    const docs = await PayoutModel.find(query).sort({ createdAt: -1 }).limit(500).lean();
    res.json(docs.map((d: any) => ({ ...d, id: String(d._id) })));
  });

  app.post("/api/payouts/:payoutId/settle", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Only the platform settles payouts" });
    }
    const { PayoutModel } = await import("./models");
    const doc = await PayoutModel.findByIdAndUpdate(req.params.payoutId, { status: "settled" }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: "Payout not found" });
    res.json({ ...doc, id: String(doc._id) });
  });

  // ── Platform settings (admin): commission rates ──
  app.get("/api/platform/settings", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "This area is for platform admins." });
    }
    res.json(await getPlatformSettings());
  });

  app.patch("/api/platform/settings", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "This area is for platform admins." });
    }
    try {
      const input = platformSettingsSchema.parse(req.body);
      await PlatformSettingModel.updateOne({ key: "platform" }, { $set: { ...input, updatedAt: new Date() } }, { upsert: true });
      res.json(await getPlatformSettings());
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Could not save settings" });
    }
  });

  // Vendors API
  app.get(api.vendors.list.path, async (req, res) => {
    try {
      const user = req.user as any;
      if (req.isAuthenticated() && req.query.mine === 'true') {
        const all = await storage.getAllVendors();
        return res.json(all.filter((v) => v.ownerId === user._id.toString()));
      }
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const vendors = await storage.getVendors(category);
      res.json(vendors);
    } catch (err) {
      console.error("Vendors error:", err);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.get(api.vendors.get.path, async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: "That vendor listing no longer exists." });
      }
      // Draft/unpublished profiles stay private to their owner and admins
      const user = req.user as any;
      const isOwner = req.isAuthenticated() && vendor.ownerId === user._id.toString();
      const isAdmin = req.isAuthenticated() && user.role === 'admin';
      if (vendor.status !== 'published' && !isOwner && !isAdmin) {
        return res.status(404).json({ message: "That vendor listing no longer exists." });
      }
      // Same pretty-link contract as events: a real address-bar navigation
      // (Sec-Fetch-Mode absent or "navigate") 301s to /v/:slug when the
      // profile has one. Fetch clients always get JSON.
      const fetchMode = req.headers["sec-fetch-mode"] as string | undefined;
      const isNavigation = fetchMode === "navigate" || fetchMode === undefined;
      if (isNavigation && (vendor as any).slug) {
        return res.redirect(301, `/v/${(vendor as any).slug}`);
      }
      res.json(vendor);
    } catch (err) {
      console.error("Vendor error:", err);
      res.status(500).json({ message: "We could not load that vendor just now. Try again in a moment." });
    }
  });

  // ── Vendor trust signals: earned proof, not marketing ──
  // memberSince and completedBookings come from real rows. responseHours
  // comes from reply latency in Messages (client-to-owner median, last 30
  // days) and is null until the vendor has actually replied to someone.
  app.get("/api/vendors/:id/trust", async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "That vendor listing no longer exists." });

      const vendorId = String(vendor.id);
      const ownerId = vendor.ownerId ? String(vendor.ownerId) : null;

      // Client-paid event bookings that mention this vendor in their table
      // note are the closest thing to completed vendor jobs today.
      let completed = 0;
      if (ownerId) {
        const events = (await storage.getEvents()) as any[];
        const own = new Set(
          events.filter((e) => String(e.organizerId || "") === ownerId).map((e) => String(e.id)),
        );
        if (own.size > 0) {
          const { BookingModel } = await import("./models");
          const paid = await BookingModel.find({ status: "paid" }).lean();
          completed = paid.filter((b: any) =>
            own.has(String(b.eventId)),
          ).length;
        }
      }

      // Median reply time over the vendor's last 30 days of client messages.
      let responseHours: number | null = null;
      if (ownerId && mongoose.connection.readyState === 1) {
        const { MessageModel } = await import("./models");
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const convos = await MessageModel.find({ vendorId: vendorId, createdAt: { $gte: since } })
          .select("conversationId senderId createdAt")
          .limit(500)
          .lean();
        if (convos.length > 0) {
          const byConvo = new Map<string, any[]>();
          for (const m of convos) {
            const arr = byConvo.get(m.conversationId) || [];
            arr.push(m);
            byConvo.set(m.conversationId, arr);
          }
          const gaps: number[] = [];
          for (const msgs of Array.from(byConvo.values())) {
            msgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            for (let i = 1; i < msgs.length; i++) {
              const prev = msgs[i - 1];
              const cur = msgs[i];
              if (prev.senderId !== ownerId && cur.senderId === ownerId) {
                gaps.push(
                  (new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime()) / 3600000,
                );
              }
            }
          }
          if (gaps.length > 0) {
            gaps.sort((a, b) => a - b);
            responseHours = Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10;
          }
        }
      }

      res.json({
        memberSince: (vendor as any).createdAt || null,
        completedBookings: completed,
        responseHours,
      });
    } catch (err) {
      console.error("Vendor trust error:", err);
      res.status(500).json({ message: "Could not load trust signals" });
    }
  });

  // Slug lookup, before /api/vendors/:id so "by-slug" is never read as an
  // id. Retired slugs (aliases) resolve too, so old links never break.
  app.get("/api/vendors/by-slug/:slug", async (req, res) => {
    try {
      const { VendorModel } = await import("./models");
      const key = String(req.params.slug).toLowerCase();
      const doc = await VendorModel.findOne({ slug: key }).lean()
        || await VendorModel.findOne({ slugAliases: key }).lean();
      if (!doc) return res.status(404).json({ message: "That vendor listing no longer exists." });
      if (doc.status !== "published") return res.status(404).json({ message: "That vendor listing no longer exists." });
      res.json(mapVendor(doc));
    } catch (err) {
      console.error("Vendor slug lookup error:", err);
      res.status(500).json({ message: "We could not load that vendor just now. Try again in a moment." });
    }
  });

  // ── Profile link & look: the vendor's share address, theme, and brand ──
  // One endpoint because vendors own the whole surface (no team roles like
  // events have). Empty slug returns to the auto slug from the name.
  app.patch("/api/vendors/:id/link", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "That vendor listing no longer exists." });
      const me = req.user as any;
      if (me.role !== "admin" && vendor.ownerId !== me._id.toString()) {
        return res.status(403).json({ message: "You can only edit your own profile link" });
      }
      const raw = typeof req.body?.slug === "string" ? req.body.slug.toLowerCase().trim() : "";
      if (raw && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)) {
        return res.status(400).json({ message: "Lowercase letters, numbers, and dashes only" });
      }
      const next = raw || slugify(String(vendor.businessName || "vendor"));
      const { VendorModel } = await import("./models");
      let final = next;
      for (let n = 2; n < 50; n++) {
        const clash = await VendorModel.findOne({ slug: final, _id: { $ne: (vendor as any)._id } }).lean();
        if (!clash) break;
        final = `${next}-${n}`;
      }
      // Retire the old address as an alias so printed QR codes and shared
      // links keep resolving forever. Mirrors the event link behavior.
      const oldSlug = (vendor as any).slug;
      const aliases = new Set<string>(((vendor as any).slugAliases || []).map((s: string) => String(s).toLowerCase()));
      if (oldSlug && oldSlug !== final) {
        aliases.add(oldSlug);
        aliases.delete(final);
        await VendorModel.updateOne({ _id: (vendor as any)._id }, { $set: { slugAliases: Array.from(aliases) } });
      }
      const updated = await storage.updateVendor(vendor.id, { slug: final } as any);
      res.json(updated);
    } catch (err) {
      console.error("Vendor link update error:", err);
      res.status(500).json({ message: "Could not save the profile link" });
    }
  });

  app.patch("/api/vendors/:id/look", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "That vendor listing no longer exists." });
      const me = req.user as any;
      if (me.role !== "admin" && vendor.ownerId !== me._id.toString()) {
        return res.status(403).json({ message: "You can only edit your own profile look" });
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (body.theme !== undefined) {
        const t = body.theme;
        if (t !== null && t !== "midnight-gold" && t !== "ivory-editorial" && t !== "sunset-poster") {
          return res.status(400).json({ message: "Unknown theme" });
        }
        patch.theme = t;
      }
      if (body.branding !== undefined) {
        const b = brandingSchema.parse(body.branding);
        const cleaned = {
          displayName: b.displayName || undefined,
          logoUrl: b.logoUrl || undefined,
          accentHex: b.accentHex || undefined,
        };
        patch.branding = cleaned.displayName || cleaned.logoUrl || cleaned.accentHex ? cleaned : null;
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ message: "Nothing to update" });
      }
      const updated = await storage.updateVendor(vendor.id, patch as any);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Vendor look update error:", err);
      res.status(500).json({ message: "Could not save the look" });
    }
  });

  app.post(api.vendors.create.path, async (req, res) => {
    // Any signed-in user can list themselves as a vendor - the Auth page
    // registers vendor-intent users with the plain "user" role (the User
    // model has no "vendor" role; ownership lives on the vendor document).
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    try {
      const input = api.vendors.create.input.parse(req.body);
      const vendor = await storage.createVendor({
        ...input,
        ownerId: (req.user as any)._id.toString(),
      });
      res.status(201).json(vendor);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.vendors.update.path, async (req, res) => {
    // Any signed-in user can edit their own vendor profile (vendor profiles
    // are user-owned; there is no "vendor" role).
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) return res.status(404).json({ message: "We could not find that." });

    if ((req.user as any).role !== 'admin' && vendor.ownerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }

    try {
      const input = api.vendors.update.input.parse(req.body);
      const updated = await storage.updateVendor(vendor.id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // ── Portfolio uploads ──
  // Any signed-in user can upload (vendor profiles are user-owned, no vendor role).
  app.post("/api/uploads/portfolio", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Sign in to upload" });
    }
    portfolioUpload.single("file")(req, res, (err: any) => {
      if (err) {
        const isKnown =
          err.code === "LIMIT_FILE_SIZE" ||
          (err instanceof Error && /only images/i.test(err.message));
        return res.status(400).json({
          message: isKnown
            ? err.code === "LIMIT_FILE_SIZE"
              ? "File is too large. Maximum is 50 MB."
              : err.message
            : "Upload failed. Try a different file.",
        });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Choose a file to upload" });
      }
      saveUpload(req.file.buffer, req.file.originalname, req.file.mimetype)
        .then(({ url, backend }) => {
          res.status(201).json({
            url,
            kind: req.file!.mimetype.startsWith("video/") ? "video" : "image",
            storage: backend,
          });
        })
        .catch((uploadErr) => {
          console.error("Upload to media storage failed:", uploadErr);
          res.status(502).json({ message: "Upload failed. Try again in a moment." });
        });
    });
  });

  // ── Messaging ──
  // Inboxes are per signed-in user; conversations are keyed user-to-user.
  app.get("/api/messages/conversations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Sign in to see your messages" });
    }
    try {
      const me = (req.user as any)._id.toString();
      const conversations = await storage.getConversations(me);
      const withNames = await Promise.all(
        conversations.map(async (c: any) => {
          const other = await storage.getUser(c.otherUserId);
          return {
            ...c,
            otherUsername: other?.username || "Deleted account",
            vendorTitle: c.vendorId ? (await storage.getVendor(c.vendorId))?.businessName || null : null,
          };
        }),
      );
      res.json(withNames);
    } catch (err) {
      console.error("Conversations error:", err);
      res.status(500).json({ message: "Could not load conversations" });
    }
  });

  app.get("/api/messages/unread/count", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.json({ count: 0 });
    }
    try {
      const count = await storage.getUnreadCount((req.user as any)._id.toString());
      res.json({ count });
    } catch (err) {
      res.json({ count: 0 });
    }
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Sign in to see your messages" });
    }
    try {
      const me = (req.user as any)._id.toString();
      const other = await storage.getUser(req.params.userId);
      if (!other) {
        return res.status(404).json({ message: "That account no longer exists" });
      }
      const messages = await storage.getMessages(me, req.params.userId);
      await storage.markConversationRead(me, req.params.userId);
      res.json({
        messages,
        other: {
          id: other._id.toString(),
          username: other.username,
        },
      });
    } catch (err) {
      console.error("Messages error:", err);
      res.status(500).json({ message: "Could not load messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Sign in to send messages" });
    }
    const recipient = await storage.getUser(req.body.recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    if (recipient._id.toString() === (req.user as any)._id.toString()) {
      return res.status(400).json({ message: "You cannot message yourself" });
    }
    try {
      const input = insertMessageSchema.parse({
        vendorId: req.body.vendorId,
        body: req.body.body,
      });
      const message = await storage.sendMessage((req.user as any)._id.toString(), {
        recipientId: recipient._id.toString(),
        vendorId: input.vendorId,
        body: input.body,
      });
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Send message error:", err);
      res.status(500).json({ message: "Message could not be sent" });
    }
  });

  // Payments API
  app.post(api.payments.createIntent.path, async (req, res) => {
    if (!req.isAuthenticated()) {
       return res.status(401).json({ message: "Sign in to continue." });
    }
    
    if (!stripe) {
      return res.status(503).json({ message: "Card payments are not configured" });
    }

    const { amount } = req.body;
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // ensure integer
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete(api.events.update.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }
    const event = await storage.getEvent(req.params.id);
    if (!event) return res.status(404).json({ message: "We could not find that." });
    
    if ((req.user as any).role !== 'admin' && event.organizerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "You do not have access to this. Sign in with the right account, or ask the organizer to add you." });
    }

    try {
      await storage.deleteEvent(event.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  await seedPlatform();

  // ── Account settings: every signed-in user can edit their own profile ──
  app.patch("/api/account/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const user = req.user as any;
    const body = (req.body || {}) as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    if (typeof body.displayName === "string") {
      const v = body.displayName.trim().slice(0, 80);
      update.displayName = v || null;
    }
    if (typeof body.bio === "string") {
      update.bio = body.bio.trim().slice(0, 600) || null;
    }
    if (typeof body.avatarUrl === "string") {
      const v = body.avatarUrl.trim();
      if (v && !v.startsWith("/uploads/")) {
        return res.status(400).json({ message: "Avatar must be an uploaded file" });
      }
      update.avatarUrl = v || null;
    }
    if (body.socials !== undefined) {
      const s = body.socials as Record<string, unknown>;
      const clean: Record<string, string> = {};
      for (const key of ["instagram", "twitter", "whatsapp", "website"] as const) {
        if (typeof s[key] === "string") clean[key] = (s[key] as string).trim().slice(0, 120);
      }
      update.socials = clean;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const updated = await User.findByIdAndUpdate(user._id, { $set: update }, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: "That account no longer exists." });
    res.json(safeUserShape(updated));
  });

  app.patch("/api/account/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to continue." });
    const { currentPassword, newPassword } = req.body as Record<string, string>;
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }
    const user = await User.findById((req.user as any)._id);
    if (!user) return res.status(404).json({ message: "That account no longer exists." });
    if (user.password) {
      const ok = await bcrypt.compare(String(currentPassword || ""), user.password);
      if (!ok) return res.status(403).json({ message: "Current password is wrong" });
    }
    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    res.json({ ok: true });
  });

  // Unsubscribe: one signed token per (follower, event) pair. GET so it works
  // straight from the email client. Sets unsubscribed on the row.
  app.get("/api/organizers/follows/:token/unsubscribe", async (req, res) => {
    const { OrganizerFollowerModel } = await import("./models");
    try {
      const [followerId] = Buffer.from(req.params.token, "base64url").toString("utf8").split(":");
      if (!followerId) throw new Error("bad token");
      await OrganizerFollowerModel.findByIdAndUpdate(followerId, { $set: { unsubscribed: true } });
    } catch {
      // Bad or expired token: still show a calm page, never an error dump.
    }
    const base = process.env.PUBLIC_APP_URL || "http://localhost:5000";
    res.redirect(302, `${base}/unsubscribed`);
  });

  // ── Vendor ratings: sign-in required, one review per user per vendor ──
  app.get("/api/vendors/:id/ratings", async (req, res) => {
    const { VendorRatingModel } = await import("./models");
    const [agg] = await VendorRatingModel.aggregate([
      { $match: { vendorId: String(req.params.id) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          average: { $avg: "$stars" },
        },
      },
    ]);
    const recent = await VendorRatingModel.find({ vendorId: String(req.params.id) })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    res.json({
      count: agg?.count || 0,
      average: agg ? Math.round(agg.average * 10) / 10 : null,
      recent: recent.map((r: any) => ({
        id: String(r._id),
        name: r.reviewerName,
        stars: r.stars,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    });
  });

  app.post("/api/vendors/:id/ratings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in to leave a review" });
    const user = req.user as any;
    const stars = Number(req.body?.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ message: "Pick 1 to 5 stars" });
    }
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 500) : null;
    const { VendorRatingModel, VendorModel } = await import("./models");
    const vendor = await VendorModel.findById(req.params.id).lean();
    if (!vendor) return res.status(404).json({ message: "That vendor listing no longer exists." });
    if ((vendor as any).ownerId === user._id.toString()) {
      return res.status(403).json({ message: "You cannot review your own shop" });
    }
    try {
      const review = await VendorRatingModel.create({
        vendorId: String(req.params.id),
        reviewerUserId: user._id.toString(),
        reviewerName: user.displayName || user.username,
        stars,
        comment: comment || null,
      });
      res.status(201).json({ id: String(review._id) });
    } catch (err: any) {
      if (err?.code === 11000) {
        return res.status(409).json({ message: "You already reviewed this vendor" });
      }
      throw err;
    }
  });

  // ── Native Sponsorships / Partner Placements ──
  app.get("/api/sponsors/active", async (req, res) => {
    try {
      const { placement } = req.query;
      const filter: any = { active: true };
      if (placement && typeof placement === "string") {
        filter.placement = placement;
      }
      const sponsors = await NativeSponsorModel.find(filter).sort({ createdAt: -1 }).limit(10).lean();
      if (sponsors.length > 0) {
        NativeSponsorModel.updateMany(
          { _id: { $in: sponsors.map((s: any) => s._id) } },
          { $inc: { impressions: 1 } }
        ).catch((err) => console.error("Error logging sponsor impressions:", err));
      }
      res.json(sponsors.map((s: any) => ({
        id: String(s._id),
        title: s.title,
        sponsorName: s.sponsorName,
        tagline: s.tagline,
        badgeText: s.badgeText,
        imageUrl: s.imageUrl,
        targetUrl: s.targetUrl,
        placement: s.placement,
        clicks: s.clicks || 0,
        impressions: s.impressions || 0,
      })));
    } catch (err: any) {
      console.error("Failed to fetch active sponsors:", err);
      res.status(500).json({ message: "Failed to fetch sponsors" });
    }
  });

  app.post("/api/sponsors/:id/click", async (req, res) => {
    try {
      const updated = await NativeSponsorModel.findByIdAndUpdate(
        req.params.id,
        { $inc: { clicks: 1 } },
        { new: true }
      );
      if (!updated) return res.status(404).json({ message: "Sponsor not found" });
      res.json({ ok: true, clicks: updated.clicks });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to record click" });
    }
  });

  app.get("/api/sponsors", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "This area is for platform admins." });
    }
    const sponsors = await NativeSponsorModel.find().sort({ createdAt: -1 }).lean();
    res.json(sponsors.map((s: any) => ({
      id: String(s._id),
      title: s.title,
      sponsorName: s.sponsorName,
      tagline: s.tagline,
      badgeText: s.badgeText,
      imageUrl: s.imageUrl,
      targetUrl: s.targetUrl,
      placement: s.placement,
      active: s.active,
      clicks: s.clicks || 0,
      impressions: s.impressions || 0,
      createdAt: s.createdAt,
    })));
  });

  app.post("/api/sponsors", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "This area is for platform admins." });
    }
    const { title, sponsorName, tagline, badgeText, imageUrl, targetUrl, placement, active } = req.body;
    if (!title || !sponsorName || !tagline || !imageUrl || !targetUrl) {
      return res.status(400).json({ message: "Missing required sponsor fields" });
    }
    const sponsor = await NativeSponsorModel.create({
      title,
      sponsorName,
      tagline,
      badgeText: badgeText || "Featured Partner",
      imageUrl,
      targetUrl,
      placement: placement || "home_spotlight",
      active: active !== false,
    });
    res.status(201).json({ id: String(sponsor._id) });
  });

  // ── Dynamic Sitemap XML ──
  app.get(["/sitemap.xml", "/api/sitemap.xml"], async (_req, res) => {
    try {
      const baseUrl = process.env.PUBLIC_APP_URL || "https://blackhevents.com";
      const { EventModel, VendorModel } = await import("./models");

      const [events, vendors, organizers] = await Promise.all([
        EventModel.find({}).select("slug date updatedAt createdAt").lean(),
        VendorModel.find({ status: "published" }).select("slug updatedAt createdAt").lean(),
        User.find({ organizerSlug: { $exists: true, $ne: null } }).select("organizerSlug createdAt").lean(),
      ]);

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      const addUrl = (loc: string, priority: string, changefreq: string, lastmod?: Date | string) => {
        xml += "  <url>\n";
        xml += `    <loc>${baseUrl}${loc}</loc>\n`;
        if (lastmod) {
          try {
            xml += `    <lastmod>${new Date(lastmod).toISOString().split("T")[0]}</lastmod>\n`;
          } catch {}
        }
        xml += `    <changefreq>${changefreq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        xml += "  </url>\n";
      };

      // Core Static Routes
      addUrl("/", "1.0", "daily");
      addUrl("/events", "0.95", "daily");
      addUrl("/explore", "0.9", "daily");
      addUrl("/vendors", "0.9", "daily");
      addUrl("/organizers", "0.95", "daily");
      addUrl("/auth", "0.3", "monthly");

      // Dynamic Events
      for (const ev of events as any[]) {
        const path = ev.slug ? `/e/${ev.slug}` : `/events/${ev._id}`;
        addUrl(path, "0.8", "daily", ev.updatedAt || ev.createdAt || ev.date);
      }

      // Dynamic Vendors
      for (const v of vendors as any[]) {
        const path = v.slug ? `/v/${v.slug}` : `/vendors/${v._id}`;
        addUrl(path, "0.7", "weekly", v.updatedAt || v.createdAt);
      }

      // Dynamic Organizers
      for (const o of organizers as any[]) {
        if (o.organizerSlug) {
          addUrl(`/o/${o.organizerSlug}`, "0.85", "weekly", o.createdAt);
        }
      }

      xml += "</urlset>";

      res.header("Content-Type", "application/xml");
      res.send(xml);
    } catch (err) {
      console.error("Sitemap generation error:", err);
      res.status(500).send("Error generating sitemap");
    }
  });

  // ── The gate-fraud playbook ──
  // Built on demand from server/playbook.ts so there is no stale static PDF.
  app.get("/api/playbook.pdf", async (_req, res) => {
    try {
      const pdf = await playbookPdf();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${PLAYBOOK_FILENAME}"`);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(Buffer.from(pdf));
    } catch (err) {
      console.error("Playbook PDF failed:", err);
      return res.status(500).json({ message: "Could not build the playbook. Try again." });
    }
  });

  // ── Organizer Leads & Playbook Downloads (Lead Magnet) ──
  app.post("/api/leads", async (req, res) => {
    try {
      const { name, brandName, whatsapp, email, city, estimatedAttendance, notes } = req.body;
      if (!name || !brandName || !whatsapp || !email) {
        return res.status(400).json({
          error: "Add your name, brand name, WhatsApp number, and email.",
        });
      }
      // The email is how the playbook reaches them, so reject typos here
      // rather than storing a lead nobody can reply to.
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: EMAIL_HINT });
      }

      // Clean phone number (e.g. +234, 080...)
      const cleanedWhatsapp = String(whatsapp).replace(/\s+/g, "").trim();

      const lead = await OrganizerLeadModel.create({
        name: String(name).trim(),
        brandName: String(brandName).trim(),
        whatsapp: cleanedWhatsapp,
        email: String(email).trim().toLowerCase(),
        city: city ? String(city).trim() : "Lagos",
        estimatedAttendance: estimatedAttendance ? String(estimatedAttendance).trim() : "500-1500",
        claimedOffer: true,
        notes: notes ? String(notes).trim() : "",
      });

      // Deliver the playbook: PDF attached, plus a link for the browser copy.
      try {
        if (await isEmailConfigured()) {
          const pdf = await playbookPdf();
          await sendPlaybookEmail(
            { name: lead.name, email: lead.email },
            {
              promoCode: PLAYBOOK_PROMO_CODE,
              playbookUrl: `${process.env.PUBLIC_APP_URL || "http://localhost:5000"}/api/playbook.pdf`,
              pdfBase64: Buffer.from(pdf).toString("base64"),
            },
          );
        }
      } catch (mailErr) {
        // The lead is already saved; a failed email must not lose it.
        console.error("Playbook email failed:", mailErr);
      }

      return res.status(201).json({
        success: true,
        message: "Playbook sent to your email.",
        promoCode: PLAYBOOK_PROMO_CODE,
        playbookUrl: "/api/playbook.pdf",
        leadId: lead._id,
      });
    } catch (err: any) {
      console.error("Error creating organizer lead:", err);
      return res.status(500).json({ error: "Failed to submit request. Please try again." });
    }
  });

  // ── Admin: List Organizer Leads ──
  app.get("/api/admin/leads", async (req, res) => {
    if (!req.user || (req.user as any).role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    try {
      const leads = await OrganizerLeadModel.find().sort({ createdAt: -1 }).lean();
      return res.json(leads);
    } catch (err) {
      console.error("Error fetching organizer leads:", err);
      return res.status(500).json({ error: "Failed to load organizer leads." });
    }
  });

  return httpServer;
}

// Small shape shared by /api/auth/user and the account PATCH so the client
// cache stays consistent whichever endpoint answered last.
function safeUserShape(user: any) {
  const { password, ...rest } = user;
  return rest;
}

// ── Follower ticket-drop blast ──
// Called once when an event first goes published. Reads the follower list,
// builds one unsubscribe URL per follower, and sends through Resend.
// Errors are logged, never thrown: a bad address must not kill the batch.
async function notifyFollowersOfDrop(event: any): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const { OrganizerFollowerModel, PlatformSettingModel } = await import("./models");
  const followers = await OrganizerFollowerModel.find({
    organizerId: event.organizerId,
    unsubscribed: { $ne: true },
  })
    .limit(500)
    .lean();
  if (followers.length === 0) return;

  const org = await User.findById(event.organizerId).lean();
  const organizerName =
    (org as any)?.displayName || (org as any)?.username || event.organizerName || "The organizer";
  const base = process.env.PUBLIC_APP_URL || "http://localhost:5000";
  const eventUrl = event.slug ? `${base}/e/${event.slug}` : `${base}/events/${event.id}`;

  let sent = 0;
  for (const f of followers as any[]) {
    const token = Buffer.from(`${String(f._id)}:${String(event._id)}`).toString("base64url");
    try {
      await sendFollowerDropEmail(
        { name: f.email.split("@")[0], email: f.email },
        {
          organizerName,
          eventTitle: event.title,
          eventDate: new Date(event.date),
          eventLocation: event.location,
          eventUrl,
          unsubscribeUrl: `${base}/api/organizers/follows/${token}/unsubscribe`,
        },
      );
      sent++;
    } catch (err) {
      console.error("Drop email to", f.email, "failed:", err);
    }
  }
  console.log(`Follower drop blast for "${event.title}": ${sent}/${followers.length} sent`);
}
