import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, text } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(), // Added for app logic
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("user"), // user, organizer, admin
  isAdmin: boolean("is_admin").default(false), // Legacy, keep for compatibility
  organizerSlug: text("organizer_slug").unique(), // /o/:organizerSlug
  displayName: text("display_name"),
  bio: text("bio"),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  socials: jsonb("socials"), // { instagram, twitter, whatsapp, website }
  theme: text("theme"),
  accentHex: text("accent_hex"),
  customDomain: text("custom_domain").unique(),
  customDomainStatus: text("custom_domain_status"),
  announcement: jsonb("announcement"), // { message, linkUrl, active }
  followersCount: varchar("followers_count").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
