import mongoose, { Schema, model, type Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  role: 'user' | 'organizer' | 'admin';
  teamOwnerId?: string | null; // for staff accounts: the organizer they work for
  staffRole?: 'manager' | 'finance' | 'entry' | null;
  organizerSlug?: string | null;
  displayName?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  customDomain?: string | null;
  customDomainStatus?: 'pending' | 'active' | null;
  announcement?: {
    message: string;
    linkUrl?: string;
    active: boolean;
  } | null;
  socials?: {
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
    website?: string;
  } | null;
  theme?: 'midnight-gold' | 'ivory-editorial' | 'sunset-poster' | null;
  accentHex?: string | null;
  avatarUrl?: string | null;
  videoLoopUrl?: string | null;
  spotifyPlaylistUrl?: string | null;
  tourCities?: string[] | null;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'organizer', 'admin'], default: 'organizer' },
  teamOwnerId: { type: String, default: null },
  staffRole: { type: String, enum: ['manager', 'finance', 'entry', null], default: null },
  organizerSlug: { type: String, index: { unique: true, sparse: true } },
  displayName: { type: String, default: null },
  bio: { type: String, default: null },
  logoUrl: { type: String, default: null },
  coverUrl: { type: String, default: null },
  // No default: sparse-unique means "field absent" is excluded but explicit
  // null is not, so a default here makes every user collide with the next.
  customDomain: { type: String, index: { unique: true, sparse: true } },
  customDomainStatus: { type: String, enum: ['pending', 'active', null], default: null },
  announcement: {
    type: {
      message: String,
      linkUrl: String,
      active: { type: Boolean, default: false },
    },
    default: null,
  },
  followersCount: { type: Number, default: 0 },
  avatarUrl: { type: String, default: null },
  termsAcceptedAt: { type: Date, default: null }, // consent record set at registration
  socials: {
    type: {
      instagram: String,
      twitter: String,
      whatsapp: String,
      website: String,
    },
    default: null,
  },
  theme: { type: String, enum: ['midnight-gold', 'ivory-editorial', 'sunset-poster', null], default: null },
  accentHex: { type: String, default: null },
  videoLoopUrl: { type: String, default: null },
  spotifyPlaylistUrl: { type: String, default: null },
  tourCities: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
}, {
  id: false // Disable the id virtual to avoid unique index conflict with null
});

export const User = mongoose.models.User || model<IUser>("User", UserSchema);

export interface IEvent extends Document {
  title: string;
  description: string;
  date: Date;
  location: string;
  price: number;
  capacity: number;
  imageUrl: string;
  isFeatured: boolean;
  status: 'draft' | 'published' | 'unpublished';
  organizerId?: string;
  sponsorPackages: string;
  vendorPackages: string;
  sponsorsEnabled: boolean;
  vendorsEnabled: boolean;
  ticketTypes: string; // Added ticketTypes
  showRemainingCounts?: boolean;
  showAttendeeCount?: boolean;
  waitlistEnabled?: boolean;
  guestCheckout?: boolean;
  promoCodesPublic?: boolean;
  checkoutFields?: { phone: boolean; tableNote: boolean; dietaryNote: boolean } | null;
  branding?: { displayName?: string; logoUrl?: string; accentHex?: string } | null;
  slug?: string | null;
  theme?: 'midnight-gold' | 'ivory-editorial' | 'sunset-poster' | null;
}

const EventSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  capacity: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  isFeatured: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'published', 'unpublished'], default: 'published' },
  organizerId: { type: String },
  organizerName: { type: String }, // Add organizer name for "Published by"
  gallery: { type: String, default: '[]' }, // JSON string: past event photos
  pastEventVideos: { type: String, default: '[]' }, // JSON string: video URLs
  promoterName: { type: String, default: null }, // who receives the promoter share
  promoterCommissionBps: { type: Number, default: 0 }, // organizer-chosen share, basis points
  sponsorPackages: { type: String, default: '[]' },
  vendorPackages: { type: String, default: '[]' },
  sponsorsEnabled: { type: Boolean, default: true },
  vendorsEnabled: { type: Boolean, default: true },
  ticketTypes: { type: String, default: '[]' }, // Added ticketTypes
  // Selling preferences: organizer-controlled, see shared/schema.ts
  showRemainingCounts: { type: Boolean, default: true },
  showAttendeeCount: { type: Boolean, default: false },
  waitlistEnabled: { type: Boolean, default: false },
  guestCheckout: { type: Boolean, default: true },
  promoCodesPublic: { type: Boolean, default: false },
  checkoutFields: { type: { phone: Boolean, tableNote: Boolean, dietaryNote: Boolean }, default: null },
  branding: { type: { displayName: String, logoUrl: String, accentHex: String }, default: null },
  slug: { type: String, index: { unique: true, sparse: true } },
  slugAliases: { type: [String], default: [], index: true },
  theme: { type: String, enum: ['midnight-gold', 'ivory-editorial', 'sunset-poster', null], default: null },
});

export const EventModel = mongoose.models.Event || model<IEvent>("Event", EventSchema);

// Hot-path indexes: every event page load, dashboard, and check-in runs these.
EventSchema.index({ status: 1, date: -1 });
EventSchema.index({ organizerId: 1, status: 1 });

export interface IBooking extends Document {
  email: string;
  name: string;
  eventId: mongoose.Types.ObjectId;
  ticketType: string; // Added ticketType
  quantity: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  paymentIntentId?: string;
  paymentReference?: string;
  isVerified: boolean; // Added isVerified
  verifiedAt?: Date; // Added verifiedAt
  createdAt: Date;
}

const BookingSchema: Schema = new Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  ticketType: { type: String, default: 'Regular' }, // Added ticketType
  quantity: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paymentIntentId: { type: String },
  paymentReference: { type: String },
  paymentGateway: { type: String, enum: ['paystack', 'simulated', 'manual', null], default: null },
  promoCode: { type: String, default: null },
  tableNote: { type: String, default: null }, // group size / seating preference for tables
  phone: { type: String, default: null }, // optional checkout fields, organizer-toggled
  dietaryNote: { type: String, default: null },
  paidAt: { type: Date },
  isVerified: { type: Boolean, default: false }, // Added isVerified
  verifiedAt: { type: Date }, // Added verifiedAt
  createdAt: { type: Date, default: Date.now }
});

export const BookingModel = mongoose.models.Booking || model<IBooking>("Booking", BookingSchema);

// Paid bookings feed scarcity, pulse stats, and the attendee export.
BookingSchema.index({ eventId: 1, status: 1 });
BookingSchema.index({ email: 1, createdAt: -1 });

export interface IVendor extends Document {
  businessName: string;
  category: string;
  bio: string;
  gallery: string; // JSON string: string[] of image URLs
  city?: string;
  serviceArea?: string;
  phone?: string;
  whatsapp?: string;
  videos: string; // JSON string: string[] of video URLs
  socials: string; // JSON string: Partial<Record<'instagram' | 'x' | 'tiktok' | 'youtube', string>>
  status: 'draft' | 'published' | 'unpublished';
  ownerId?: string;
  branding?: { displayName?: string; logoUrl?: string; accentHex?: string } | null;
  slug?: string | null;
  slugAliases?: string[];
  theme?: 'midnight-gold' | 'ivory-editorial' | 'sunset-poster' | null;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema: Schema = new Schema({
  businessName: { type: String, required: true },
  category: { type: String, enum: ['DJ', 'MC', 'Caterer', 'Decorator', 'Photographer', 'Live Band', 'Other'], default: 'Other' },
  categoryLabel: { type: String, maxlength: 40 },
  bio: { type: String, required: true },
  gallery: { type: String, default: '[]' },
  city: { type: String },
  serviceArea: { type: String },
  phone: { type: String },
  whatsapp: { type: String },
  videos: { type: String, default: '[]' },
  socials: { type: String, default: '{}' },
  status: { type: String, enum: ['draft', 'published', 'unpublished'], default: 'published' },
  ownerId: { type: String },
  branding: { type: { displayName: String, logoUrl: String, accentHex: String }, default: null },
  slug: { type: String, index: { unique: true, sparse: true } },
  slugAliases: { type: [String], default: [], index: true },
  theme: { type: String, enum: ['midnight-gold', 'ivory-editorial', 'sunset-poster', null], default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const VendorModel = mongoose.models.Vendor || model<IVendor>("Vendor", VendorSchema);

export interface IBusinessBooking extends Document {
  eventId: mongoose.Types.ObjectId;
  type: 'sponsor' | 'vendor';
  packageName: string;
  price: number;
  businessName: string;
  contactPerson: string;
  phoneNumber: string;
  email?: string;
  description: string;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: Date;
}

const BusinessBookingSchema: Schema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  type: { type: String, enum: ['sponsor', 'vendor'], required: true },
  packageName: { type: String, required: true },
  price: { type: Number, required: true },
  businessName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export const BusinessBookingModel = mongoose.models.BusinessBooking || model<IBusinessBooking>("BusinessBooking", BusinessBookingSchema);

export interface IMessage extends Document {
  conversationId: string; // sorted "idA::idB"
  senderId: string;
  recipientId: string;
  vendorId?: string; // vendor context, if the chat started from a vendor profile
  body: string;
  readAt?: Date;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true, index: true },
  recipientId: { type: String, required: true, index: true },
  vendorId: { type: String },
  body: { type: String, required: true },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const MessageModel = mongoose.models.Message || model<IMessage>("Message", MessageSchema);

// Conversation threads load sorted by time inside one conversation.
MessageSchema.index({ conversationId: 1, createdAt: 1 });

// Ticketing
// One Ticket row per seat. The code is the single source of truth at the gate:
// system-generated, single-use, and never reused across tickets.

export interface ITicket extends Document {
  code: string; // e.g. BH-7KQ2M4XA
  eventId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId | null;
  seat: number;
  tierName: string;
  attendeeName: string;
  attendeeEmail: string;
  amountPaid: number; // 0 for complimentary tickets
  status: 'valid' | 'used' | 'void';
  issuedBy?: string; // userId when issued manually
  usedAt?: Date;
  usedBy?: string; // staff userId at check-in
  createdAt: Date;
}
const TicketSchema: Schema = new Schema({
  code: { type: String, required: true, unique: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
  seat: { type: Number, required: true },
  tierName: { type: String, required: true },
  attendeeName: { type: String, required: true },
  attendeeEmail: { type: String, required: true },
  amountPaid: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ['valid', 'used', 'void'], default: 'valid' },
  issuedBy: { type: String },
  usedAt: { type: Date },
  usedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const TicketModel = mongoose.models.Ticket || model<ITicket>("Ticket", TicketSchema);

// MyTickets lookup and the gate portal's cached valid-list both scan by email
// and by event+status.
TicketSchema.index({ attendeeEmail: 1, createdAt: -1 });
TicketSchema.index({ eventId: 1, status: 1 });
// Audit trail for gate activity. One row per verification attempt, including
// offline scans (synced later) and supervisor overrides.
export interface IScanEvent extends Document {
  ticketId?: mongoose.Types.ObjectId | null;
  code: string;
  eventId?: mongoose.Types.ObjectId | null;
  result: 'ok' | 'duplicate' | 'invalid' | 'void' | 'override';
  staffId: string;
  clientTime?: Date | null; // when the scan happened on-device (offline clock)
  syncedAt: Date;
}

const ScanEventSchema: Schema = new Schema({
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', default: null },
  code: { type: String, required: true, index: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', default: null },
  result: { type: String, enum: ['ok', 'duplicate', 'invalid', 'void', 'override'], required: true },
  staffId: { type: String, required: true, index: true },
  clientTime: { type: Date, default: null },
  syncedAt: { type: Date, default: Date.now },
});

export const ScanEventModel = mongoose.models.ScanEvent || model<IScanEvent>("ScanEvent", ScanEventSchema);

export interface IPromoCode extends Document {
  code: string;
  eventId: mongoose.Types.ObjectId;
  kind: 'percent' | 'fixed';
  value: number; // percent (1-100) or kobo amount
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: Date | null;
  active: boolean;
  createdAt: Date;
}

const PromoCodeSchema: Schema = new Schema({
  code: { type: String, required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  kind: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true },
  maxUses: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Code uniqueness is per event, not global.
PromoCodeSchema.index({ code: 1, eventId: 1 }, { unique: true });

export const PromoCodeModel = mongoose.models.PromoCode || model<IPromoCode>("PromoCode", PromoCodeSchema);

// Platform-wide revenue settings, stored as a single settings document.
export interface IPlatformSetting extends Document {
  key: string; // always 'platform'
  ticketCommissionBps: number; // basis points of ticket revenue (e.g. 600 = 6%)
  vendorCommissionBps: number; // basis points of vendor booking value (e.g. 1250 = 12.5%)
  updatedAt: Date;
}

const PlatformSettingSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true },
  ticketCommissionBps: { type: Number, required: true, default: 600 },
  vendorCommissionBps: { type: Number, required: true, default: 1250 },
  updatedAt: { type: Date, default: Date.now },
});

export const PlatformSettingModel = mongoose.models.PlatformSetting || model<IPlatformSetting>("PlatformSetting", PlatformSettingSchema);

// Money owed, one row per source booking. kind:
//  - 'platform_fee': BlackHeritage's commission on a ticket sale
//  - 'promoter_commission': a cut the organizer chose to share with a promoter
export interface IPayout extends Document {
  kind: 'platform_fee' | 'promoter_commission';
  eventId: mongoose.Types.ObjectId;
  organizerId?: string;
  recipientName: string;
  recipientId?: string | null;
  amount: number;
  sourceBookingId?: mongoose.Types.ObjectId | null;
  status: 'due' | 'settled';
  note?: string;
  createdAt: Date;
}

const PayoutSchema: Schema = new Schema({
  kind: { type: String, enum: ['platform_fee', 'promoter_commission'], required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  organizerId: { type: String },
  recipientName: { type: String, required: true },
  recipientId: { type: String, default: null },
  amount: { type: Number, required: true },
  sourceBookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
  status: { type: String, enum: ['due', 'settled'], default: 'due' },
  note: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const PayoutModel = mongoose.models.Payout || model<IPayout>("Payout", PayoutSchema);

// Waitlist
// Sold-out tiers collect emails instead of dead-ending when the organizer
// turns waitlists on for the event.
export interface IWaitlistEntry extends Document {
  eventId: mongoose.Types.ObjectId;
  tierName?: string | null;
  name: string;
  email: string;
  createdAt: Date;
  notifiedAt?: Date | null;
}

const WaitlistSchema: Schema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  tierName: { type: String, default: null },
  name: { type: String, required: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  notifiedAt: { type: Date, default: null },
});

// One entry per email per event; joining again just updates the tier choice.
WaitlistSchema.index({ eventId: 1, email: 1 }, { unique: true });

export const WaitlistModel =
  mongoose.models.Waitlist || model<IWaitlistEntry>("Waitlist", WaitlistSchema);

// Organizer Follower: tracks fans subscribing to early announcements and ticket drops
export interface IOrganizerFollower extends Document {
  organizerId: string;
  email: string;
  userId?: string | null;
  unsubscribed?: boolean; // set by the one-click unsubscribe in drop emails
  createdAt: Date;
}

const OrganizerFollowerSchema: Schema = new Schema({
  organizerId: { type: String, required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  userId: { type: String, default: null },
  unsubscribed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// One follow per email per organizer
OrganizerFollowerSchema.index({ organizerId: 1, email: 1 }, { unique: true });

export const OrganizerFollowerModel =
  mongoose.models.OrganizerFollower ||
  model<IOrganizerFollower>("OrganizerFollower", OrganizerFollowerSchema);

// VendorRating: one review per user per vendor
// Vendors close deals over chat and WhatsApp today, so the gate is a signed-in
// account rather than a paid transaction. When vendor bookings become
// transactional, tighten the gate to paid bookings without a schema change.
export interface IVendorRating extends Document {
  vendorId: string;
  reviewerUserId: string;
  reviewerName: string;
  stars: number; // 1..5
  comment?: string;
  createdAt: Date;
}

const VendorRatingSchema: Schema = new Schema({
  vendorId: { type: String, required: true },
  reviewerUserId: { type: String, required: true },
  reviewerName: { type: String, required: true },
  stars: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

VendorRatingSchema.index({ vendorId: 1, reviewerUserId: 1 }, { unique: true });

export const VendorRatingModel =
  mongoose.models.VendorRating ||
  model<IVendorRating>("VendorRating", VendorRatingSchema);

// Native Sponsorships / Custom Partner Placements
export interface INativeSponsor extends Document {
  title: string;
  sponsorName: string;
  tagline: string;
  badgeText: string; // e.g. "Official Nightlife Partner", "Headline Lounge Sponsor"
  imageUrl: string;
  targetUrl: string; // Partner link or internal event/vendor link
  placement: 'home_spotlight' | 'explore_feed' | 'events_sidebar';
  active: boolean;
  clicks: number;
  impressions: number;
  createdAt: Date;
}

const NativeSponsorSchema: Schema = new Schema({
  title: { type: String, required: true },
  sponsorName: { type: String, required: true },
  tagline: { type: String, required: true },
  badgeText: { type: String, default: "Featured Partner" },
  imageUrl: { type: String, required: true },
  targetUrl: { type: String, required: true },
  placement: {
    type: String,
    enum: ['home_spotlight', 'explore_feed', 'events_sidebar'],
    default: 'home_spotlight',
  },
  active: { type: Boolean, default: true },
  clicks: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const NativeSponsorModel =
  mongoose.models.NativeSponsor ||
  model<INativeSponsor>("NativeSponsor", NativeSponsorSchema);

// Organizer Leads / Playbook Downloads (Lead Magnet)
export interface IOrganizerLead extends Document {
  name: string;
  brandName: string;
  whatsapp: string;
  email: string;
  city: string;
  estimatedAttendance?: string;
  claimedOffer: boolean;
  notes?: string;
  createdAt: Date;
}

const OrganizerLeadSchema: Schema = new Schema({
  name: { type: String, required: true },
  brandName: { type: String, required: true },
  whatsapp: { type: String, required: true },
  email: { type: String, required: true },
  city: { type: String, default: "Lagos" },
  estimatedAttendance: { type: String, default: "500-1500" },
  claimedOffer: { type: Boolean, default: true },
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

OrganizerLeadSchema.index({ whatsapp: 1 });
OrganizerLeadSchema.index({ email: 1 });

export const OrganizerLeadModel =
  mongoose.models.OrganizerLead ||
  model<IOrganizerLead>("OrganizerLead", OrganizerLeadSchema);

