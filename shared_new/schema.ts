import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
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
  sponsorPackages: text("sponsor_packages").default('[]'),
  vendorPackages: text("vendor_packages").default('[]'),
  sponsorsEnabled: boolean("sponsors_enabled").default(true),
  vendorsEnabled: boolean("vendors_enabled").default(true),
  ticketTypes: text("ticket_types").default('[]'), // JSON string: [{name, price, capacity, sold}]
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
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
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

export const eventsRelations = relations(events, ({ many }) => ({
  bookings: many(bookings),
  businessBookings: many(businessBookings),
}));

export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, status: true, paymentIntentId: true });
export const insertBusinessBookingSchema = createInsertSchema(businessBookings).omit({ id: true, createdAt: true, status: true });

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type BusinessBooking = typeof businessBookings.$inferSelect;
export type InsertBusinessBooking = z.infer<typeof insertBusinessBookingSchema>;
