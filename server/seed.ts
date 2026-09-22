import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  User, EventModel, VendorModel, BookingModel, TicketModel,
  PromoCodeModel, PayoutModel, PlatformSettingModel, NativeSponsorModel,
} from "./models";
import { generateTicketCode } from "./tickets";

/**
 * Idempotent MongoDB top-up seed. Safe to run on every boot: each step checks
 * for its own data before writing, so restarts never duplicate. Handles both
 * a fresh database and a database created by the old seed (which has events
 * and bookings but no tickets, promos, payouts, or team accounts).
 */
export async function seedPlatform(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  // ── Platform settings: 6% tickets, 12.5% vendor bookings ──
  const settings = await PlatformSettingModel.findOne({ key: "platform" });
  if (!settings) {
    await PlatformSettingModel.create({ key: "platform", ticketCommissionBps: 600, vendorCommissionBps: 1250 });
    console.log("Seed: platform settings created (6% tickets, 12.5% vendor)");
  }

  // ── Accounts: admin, organizer, attendee, vendor owner, team staff ──
  const password = await bcrypt.hash("demo1234", 10);

  const ensureUser = async (username: string, email: string, role: string, extra: any = {}, pwd = password) => {
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      let touched = false;
      if (extra.teamOwnerId && existing.teamOwnerId !== extra.teamOwnerId) { existing.teamOwnerId = extra.teamOwnerId; touched = true; }
      if (extra.staffRole && existing.staffRole !== extra.staffRole) { existing.staffRole = extra.staffRole; touched = true; }
      if (existing.role !== role && role !== "user") { existing.role = role; touched = true; }
      if (touched) await existing.save();
      return existing;
    }
    return User.create({ username, email, password: pwd, role, ...extra });
  };

  const admin = await ensureUser("admin", "admin@blackheritage.africa", "admin", {}, await bcrypt.hash("admin123", 10));
  const organizer = await ensureUser("tunde_organizer", "tunde@blackheritage.africa", "organizer", {
    organizerSlug: "tunde-live",
    displayName: "Tunde Live Concepts",
    bio: "Lagos live music, concerts, and cultural gala curators. Connecting artists, fans, and culture across Nigeria.",
    logoUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=96&h=96&auto=format&fit=crop",
    coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
    socials: {
      instagram: "https://instagram.com/tundelive",
      twitter: "https://x.com/tundelive",
      whatsapp: "2348000000000",
      website: "https://blackheritage.africa",
    },
    theme: "midnight-gold",
    accentHex: "#E3B23C",
    customDomain: "tickets.tundelive.com",
    customDomainStatus: "active",
    announcement: {
      message: "Early bird passes live for the Detty December Finale. Limited VIP tables available via WhatsApp.",
      linkUrl: "",
      active: true,
    },
    followersCount: 1420,
  });

  if (!organizer.organizerSlug || organizer.organizerSlug !== "tunde-live") {
    organizer.organizerSlug = "tunde-live";
    organizer.displayName = "Tunde Live Concepts";
    organizer.bio = "Lagos live music, concerts, and cultural gala curators. Connecting artists, fans, and culture across Nigeria.";
    organizer.logoUrl = "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=96&h=96&auto=format&fit=crop";
    organizer.coverUrl = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop";
    organizer.socials = {
      instagram: "https://instagram.com/tundelive",
      twitter: "https://x.com/tundelive",
      whatsapp: "2348000000000",
      website: "https://blackheritage.africa",
    };
    organizer.theme = "midnight-gold";
    organizer.accentHex = "#E3B23C";
    organizer.customDomain = "tickets.tundelive.com";
    organizer.customDomainStatus = "active";
    organizer.announcement = {
      message: "Early bird passes live for the Detty December Finale. Limited VIP tables available via WhatsApp.",
      linkUrl: "",
      active: true,
    };
    organizer.followersCount = 1420;
    await organizer.save();
  }

  const attendee = await ensureUser("ayo_attendee", "ayo@example.com", "user");
  const vendorOwner = await ensureUser("naija_vendor", "naija@example.com", "user");

  const gateStaff = await ensureUser("gate_staff", "gate@blackheritage.africa", "user", {
    teamOwnerId: organizer._id.toString(),
    staffRole: "entry",
  });
  const financeStaff = await ensureUser("finance_staff", "finance@blackheritage.africa", "user", {
    teamOwnerId: organizer._id.toString(),
    staffRole: "finance",
  });
  if (!gateStaff.teamOwnerId) console.log("Seed: team accounts ensured (gate_staff, finance_staff)");

  // ── Organizer owns the seeded events so staff scope and dashboards work ──
  const organizerId = organizer._id.toString();
  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // ── 5 Authentic Upcoming Lagos Events ──
  const canonicalEvents = [
    {
      title: "Detty December Finale: Live at Moist Beach",
      slug: "detty-december-finale-moist-beach",
      daysAhead: 14,
      location: "Moist Beach Club, Oniru Beach, Victoria Island, Lagos",
      price: 1500000,
      capacity: 1500,
      imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
      description: "The premier coastal celebration closing out the Lagos party season. World-class Afrobeats DJs, live percussionists, seaside fireworks, and premium beach cabana bottle service.",
      ticketTypes: [
        { name: "General Admission", price: 1500000, capacity: 800, sold: 142, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "VIP Deck Access", price: 4500000, capacity: 250, sold: 58, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Premium Beach Cabana (Table of 8)", price: 60000000, capacity: 20, sold: 8, saleOpen: null, saleClose: inDays(28).toISOString() },
      ],
      gallery: [
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop",
      ],
      isFeatured: true,
      theme: "midnight-gold" as const,
      branding: { displayName: "Tunde Live Concepts", logoUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=96&h=96&auto=format&fit=crop", accentHex: "#C9A227" },
    },
    {
      title: "Lagos Afrobeats & Amapiano All-Nighter",
      slug: "lagos-afrobeats-amapiano-all-nighter",
      daysAhead: 21,
      location: "Landmark Beach, Water Corporation Drive, Victoria Island, Lagos",
      price: 1000000,
      capacity: 2200,
      imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1600&auto=format&fit=crop",
      description: "From Soweto basslines to Lagos highlife percussion. Non-stop twin-stage sound system featuring South Africa's finest log-drum selectors alongside Lagos headline tastemakers.",
      ticketTypes: [
        { name: "Regular Beach Pass", price: 1000000, capacity: 1200, sold: 310, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "VIP Sunset Lounge", price: 3500000, capacity: 300, sold: 92, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Backstage Artist Pass", price: 12000000, capacity: 50, sold: 19, saleOpen: null, saleClose: inDays(30).toISOString() },
      ],
      gallery: [
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop",
      ],
      isFeatured: true,
      theme: "ivory-editorial" as const,
      branding: { displayName: "Afro-Beats Festival", logoUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=96&h=96&auto=format&fit=crop", accentHex: "#9A6B1F" },
    },
    {
      title: "Palmwine & Suya Sunset Sessions",
      slug: "palmwine-suya-sunset-sessions",
      daysAhead: 9,
      location: "Muri Okunola Park, Victoria Island, Lagos",
      price: 750000,
      capacity: 850,
      imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1600&auto=format&fit=crop",
      description: "An open-air evening under the historic trees of Muri Okunola Park. Authentic fresh palmwine kegs, artisan ram suya, live acoustic neo-soul, and an intimate Lagos social market.",
      ticketTypes: [
        { name: "Sunset Entry", price: 750000, capacity: 500, sold: 180, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Gourmet Tasting Board Pass", price: 2250000, capacity: 150, sold: 64, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Picnic Lawn Table (Group of 4)", price: 8000000, capacity: 25, sold: 11, saleOpen: null, saleClose: inDays(25).toISOString() },
      ],
      gallery: [
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop",
      ],
      isFeatured: true,
      theme: "sunset-poster" as const,
      branding: null,
    },
    {
      title: "Lekki Block Party: Street & Sound",
      slug: "lekki-block-party-street-and-sound",
      daysAhead: 17,
      location: "Admiralty Way, Lekki Phase 1, Lagos",
      price: 500000,
      capacity: 1800,
      imageUrl: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1600&auto=format&fit=crop",
      description: "Lekki's biggest street-culture takeover. Pop-up streetwear drops, custom car showcase, three DJ sound trucks, and 360-degree party cyphers from twilight to dawn.",
      ticketTypes: [
        { name: "Block Entry", price: 500000, capacity: 1000, sold: 420, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Backstage Truck Access", price: 2500000, capacity: 200, sold: 88, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Crew Table of 6", price: 15000000, capacity: 30, sold: 14, saleOpen: null, saleClose: inDays(28).toISOString() },
      ],
      gallery: [
        "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop",
      ],
      isFeatured: true,
      theme: "midnight-gold" as const,
      branding: null,
    },
    {
      title: "Black Heritage Grand Gala & Awards",
      slug: "black-heritage-grand-gala-awards",
      daysAhead: 28,
      location: "Grand Ballroom, Eko Hotel & Suites, Victoria Island, Lagos",
      price: 3000000,
      capacity: 950,
      imageUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1600&auto=format&fit=crop",
      description: "An evening honoring contemporary African creators, directors, sound engineers, and cultural pioneers. Red carpet champagne reception, multi-course banquet, and headline performances.",
      ticketTypes: [
        { name: "Gala Theatre Seating", price: 3000000, capacity: 350, sold: 85, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Banquet Dining Seat", price: 9500000, capacity: 200, sold: 72, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "VIP Patron Table of 10", price: 120000000, capacity: 15, sold: 6, saleOpen: null, saleClose: inDays(28).toISOString() },
      ],
      gallery: [
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
      ],
      isFeatured: true,
      theme: "midnight-gold" as const,
      branding: null,
    },
  ];

  for (const item of canonicalEvents) {
    const existing = await EventModel.findOne({
      $or: [{ title: item.title }, { slug: item.slug }],
    });
    if (!existing) {
      await EventModel.create({
        title: item.title,
        slug: item.slug,
        organizerId,
        organizerName: "Tunde Live Concepts",
        description: item.description,
        date: inDays(item.daysAhead),
        location: item.location,
        price: item.price,
        capacity: item.capacity,
        imageUrl: item.imageUrl,
        isFeatured: item.isFeatured,
        status: "published",
        ticketTypes: JSON.stringify(item.ticketTypes),
        gallery: JSON.stringify(item.gallery),
        pastEventVideos: "[]",
        theme: item.theme,
        branding: item.branding,
        showRemainingCounts: true,
        showAttendeeCount: true,
        waitlistEnabled: true,
        guestCheckout: true,
        promoCodesPublic: true,
      });
      console.log(`Seed: canonical event created: "${item.title}"`);
    } else {
      if (new Date(existing.date).getTime() < Date.now()) {
        existing.date = inDays(item.daysAhead);
        existing.date.setUTCHours(19, 0, 0, 0);
        await existing.save();
      }
    }
  }

  let events = await EventModel.find();
  if (events.length > 0) {
    let touched = false;
    for (const ev of events) {
      if (!ev.organizerId) { ev.organizerId = organizerId; ev.organizerName = ev.organizerName || "Tunde Live Concepts"; touched = true; }
      // Keep one demo event permanently upcoming so the gate portal, live
      // stats, and "shows on sale" counts always have live data to show.
      if (ev.title === "Easter Sunday Cultural Gala" && new Date(ev.date).getTime() < Date.now()) {
        ev.date = inDays(14);
        ev.date.setUTCHours(19, 0, 0, 0);
        // Reopen the sale windows too, so tiers never read as closed.
        try {
          const tiers = JSON.parse(ev.ticketTypes || "[]");
          for (const t of tiers) {
            if (!t.saleClose || new Date(t.saleClose).getTime() < Date.now()) t.saleClose = inDays(30).toISOString();
          }
          ev.ticketTypes = JSON.stringify(tiers);
        } catch { /* tiers get rebuilt below if unparsable */ }
        touched = true;
      }
      // New-format fields on events created before the ticketing build
      if (ev.promoterCommissionBps == null) { ev.promoterCommissionBps = 0; touched = true; }
      if (ev.gallery == null) { ev.gallery = "[]"; touched = true; }
      if (ev.pastEventVideos == null) { ev.pastEventVideos = "[]"; touched = true; }
      if (ev.slug == null) {
        // Stable, human-friendly share slugs: "Easter Sunday Cultural Gala" -> "easter-sunday-cultural-gala"
        const base = String(ev.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
        ev.slug = base || undefined;
        if (ev.slug) {
          // Respect the unique index: suffix duplicates instead of crashing boot.
          const { EventModel: EM } = await import("./models");
          for (let n = 2; n < 50; n++) {
            const clash = await EM.findOne({ slug: ev.slug }).lean();
            if (!clash) break;
            ev.slug = `${base}-${n}`;
          }
        }
        touched = true;
      }
    }
    if (touched) {
      await Promise.all(events.map((e) => e.save()));
      console.log("Seed: events assigned to organizer and upgraded to new schema");
    }
  }

  // Showcase the selling preferences on the flagship: one event demos every
  // organizer control (counts off would hide scarcity, so leave it on; the
  // demo shows public promos, attendee count, waitlist, and full branding).
  // The other two events demo different themes and branding states so the
  // gallery shows the range: one fully branded light theme, one default.
  const themeShowcase = [
    {
      // Flagship: full custom branding with a real logo so the custom
      // header mode and the custom-accent-over-theme flow are demoed.
      theme: "midnight-gold" as const,
      branding: { displayName: "Tunde Live Concepts", logoUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=96&h=96&auto=format&fit=crop", accentHex: "#C9A227" },
    },
    {
      // Light theme + logo: shows the branded header on a bright preset.
      theme: "ivory-editorial" as const,
      branding: { displayName: "Afro-Beats Festival", logoUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=96&h=96&auto=format&fit=crop", accentHex: "#9A6B1F" },
    },
    {
      // Default mode: no branding, standard Black Heritage header.
      theme: "sunset-poster" as const,
      branding: null as null,
    },
  ];
  if (events.length > 0) {
    const demo = events[0];
    const wants = {
      showRemainingCounts: true,
      showAttendeeCount: true,
      waitlistEnabled: true,
      guestCheckout: true,
      promoCodesPublic: true,
      checkoutFields: { phone: true, tableNote: true, dietaryNote: false },
      branding: themeShowcase[0].branding,
      theme: themeShowcase[0].theme,
    };
    const needs =
      demo.showRemainingCounts !== true ||
      demo.showAttendeeCount !== true ||
      demo.waitlistEnabled !== true ||
      demo.promoCodesPublic !== true ||
      demo.guestCheckout !== true ||
      demo.checkoutFields?.phone !== true ||
      demo.checkoutFields?.tableNote !== true ||
      demo.branding?.displayName !== wants.branding?.displayName ||
      demo.branding?.accentHex !== wants.branding?.accentHex ||
      demo.branding?.logoUrl !== wants.branding?.logoUrl ||
      demo.theme !== wants.theme ||
      !demo.slug;
    if (needs) {
      await EventModel.updateOne({ _id: demo._id }, { $set: wants });
      console.log(`Seed: selling preferences + branding applied to "${demo.title}"`);
    }
    // Theme/branding showcase on the remaining events (default header mode
    // on the third: no branding, so the standard BH navbar shows).
    for (let i = 1; i < events.length && i < themeShowcase.length; i++) {
      const ev = events[i];
      const show = themeShowcase[i];
      if (ev.theme !== show.theme || JSON.stringify(ev.branding || null) !== JSON.stringify(show.branding)) {
        await EventModel.updateOne({ _id: ev._id }, { $set: { theme: show.theme, branding: show.branding } });
        console.log(`Seed: theme "${show.theme}" applied to "${ev.title}"`);
      }
    }
  }

  // Ensure every event has real tiers with capacity and sale windows
  for (const ev of events) {
    let tiers: any[] = [];
    try { tiers = JSON.parse(ev.ticketTypes || "[]"); } catch { tiers = []; }
    // Headroom heal: demo/test bookings accumulate on the flagship and can
    // sell a tier to its last seat, which bricks the booking demo and the
    // e2e suite. Grow capacity before that happens; on a real event the
    // organizer sets capacity, but this database is the showcase.
    if (ev === events[0]) {
      let grew = false;
      for (const t of tiers) {
        const remaining = Number(t.capacity || 0) - Number(t.sold || 0);
        if (remaining < 10) {
          t.capacity = Number(t.sold || 0) + 25;
          grew = true;
        }
      }
      if (grew) {
        ev.ticketTypes = JSON.stringify(tiers);
        const totalCap = tiers.reduce((a: number, t: any) => a + Number(t.capacity || 0), 0);
        if (totalCap > Number(ev.capacity || 0)) ev.capacity = totalCap;
        await ev.save();
        console.log("Seed: flagship tier headroom restored");
      }
    }
    if (tiers.length === 0) {
      tiers = [
        { name: "General Admission", price: ev.price || 500000, capacity: Math.max(50, ev.capacity || 200), sold: 0, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "VIP", price: Math.round((ev.price || 500000) * 2.5), capacity: 80, sold: 0, saleOpen: null, saleClose: inDays(30).toISOString() },
        { name: "Table Booking", price: Math.round((ev.price || 500000) * 12), capacity: 20, sold: 0, saleOpen: null, saleClose: inDays(28).toISOString() },
      ];
      ev.ticketTypes = JSON.stringify(tiers);
      await ev.save();
      console.log(`Seed: tiers created for "${ev.title}"`);
    }
  }
  events = await EventModel.find();

  // ── Promo codes on the first event ──
  const flagship = events[0];
  const promoCount = await PromoCodeModel.countDocuments({ eventId: flagship?._id });
  if (flagship && promoCount === 0) {
    await PromoCodeModel.create({
      code: "EARLYBIRD", eventId: flagship._id, kind: "percent", value: 15,
      maxUses: 200, usedCount: 0, expiresAt: inDays(5), active: true,
    });
    await PromoCodeModel.create({
      code: "CREW500", eventId: flagship._id, kind: "fixed", value: 50000,
      maxUses: 50, usedCount: 0, expiresAt: inDays(30), active: true,
    });
    console.log(`Seed: promo codes EARLYBIRD and CREW500 on "${flagship.title}"`);
  }

  // ── Tickets for every paid booking that has none ──
  const paidBookings = await BookingModel.find({ status: "paid" });
  let minted = 0;
  for (const booking of paidBookings) {
    const existing = await TicketModel.countDocuments({ bookingId: booking._id });
    if (existing > 0) continue;
    const ev = events.find((e) => String(e._id) === String(booking.eventId)) || events.find((e) => String(e._id) === String((booking as any).eventId));
    const tiers: any[] = ev ? JSON.parse(ev.ticketTypes || "[]") : [];
    const tier = tiers.find((t: any) => t.name === booking.ticketType) || tiers[0];
    const unit = tier ? tier.price : Math.round((booking.totalAmount || 0) / Math.max(1, booking.quantity));
    for (let i = 0; i < booking.quantity; i++) {
      await TicketModel.create({
        code: generateTicketCode(),
        eventId: booking.eventId,
        bookingId: booking._id,
        seat: i + 1,
        tierName: tier ? tier.name : booking.ticketType || "General",
        attendeeName: booking.name || "Guest",
        attendeeEmail: booking.email || "guest@example.com",
        amountPaid: unit,
        status: "valid",
      });
      minted += 1;
    }
    if (tier) {
      tier.sold = Number(tier.sold || 0) + booking.quantity;
      if (ev) { ev.ticketTypes = JSON.stringify(tiers); await ev.save(); }
    }

    // Commission rows for that booking
    const payoutExists = await PayoutModel.countDocuments({ sourceBookingId: booking._id });
    if (payoutExists === 0) {
      const feeBps = 600;
      await PayoutModel.create({
        kind: "platform_fee", eventId: booking.eventId, organizerId,
        recipientName: "BlackHeritage",
        amount: Math.round(((booking.totalAmount || 0) * feeBps) / 10000),
        sourceBookingId: booking._id, status: "due", note: "6% platform commission",
      });
      if (ev?.promoterName && (ev.promoterCommissionBps || 0) > 0) {
        await PayoutModel.create({
          kind: "promoter_commission", eventId: booking.eventId, organizerId,
          recipientName: ev.promoterName,
          amount: Math.round(((booking.totalAmount || 0) * ev.promoterCommissionBps) / 10000),
          sourceBookingId: booking._id, status: "due",
          note: `${ev.promoterCommissionBps / 100}% promoter share chosen by the organizer`,
        });
      }
    }
  }
  if (minted > 0) console.log(`Seed: ${minted} tickets minted for paid bookings, commission rows recorded`);

  // Give the demo attendee a guaranteed live booking on the flagship so the
  // dashboard and gate portal always have something real to show.
  const ayoBooking = await BookingModel.countDocuments({ email: "ayo@example.com", eventId: flagship?._id });
  if (flagship && attendee && ayoBooking === 0) {
    const tiers: any[] = JSON.parse(flagship.ticketTypes);
    const vip = tiers.find((t: any) => t.name === "VIP") || tiers[0];
    const booking = await BookingModel.create({
      userId: attendee._id.toString(),
      eventId: flagship._id,
      ticketType: vip.name,
      quantity: 2,
      totalAmount: vip.price * 2,
      name: "Ayo Balogun",
      email: "ayo@example.com",
      status: "paid",
      paymentReference: "DEMO_PSX_88213",
      paymentGateway: "simulated",
      paidAt: new Date(),
    });
    await TicketModel.create([
      {
        code: "BH-7KQ2M4XA", eventId: flagship._id, bookingId: booking._id, seat: 1,
        tierName: vip.name, attendeeName: "Ayo Balogun", attendeeEmail: "ayo@example.com",
        amountPaid: vip.price, status: "valid",
      },
      {
        code: "BH-3XW9RDTZ", eventId: flagship._id, bookingId: booking._id, seat: 2,
        tierName: vip.name, attendeeName: "Ayo Balogun", attendeeEmail: "ayo@example.com",
        amountPaid: vip.price, status: "valid",
      },
    ]);
    vip.sold = Number(vip.sold || 0) + 2;
    flagship.ticketTypes = JSON.stringify(tiers);
    await flagship.save();
    await PayoutModel.create({
      kind: "platform_fee", eventId: flagship._id, organizerId,
      recipientName: "BlackHeritage",
      amount: Math.round((vip.price * 2 * 600) / 10000),
      sourceBookingId: booking._id, status: "due", note: "6% platform commission",
    });
    console.log("Seed: demo attendee booking created with codes BH-7KQ2M4XA / BH-3XW9RDTZ");
  }

  // Demo green-path ticket: one always-valid code for testing the gate's
  // allow-entry screen. Heals itself if a demo refund voided it.
  if (flagship) {
    const demoCode = "BH-DEMOTICK";
    const demoTicket = await TicketModel.findOne({ code: demoCode });
    if (demoTicket) {
      if (demoTicket.status !== "valid") {
        await TicketModel.updateOne({ _id: demoTicket._id }, { $set: { status: "valid", usedAt: null, usedBy: null } });
        console.log("Seed: demo ticket re-validated for the green-path test");
      }
    } else {
      const gaTiers: any[] = JSON.parse(flagship.ticketTypes || "[]");
      const ga = gaTiers.find((t: any) => /general/i.test(t.name)) || gaTiers[0];
      const demoBooking = await BookingModel.create({
        userId: gateStaff._id.toString(),
        eventId: flagship._id,
        ticketType: ga ? ga.name : "General Admission",
        quantity: 1,
        totalAmount: ga ? ga.price : 500000,
        name: "Demo Allow Entry",
        email: "demo-walkin@blackheritage.africa",
        status: "paid",
        paymentReference: "DEMO_WALKIN_1",
        paymentGateway: "simulated",
        paidAt: new Date(),
      });
      await TicketModel.create({
        code: demoCode, eventId: flagship._id, bookingId: demoBooking._id, seat: 1,
        tierName: ga ? ga.name : "General Admission", attendeeName: "Demo Allow Entry",
        attendeeEmail: "demo-walkin@blackheritage.africa", amountPaid: ga ? ga.price : 500000,
        status: "valid",
      });
      console.log("Seed: demo walk-in ticket created (code BH-DEMOTICK)");
    }
  }

  // ── 5 Authentic Verified Lagos Event Vendors ──
  const canonicalVendors = [
    {
      businessName: "DJ Consequence",
      category: "DJ",
      categoryLabel: "Headline Tour DJ",
      bio: "The Vibes Machine. Resident DJ at Club Quilox and headline festival tour DJ across Africa. Curating high-energy afrobeats, amapiano, and house sets with live percussion.",
      gallery: [
        "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1571266028243-1e588a5d1e33?q=80&w=1200&auto=format&fit=crop",
      ],
      videos: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      socials: { instagram: "djconsequence", x: "djconsequence" },
      city: "Lagos",
      serviceArea: "Victoria Island, Ikoyi, Lekki Phase 1, Destination Events",
      phone: "+234 802 345 6789",
      whatsapp: "2348023456789",
      slug: "dj-consequence",
      theme: "midnight-gold" as const,
      branding: { displayName: "DJ Consequence", accentHex: "#E3B23C" },
    },
    {
      businessName: "Lagos Cocktail Artisans",
      category: "Other",
      categoryLabel: "Bar & Mixology",
      bio: "Craft cocktail catering for luxury private galas, beach festivals, and wedding after-parties. Bespoke smoked palmwine punch, botanical gin infusions, and rapid flair-bartending bars.",
      gallery: [
        "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=1200&auto=format&fit=crop",
      ],
      videos: [],
      socials: { instagram: "lagoscocktailartisans" },
      city: "Lagos",
      serviceArea: "Lekki, Victoria Island, Ikoyi, Epe Expressway",
      phone: "+234 803 555 1204",
      whatsapp: "2348035551204",
      slug: "lagos-cocktail-artisans",
      theme: "midnight-gold" as const,
      branding: { displayName: "Lagos Cocktail Artisans", accentHex: "#E3B23C" },
    },
    {
      businessName: "Luminance Stage & Sound Tech",
      category: "Other",
      categoryLabel: "Lighting & Sound",
      bio: "Concert-grade L-Acoustics line arrays, moving-head beam fixtures, atmospheric haze, and LED video walls for high-profile concerts and festival stages.",
      gallery: [
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop",
      ],
      videos: [],
      socials: { instagram: "luminancetechng" },
      city: "Lagos",
      serviceArea: "Eko Hotel, Landmark Centre, Oniru Beach, nationwide touring",
      phone: "+234 809 111 8842",
      whatsapp: "2348091118842",
      slug: "luminance-stage-sound-tech",
      theme: "midnight-gold" as const,
      branding: { displayName: "Luminance Tech", accentHex: "#E3B23C" },
    },
    {
      businessName: "Ayo Visuals & Drone Studio",
      category: "Photographer",
      categoryLabel: "Visuals & Drone",
      bio: "Editorial night photography, rapid 60-second festival reels, and 4K FPV drone cinematography. Capturing authentic crowd energy with 24-hour turnaround for organizers.",
      gallery: [
        "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop",
      ],
      videos: [],
      socials: { instagram: "ayovisuals.ng" },
      city: "Lagos",
      serviceArea: "Lagos Island, Mainland, Abuja, Accra",
      phone: "+234 818 777 9931",
      whatsapp: "2348187779931",
      slug: "ayo-visuals-drone-studio",
      theme: "midnight-gold" as const,
      branding: { displayName: "Ayo Visuals", accentHex: "#E3B23C" },
    },
    {
      businessName: "Naija Gourmet Grills & Small Chops",
      category: "Caterer",
      categoryLabel: "Gourmet Grills & Suya",
      bio: "Signature charcoal-grilled ram asun, fiery peppered snails, prawn spring rolls, and midnight suya stations delivered hot to VIP tables and festival attendees.",
      gallery: [
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
      ],
      videos: [],
      socials: { instagram: "naijagourmetgrills" },
      city: "Lagos",
      serviceArea: "Victoria Island, Lekki Phase 1, Ikeja GRA, Banana Island",
      phone: "+234 805 222 3409",
      whatsapp: "2348052223409",
      slug: "naija-gourmet-grills-small-chops",
      theme: "midnight-gold" as const,
      branding: { displayName: "Naija Gourmet Grills", accentHex: "#E3B23C" },
    },
  ];

  for (let i = 0; i < canonicalVendors.length; i++) {
    const v = canonicalVendors[i];
    const existing = await VendorModel.findOne({
      $or: [{ businessName: v.businessName }, { slug: v.slug }],
    });
    if (!existing) {
      await VendorModel.create({
        businessName: v.businessName,
        category: v.category,
        categoryLabel: v.categoryLabel,
        bio: v.bio,
        gallery: JSON.stringify(v.gallery),
        videos: JSON.stringify(v.videos),
        socials: JSON.stringify(v.socials),
        city: v.city,
        serviceArea: v.serviceArea,
        phone: v.phone,
        whatsapp: v.whatsapp,
        slug: v.slug,
        status: "published",
        ownerId: i === 0 ? vendorOwner?._id?.toString() : undefined,
        theme: v.theme,
        branding: v.branding,
      });
      console.log(`Seed: verified vendor created: "${v.businessName}"`);
    } else {
      if (!existing.gallery || existing.gallery === "[]") {
        existing.gallery = JSON.stringify(v.gallery);
        await existing.save();
      }
    }
  }

  // ── Vendor showcase: one published vendor carries the profile-link demo ──
  // Healed on every boot so the demo survives e2e runs, same as the event
  // showcase. Targets whichever vendor set the database actually holds:
  // an already-branded one, else the first published profile.
  const showcase =
    (await VendorModel.findOne({ slug: { $exists: true, $ne: null }, branding: { $ne: null } })) ||
    (await VendorModel.findOne({ status: "published" }).sort({ createdAt: 1 }));
  if (showcase && (!showcase.slug || !showcase.branding
    || showcase.branding.displayName !== showcase.businessName
    || showcase.branding.accentHex !== "#E3B23C"
    || showcase.theme !== "midnight-gold"
    || showcase.ownerId !== vendorOwner?._id?.toString())) {
    const base = showcase.businessName
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "vendor";
    let slug = base;
    for (let n = 2; n < 50; n++) {
      const clash = await VendorModel.findOne({ slug, _id: { $ne: showcase._id } }).lean();
      if (!clash) break;
      slug = `${base}-${n}`;
    }
    showcase.slug = slug;
    showcase.theme = "midnight-gold";
    showcase.branding = { displayName: showcase.businessName, accentHex: "#E3B23C" };
    // The demo vendor account owns the showcase so the naija_vendor
    // credentials can actually edit the profile-link studio in demos.
    if (vendorOwner?._id) showcase.ownerId = vendorOwner._id.toString();
    await showcase.save();
    console.log("Seed: vendor showcase branding applied to " + showcase.businessName);
  }

  // ── Vendor trust demo: one real client-to-owner conversation on the ──
  // ── showcase profile so the reply-time signal has honest data.       ──
  if (showcase && attendee && vendorOwner?._id && showcase.ownerId === vendorOwner._id.toString()) {
    const { MessageModel } = await import("./models");
    const hasDemoConvo = await MessageModel.countDocuments({ conversationId: "seed-vendor-demo" });
    if (hasDemoConvo === 0) {
      const clientAsk = new Date(Date.now() - 26 * 60 * 60 * 1000);
      const ownerReply = new Date(clientAsk.getTime() + 12 * 60 * 1000);
      await MessageModel.create([
        {
          conversationId: "seed-vendor-demo",
          senderId: attendee._id.toString(),
          recipientId: vendorOwner._id.toString(),
          vendorId: showcase._id.toString(),
          body: "Hi, are you available for a wedding in Lekki next month? Roughly 300 guests.",
          createdAt: clientAsk,
        },
        {
          conversationId: "seed-vendor-demo",
          senderId: vendorOwner._id.toString(),
          recipientId: attendee._id.toString(),
          vendorId: showcase._id.toString(),
          body: "Yes, that date is open. Send the venue and I will put a package together for you.",
          createdAt: ownerReply,
        },
      ]);
      console.log("Seed: vendor trust demo conversation created");
    }
  }

  // ── Vendor ratings demo: two reviews on the showcase profile so the stars
  // render for attendees. Healed like the rest of the showcase state.
  if (showcase && mongoose.connection.readyState === 1) {
    const { VendorRatingModel, User: UserModel } = await import("./models");
    const ratingCount = await VendorRatingModel.countDocuments({ vendorId: showcase._id.toString() });
    if (ratingCount === 0) {
      const reviewers = await UserModel.find({ role: "user" }).limit(2).lean();
      const demoReviews = [
        { stars: 5, comment: "Turned the whole room up. Booked for two events already." },
        { stars: 4, comment: "Solid set and easy to deal with. Arrived early." },
      ];
      for (let i = 0; i < demoReviews.length && i < reviewers.length; i++) {
        const reviewer = reviewers[i] as any;
        await VendorRatingModel.create({
          vendorId: showcase._id.toString(),
          reviewerUserId: String(reviewer._id),
          reviewerName: reviewer.displayName || reviewer.username,
          stars: demoReviews[i].stars,
          comment: demoReviews[i].comment,
        });
      }
      console.log("Seed: vendor ratings demo created");
    }
  }

  // ── Native Brand Sponsors ──
  const canonicalSponsors = [
    {
      title: "Official Spirits Partner of Lagos Alternative Nights",
      sponsorName: "Jameson Nigeria",
      tagline: "Smooth triple-distilled whiskey blended with Lagos street soul. Enjoy Jameson Ginger & Lime at featured Black Heritage bars.",
      badgeText: "Official Spirits Partner",
      imageUrl: "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?q=80&w=1200&auto=format&fit=crop",
      targetUrl: "/events",
      placement: "home_spotlight" as const,
      active: true,
    },
    {
      title: "The Headline Reserve for High-Energy Lagos Tables",
      sponsorName: "Don Julio 1942",
      tagline: "Handcrafted in the highlands of Jalisco, served chilled across the finest VIP beach cabanas in Victoria Island and Ikoyi.",
      badgeText: "Headline Luxury Sponsor",
      imageUrl: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=1200&auto=format&fit=crop",
      targetUrl: "/events",
      placement: "explore_feed" as const,
      active: true,
    },
    {
      title: "Ultra Low-Latency Wi-Fi for Island Beach Festivals",
      sponsorName: "Starlink Event Operations",
      tagline: "Powering POS terminals, live 4K stream broadcasts, and attendee Wi-Fi at Landmark and Moist Beach with satellite internet.",
      badgeText: "Official Infrastructure Partner",
      imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop",
      targetUrl: "/vendors",
      placement: "events_sidebar" as const,
      active: true,
    },
  ];

  for (const s of canonicalSponsors) {
    const existing = await NativeSponsorModel.findOne({ title: s.title });
    if (!existing) {
      await NativeSponsorModel.create(s);
      console.log(`Seed: native sponsor created: "${s.sponsorName}" (${s.placement})`);
    }
  }

  console.log("Seed check complete.");
}
