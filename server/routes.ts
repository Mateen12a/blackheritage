import type { Express } from "express";
import type { Server } from "http";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { randomBytes } from "crypto";
import { storage, mapEventLean, mapVendor } from "./storage";
import { api } from "@shared/routes";
import {
  insertMessageSchema, bookingInitiateSchema, bookingFinalizeSchema,
  promoCreateSchema, manualTicketSchema, scanRequestSchema, scanOverrideSchema,
  scanSyncSchema, teamCreateSchema, platformSettingsSchema,
  eventSettingsSchema, brandingSchema, waitlistJoinSchema,
} from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import { User, TicketModel, ScanEventModel, PlatformSettingModel, BookingModel, WaitlistModel } from "./models";
import mongoose from "mongoose";
import { fulfillBooking, quoteBooking, validatePromo, getPlatformSettings } from "./booking";
import { initializeTransaction, verifyTransaction, refundTransaction, verifyWebhookSignature, isPaystackConfigured } from "./paystack";
import { buildTicketPdf, generateTicketCode } from "./tickets";
import { seedPlatform } from "./seed";
import { sendManualTicketEmail, sendRefundEmail } from "./emails";
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

// ── Portfolio uploads ──
// Files land in uploads/portfolio and are served at /uploads/portfolio/*.
// Local-disk storage: the right call for this deployment. A hosted store
// (S3, Cloudinary) is the upgrade path when multi-instance matters.
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "portfolio");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const portfolioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + "-" + randomBytes(4).toString("hex") + ext);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
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

  // Serve uploaded portfolio files
  app.use("/uploads/portfolio", express.static(UPLOAD_DIR, { maxAge: "30d" }));
  
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
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Verify context must register before /api/events/:id or "verify-context"
  // would be swallowed as an event id.
  app.get("/api/events/verify-context", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in first" });
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
      if (!doc) return res.status(404).json({ message: "Event not found" });
      res.json(mapEventLean(doc));
    } catch (err) {
      console.error("Slug lookup error:", err);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.get(api.events.get.path, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
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
      res.json(event);
    } catch (err) {
      console.error("Event error:", err);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post(api.events.create.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const input = api.events.create.input.parse(req.body);
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
      });
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
      return res.status(403).json({ message: "Forbidden" });
    }
    const event = await storage.getEvent(req.params.id);
    if (!event) return res.status(404).json({ message: "Not found" });
    
    if ((req.user as any).role !== 'admin' && event.organizerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const input = api.events.update.input.parse(req.body);
      const updated = await storage.updateEvent(event.id, input);
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

  app.get(api.events.stats.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Bookings API
  app.get(api.bookings.listByEvent.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
      return res.status(403).json({ message: "Forbidden" });
    }
    const event = await storage.getEvent(req.params.id);
    if (!event) return res.status(404).json({ message: "Not found" });

    if ((req.user as any).role !== 'admin' && event.organizerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const bookings = await storage.getBookingsByEvent(event.id);
    res.json(bookings);
  });

  app.get("/api/bookings/search", async (req, res) => {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ message: "Email required" });
    try {
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
      if (!event) return res.status(404).json({ message: "Event not found" });

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
      if (!fresh) return res.status(404).json({ message: "Event not found" });
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
        paymentGateway: isPaystackConfigured() ? "paystack" : "simulated",
      });

      // Increment promo usage only when it actually applied
      if (quote.promoApplied && quote.promoId) {
        const { PromoCodeModel } = await import("./models");
        await PromoCodeModel.updateOne({ _id: quote.promoId }, { $inc: { usedCount: 1 } });
      }

      if (isPaystackConfigured()) {
        try {
          const init = await initializeTransaction({
            email: input.email,
            amountKobo: quote.totalKobo,
            reference,
            metadata: {
              bookingId: String(booking._id ?? booking.id),
              eventId: String(event.id),
              eventTitle: event.title,
              tier: quote.ticketType,
              quantity: input.quantity,
            },
          });          return res.status(201).json({
            bookingId: String(booking._id ?? booking.id),
            reference,
            totalKobo: quote.totalKobo,
            paymentUrl: init.authorizationUrl,
            accessCode: init.accessCode,
            publicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
          });
        } catch (psErr: any) {
          // Release held seats so the event is not left with phantom holds
          await releaseHeldSeats(String(event.id), quote.ticketType, input.quantity);
          await BookingModel.deleteOne({ _id: booking._id }).catch(() => {});
          console.error("Paystack init failed:", psErr);
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

      if (isPaystackConfigured()) {
        const verification = await verifyTransaction(reference);
        const expected = Number(booking.totalAmount);
        if (verification.status !== "success") {
          return res.status(402).json({ message: "Payment did not go through. You have not been charged for a completed order." });
        }
        if (verification.amount !== expected) {
          console.error(`Amount mismatch for ${reference}: expected ${expected}, got ${verification.amount}`);
          return res.status(400).json({ message: "Payment amount does not match this order. Contact support." });
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

  // ── Paystack webhook: source of truth for async payment confirmations ──
  app.post("/api/paystack/webhook", express.raw({ type: "*/*" }), async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
    const signature = req.headers["x-paystack-signature"] as string | undefined;

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    try {
      const event = JSON.parse(rawBody);
      if (event.event === "charge.success") {
        const reference = event.data?.reference;
        if (reference) {
      const bookings = await storage.getAllBookings?.();
      const booking: any = bookings
        ? bookings.find((b: any) => b.paymentReference === reference)
        : await (storage as any).getBookingByReference(reference);          if (booking && booking.status !== "paid") {
            // Trust Paystack's webhook amount; also cross-check against our order.
            const expected = Number(booking.totalAmount);
            if (Number(event.data.amount) === expected) {
              await fulfillBooking(String(booking._id ?? booking.id));
            } else {
              console.error(`Webhook amount mismatch for ${reference}: expected ${expected}, got ${event.data.amount}`);
            }
          }
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Webhook processing error:", err);
      res.status(200).json({ received: true }); // Paystack retries on failure; acknowledge anyway
    }
  });

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
      if (!event) return res.status(404).json({ message: "Event not found" });

      // Guests and signed-in users can download; ticket codes are unguessable
      // and the booking id is only revealed to the buyer after payment.
      const pdf = await buildTicketPdf(
        tickets.map((t: any) => ({
          code: t.code,
          tierName: t.tierName,
          attendeeName: t.attendeeName,
          seat: t.seat,
        })),
        { title: event.title, date: new Date(event.date), location: event.location, branding: (event as any).branding || null },
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
      return res.status(403).json({ message: "Forbidden" });
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
      res.status(401).json({ message: "Sign in first" });
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
      res.status(404).json({ message: "Event not found" });
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
      if (!event) return res.status(404).json({ message: "Event not found" });

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
      if (!event) return res.status(404).json({ message: "Event not found" });
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

      if (isPaystackConfigured() && (booking as any).paymentGateway === "paystack") {
        const reference = String((booking as any).paymentReference || "");
        let captured = false;
        try {
          const verification = await verifyTransaction(reference);
          captured = verification.status === "success";
        } catch (verifyErr: any) {
          // A locally-fulfilled booking (test webhook) has no Paystack-side
          // transaction. Any other verify failure is a gateway problem: abort
          // here so tickets are only voided when the money story is settled.
          if (!/not found/i.test(String(verifyErr?.message || ""))) throw verifyErr;
        }
        if (captured) {
          await refundTransaction(reference);
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
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in first" });
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
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in first" });
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
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in first" });
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
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Sign in first" });
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
      return res.status(403).json({ message: "Admin only" });
    }
    res.json(await getPlatformSettings());
  });

  app.patch("/api/platform/settings", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
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
        return res.status(404).json({ message: "Vendor not found" });
      }
      // Draft/unpublished profiles stay private to their owner and admins
      const user = req.user as any;
      const isOwner = req.isAuthenticated() && vendor.ownerId === user._id.toString();
      const isAdmin = req.isAuthenticated() && user.role === 'admin';
      if (vendor.status !== 'published' && !isOwner && !isAdmin) {
        return res.status(404).json({ message: "Vendor not found" });
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
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  // ── Vendor trust signals: earned proof, not marketing ──
  // memberSince and completedBookings come from real rows. responseHours
  // comes from reply latency in Messages (client-to-owner median, last 30
  // days) and is null until the vendor has actually replied to someone.
  app.get("/api/vendors/:id/trust", async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });

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
      if (!doc) return res.status(404).json({ message: "Vendor not found" });
      if (doc.status !== "published") return res.status(404).json({ message: "Vendor not found" });
      res.json(mapVendor(doc));
    } catch (err) {
      console.error("Vendor slug lookup error:", err);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  // ── Profile link & look: the vendor's share address, theme, and brand ──
  // One endpoint because vendors own the whole surface (no team roles like
  // events have). Empty slug returns to the auto slug from the name.
  app.patch("/api/vendors/:id/link", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ message: "Forbidden" });
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
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
    if (!req.isAuthenticated()) return res.status(403).json({ message: "Forbidden" });
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
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
    // Any signed-in user can list themselves as a vendor — the Auth page
    // registers vendor-intent users with the plain "user" role (the User
    // model has no "vendor" role; ownership lives on the vendor document).
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Forbidden" });
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
      return res.status(403).json({ message: "Forbidden" });
    }
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Not found" });

    if ((req.user as any).role !== 'admin' && vendor.ownerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
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
      res.status(201).json({
        url: "/uploads/portfolio/" + req.file.filename,
        kind: req.file.mimetype.startsWith("video/") ? "video" : "image",
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
       return res.status(401).json({ message: "Unauthorized" });
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
      return res.status(403).json({ message: "Forbidden" });
    }
    const event = await storage.getEvent(req.params.id);
    if (!event) return res.status(404).json({ message: "Not found" });
    
    if ((req.user as any).role !== 'admin' && event.organizerId !== (req.user as any)._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      await storage.deleteEvent(event.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  await seedPlatform();

  return httpServer;
}
