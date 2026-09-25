import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { users } from "./models/auth";

export * from "./models/auth";

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  price: integer("price").notNull(), // legacy price for backwards compatibility
  capacity: integer("capacity").notNull(),
  imageUrl: text("image_url").notNull(),
  isFeatured: boolean("is_featured").default(false),
  status: text("status").notNull().default("published"), // draft, published, unpublished
  organizerId: text("organizer_id"), // Replit Auth ID
  gallery: text("gallery").default("[]"), // JSON string: past event photos
  pastEventVideos: text("past_event_videos").default("[]"), // JSON string: video URLs
  promoterName: text("promoter_name"), // who receives the organizer-chosen promoter share
  promoterCommissionBps: integer("promoter_commission_bps").default(0), // basis points of ticket revenue
  sponsorPackages: text("sponsor_packages").default('[]'),
  vendorPackages: text("vendor_packages").default('[]'),
  sponsorsEnabled: boolean("sponsors_enabled").default(true),
  vendorsEnabled: boolean("vendors_enabled").default(true),
  ticketTypes: text("ticket_types").default('[]'), // JSON string: [{name, price, capacity, sold, saleOpen, saleClose}]

  // ── Selling preferences: per-event choices the organizer controls ──
  showRemainingCounts: boolean("show_remaining_counts").default(true), // hide "tickets left" scarcity counts
  showAttendeeCount: boolean("show_attendee_count").default(false), // "142 going" social proof
  waitlistEnabled: boolean("waitlist_enabled").default(false), // sold-out tiers collect emails instead of a dead end
  guestCheckout: boolean("guest_checkout").default(true), // allow buying without an account
  promoCodesPublic: boolean("promo_codes_public").default(false), // list public codes on the event page
  checkoutFields: jsonb("checkout_fields"), // which extra fields checkout collects: phone, tableNote, dietaryNote

  // ── Organizer branding lite: their identity on their event surfaces ──
  branding: jsonb("branding"), // { logoUrl, accentHex, displayName }

  // ── White-label share links ──
  slug: text("slug"), // the organizer-friendly part of the share link: /e/:slug
  theme: text("theme"), // preset key: midnight-gold | ivory-editorial | sunset-poster

  // ── Visibility: who can see/access the event ──
  visibility: text("visibility").notNull().default("public"), // public, unlisted, invite_only
  accessCode: text("access_code"), // for invite_only events

  // ── Event type category ──
  eventType: text("event_type").default("party"),
  eventTypeLabel: text("event_type_label"), // free text when eventType is 'other'
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventId: text("event_id").notNull(),
  ticketType: text("ticket_type").default('Regular'),
  quantity: integer("quantity").notNull(),
  totalAmount: integer("total_amount").notNull(),
  name: text("name"),
  email: text("email"),
  status: text("status").notNull().default("pending"),
  paymentIntentId: text("payment_intent_id"),
  paymentReference: text("payment_reference"),
  paymentGateway: text("payment_gateway"), // paystack, simulated, manual
  promoCode: text("promo_code"),
  tableNote: text("table_note"), // group size or seating preference for table bookings
  paidAt: timestamp("paid_at"),
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  code: text("code").notNull(), // BH-XXXXXXXX, unambiguous alphabet
  eventId: text("event_id").notNull(),
  bookingId: text("booking_id"),
  seat: integer("seat").notNull().default(1),
  tierName: text("tier_name").notNull(),
  attendeeName: text("attendee_name").notNull(),
  attendeeEmail: text("attendee_email").notNull(),
  amountPaid: integer("amount_paid").notNull().default(0), // kobo; 0 = complimentary
  status: text("status").notNull().default("valid"), // valid, used, void
  issuedBy: text("issued_by"), // userId when issued manually
  usedAt: timestamp("used_at"),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const businessBookings = pgTable("business_bookings", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  type: text("type").notNull(), // sponsor or vendor
  packageName: text("package_name").notNull(),
  price: integer("price").notNull(),
  businessName: text("business_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"), // pending, paid, cancelled
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookingsRelations = relations(bookings, ({ one }) => ({
  event: one(events, {
    fields: [bookings.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));

export const businessBookingsRelations = relations(businessBookings, ({ one }) => ({
  event: one(events, {
    fields: [businessBookings.eventId],
    references: [events.id],
  }),
}));

export const vendorCategories = ["DJ", "MC", "Caterer", "Decorator", "Photographer",
  "Videographer", "Live Band", "Solo Artist", "Makeup Artist",
  "Event Planner", "Sound Engineer", "Lighting",
  "Security", "Bartender", "Baker", "Fashion Designer",
  "Rental Equipment", "Venue", "Other"] as const;
export type VendorCategory = typeof vendorCategories[number];

export const eventCategories = [
  "concert", "party", "house_party", "wedding", "birthday",
  "corporate", "festival", "brunch", "private_gathering",
  "conference", "comedy_show", "art_exhibition", "other"
] as const;
export type EventCategory = typeof eventCategories[number];

export const eventCategoryLabels: Record<EventCategory, string> = {
  concert: "Concert",
  party: "Party",
  house_party: "House Party",
  wedding: "Wedding",
  birthday: "Birthday",
  corporate: "Corporate Event",
  festival: "Festival",
  brunch: "Brunch",
  private_gathering: "Private Gathering",
  conference: "Conference",
  comedy_show: "Comedy Show",
  art_exhibition: "Art Exhibition",
  other: "Other",
};

/** "instagram" | "x" | "tiktok" | "youtube" — keyed by social platform */
export const vendorSocialKeys = ["instagram", "x", "tiktok", "youtube"] as const;
export type VendorSocialKey = typeof vendorSocialKeys[number];

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(), // sorted "userId_a::userId_b"
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  vendorId: text("vendor_id"), // vendor context, if the chat started from a vendor profile
  body: text("body").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  category: text("category").notNull().default("Other"), // DJ, MC, Caterer, Decorator, Photographer, Live Band, Other
  categoryLabel: text("category_label"), // free text shown when category is Other
  bio: text("bio").notNull(),
  gallery: text("gallery").default("[]"), // JSON string: string[] of image URLs
  city: text("city"),
  serviceArea: text("service_area"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  videos: text("videos").default("[]"), // JSON string: string[] of video URLs
  socials: text("socials").default("{}"), // JSON string: Partial<Record<VendorSocialKey, string>>
  status: text("status").notNull().default("published"), // draft, published, unpublished
  ownerId: text("owner_id"), // user account that owns this profile
  // ── Profile link & look: same infrastructure events get ──
  branding: jsonb("branding"), // { logoUrl, accentHex, displayName }
  slug: text("slug"), // the shareable part of the profile link: /v/:slug
  slugAliases: jsonb("slug_aliases"), // retired slugs that still resolve
  theme: text("theme"), // preset key: midnight-gold | ivory-editorial | sunset-poster
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventsRelations = relations(events, ({ many }) => ({
  bookings: many(bookings),
  businessBookings: many(businessBookings),
}));

export const vendorsRelations = relations(vendors, ({ one }) => ({
  owner: one(users, {
    fields: [vendors.ownerId],
    references: [users.id],
  }),
}));

// JSON transport carries dates as ISO strings; normalize once so create and
// update routes both accept what real clients send, and reject junk with 400
// instead of a storage-layer cast error.
const dateInput = z.union([z.string(), z.date()])
  .transform((v) => (typeof v === "string" ? new Date(v) : v))
  .refine((v) => !isNaN(v.getTime()), "Enter a valid date");

export const insertEventSchema = createInsertSchema(events).omit({ id: true }).extend({
  slug: z
    .string()
    .trim()
    .max(80, "Keep the link under 80 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and dashes only")
    .optional()
    .nullable(),
  theme: z.enum(["midnight-gold", "ivory-editorial", "sunset-poster"]).optional().nullable(),
  date: dateInput,
});

// Drafts can be saved with only a title so organizers can announce early and
// fill in details later. The publish route runs the full schema before an
// event goes public, so nothing incomplete ever reaches the directory.
export const insertDraftEventSchema = insertEventSchema.extend({
  description: z.string().optional().default(""),
  date: dateInput.optional(),
  location: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
});

/** Fields an event must have before it can be published. */
export function missingEventPublishFields(input: Partial<InsertEvent>): string[] {
  const missing: string[] = [];
  if (!input.title || !String(input.title).trim()) missing.push("title");
  if (!input.description || !String(input.description).trim()) missing.push("description");
  if (!input.date || isNaN(new Date(input.date as any).getTime())) missing.push("date");
  if (!input.location || !String(input.location).trim()) missing.push("location");
  if (!input.imageUrl || !String(input.imageUrl).trim()) missing.push("image");
  return missing;
}
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, status: true, paymentIntentId: true });
export const insertBusinessBookingSchema = createInsertSchema(businessBookings).omit({ id: true, createdAt: true, status: true });

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type TicketRow = typeof tickets.$inferSelect;
export type BusinessBooking = typeof businessBookings.$inferSelect;
export type InsertBusinessBooking = z.infer<typeof insertBusinessBookingSchema>;

export const insertVendorSchema = createInsertSchema(vendors)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    category: z.enum(vendorCategories, {
      errorMap: () => ({ message: "Select a category" }),
    }),
    categoryLabel: z
      .string()
      .trim()
      .max(40, "Keep the service description under 40 characters")
      .optional()
      .or(z.literal("")),
  });

export const insertMessageSchema = z.object({
  vendorId: z.string().optional(),
  body: z.string().trim().min(1, "Type a message first").max(2000, "Keep messages under 2000 characters"),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

/** Parse the JSON-string gallery/videos/socials columns into typed arrays. */
export function parseVendorMedia(v: Pick<Vendor, "gallery" | "videos" | "socials">) {
  const parse = (s: string | null | undefined, fallback: unknown) => {
    try {
      const parsed = JSON.parse(s || "");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };
  return {
    gallery: parse(v.gallery, []) as string[],
    videos: parse(v.videos, []) as string[],
    socials: parse(v.socials, {}) as Partial<Record<VendorSocialKey, string>>,
  };
}

// ── Ticketing ──
// A ticket is one seat. Codes are system-generated, single-use, and tied to
// one transaction; the code is what the gate verifies, never the reference.

export type TicketStatus = "valid" | "used" | "void";

export interface Ticket {
  id: string;
  code: string;
  eventId: string;
  bookingId?: string | null;
  seat: number;
  tierName: string;
  attendeeName: string;
  attendeeEmail: string;
  amountPaid: number;
  status: TicketStatus;
  usedAt?: string | null;
  createdAt?: string;
}

export type ScanResult = "ok" | "duplicate" | "invalid" | "void" | "override";

export interface ScanEvent {
  id: string;
  code: string;
  result: ScanResult;
  staffId: string;
  clientTime?: string | null;
  syncedAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  eventId: string;
  kind: "percent" | "fixed";
  value: number; // percent 1-100, or kobo amount for "fixed"
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: string | null;
  active: boolean;
}

export interface Payout {
  id: string;
  kind: "platform_fee" | "promoter_commission";
  eventId: string;
  recipientName: string;
  amount: number;
  status: "due" | "settled";
  note?: string;
  createdAt?: string;
}

export const staffRoles = ["manager", "finance", "entry"] as const;
export type StaffRole = typeof staffRoles[number];

// ── Selling preferences ──
// One owner: the Event row. The client renders what the organizer chose and
// the server enforces it; neither side invents defaults the other ignores.

export const checkoutFieldKeys = ["phone", "tableNote", "dietaryNote"] as const;
export type CheckoutFieldKey = typeof checkoutFieldKeys[number];

export const eventSettingsSchema = z.object({
  showRemainingCounts: z.boolean().default(true),
  showAttendeeCount: z.boolean().default(false),
  waitlistEnabled: z.boolean().default(false),
  guestCheckout: z.boolean().default(true),
  promoCodesPublic: z.boolean().default(false),
  checkoutFields: z.object({
    phone: z.boolean().default(false),
    tableNote: z.boolean().default(true), // table bookings always had this; toggle can widen it
    dietaryNote: z.boolean().default(false),
  }).default({ phone: false, tableNote: true, dietaryNote: false }),
});

export const brandingSchema = z.object({
  displayName: z.string().trim().max(60).optional(),
  logoUrl: z.string().trim().url("Use a full image URL for the logo").max(500).optional().or(z.literal("")),
  accentHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #E3B23C").optional().or(z.literal("")),
}).default({});

export const eventThemeKeys = ["midnight-gold", "ivory-editorial", "sunset-poster"] as const;
export type EventThemeKey = typeof eventThemeKeys[number];

// Guests can join a waitlist with just a name and email.
export const waitlistJoinSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  tierName: z.string().trim().max(60).optional(),
});

// A ticket tier as stored in the event's ticketTypes JSON column.
export const ticketTierSchema = z.object({
  name: z.string().min(1).max(60),
  price: z.number().int().min(0), // kobo
  capacity: z.number().int().min(0),
  sold: z.number().int().min(0).optional(),
  description: z.string().max(200).optional(),
  opensAt: z.string().optional(), // ISO date; sale window start
  closesAt: z.string().optional(), // ISO date; sale window end
});

export const bookingInitiateSchema = z.object({
  eventId: z.string().min(1),
  tierName: z.string().min(1).max(60),
  quantity: z.number().int().min(1).max(10),
  name: z.string().trim().min(2, "Enter the ticket holder's name").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  promoCode: z.string().trim().max(40).optional(),
  tableNote: z.string().trim().max(300).optional(), // group size or seating preference for tables
  phone: z.string().trim().max(30).optional(), // organizer-toggled checkout fields
  dietaryNote: z.string().trim().max(300).optional(),
  guest: z.boolean().optional(), // true when buying without an account
});

export const bookingFinalizeSchema = z.object({
  reference: z.string().trim().min(4).max(80),
});

export const promoCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes and underscores only"),
  kind: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export const manualTicketSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  tierName: z.string().trim().min(1).max(60).optional(),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const scanRequestSchema = z.object({
  code: z.string().trim().min(4).max(40),
  clientTime: z.string().optional(), // when the scan happened on-device
});

export const scanOverrideSchema = z.object({
  code: z.string().trim().min(4).max(40),
});

export const scanSyncSchema = z.object({
  scans: z
    .array(
      z.object({
        code: z.string().trim().min(4).max(40),
        clientTime: z.string().optional(),
      }),
    )
    .max(500),
});

export const teamCreateSchema = z.object({
  username: z.string().trim().min(3, "Use at least 3 characters").max(40),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(100),
  staffRole: z.enum(staffRoles),
});

export const platformSettingsSchema = z.object({
  ticketCommissionBps: z.number().int().min(0).max(1500), // 0-15%
  vendorCommissionBps: z.number().int().min(0).max(1500),
});


