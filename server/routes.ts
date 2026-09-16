import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import Stripe from "stripe";
import { sendBookingEmail, sendAdminNotification } from "./email";
import { User } from "./models";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check for Render wake up
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  
  // Initialize Stripe (if key is present, otherwise mock)
  const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;

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

  app.get(api.events.get.path, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
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
      const event = await storage.createEvent({
        ...input,
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

  app.post(api.bookings.create.path, async (req, res) => {
    try {
      const { eventId, quantity, totalAmount, userId, name, email, paymentReference, ticketType } = req.body;
      console.log("POST /api/bookings RECEIVED PAYLOAD:", req.body);
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        console.error("Booking failed: Event not found", eventId);
        return res.status(404).json({ message: "Event not found" });
      }

      // Update ticket types sold count
      const ticketTypes = JSON.parse(event.ticketTypes || '[]');
      const typeIndex = ticketTypes.findIndex((t: any) => t.name === (ticketType || 'Regular'));
      
      if (typeIndex !== -1) {
        const requestedQuantity = Number(quantity);
        if (ticketTypes[typeIndex].capacity && (Number(ticketTypes[typeIndex].sold || 0) + requestedQuantity > Number(ticketTypes[typeIndex].capacity))) {
          return res.status(400).json({ message: `Only ${ticketTypes[typeIndex].capacity - (ticketTypes[typeIndex].sold || 0)} tickets left for ${ticketTypes[typeIndex].name}` });
        }
        ticketTypes[typeIndex].sold = Number(ticketTypes[typeIndex].sold || 0) + requestedQuantity;
        
        // Also update global capacity
        const newCapacity = Number(event.capacity) - requestedQuantity;
        await storage.updateEvent(eventId, { 
          ticketTypes: JSON.stringify(ticketTypes),
          capacity: Math.max(0, newCapacity)
        });
      }

      const booking = await storage.createBooking({
        eventId,
        quantity,
        totalAmount,
        userId: userId || "anonymous",
        name: name || "Anonymous User",
        email: email || "no-email@provided.com",
        status: "paid",
        paymentReference: paymentReference || `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        ticketType: ticketType || 'Regular'
      });

      console.log("Booking created successfully:", booking.id);

      // Send emails (don't block response)
      try {
        if (booking.email) {
          await sendBookingEmail(booking.email, { 
            name: booking.name, 
            eventTitle: event.title, 
            quantity, 
            totalAmount 
          });
        }
        
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
          if (admin.email) {
            await sendAdminNotification(admin.email, 'booking', { 
              name: booking.name, 
              eventTitle: event.title 
            });
          }
        }
      } catch (emailErr) {
        console.error("Email notification failed:", emailErr);
      }

      res.status(201).json(booking);
    } catch (err: any) {
      console.error("Critical booking error:", err);
      res.status(500).json({ 
        message: err?.message || "Failed to create booking",
        error: err instanceof Error ? err.message : String(err)
      });
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
      res.json(vendor);
    } catch (err) {
      console.error("Vendor error:", err);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  app.post(api.vendors.create.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
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
    if (!req.isAuthenticated() || (req.user as any).role === 'user') {
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

  // Payments API
  app.post(api.payments.createIntent.path, async (req, res) => {
    if (!req.isAuthenticated()) {
       return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!stripe) {
      return res.status(503).json({ message: "Stripe not configured" });
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

  await seedDatabase();
  await seedAdmin();

  return httpServer;
}

async function seedAdmin() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      console.log("Seeding admin user...");
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new User({
        username: "admin",
        email: "admin@blackheritage.com",
        password: hashedPassword,
        role: "admin"
      });
      await admin.save();
      console.log("Admin user seeded: admin / admin123");
    }
  } catch (err) {
    console.error("Admin seeding failed:", err);
  }
}

async function seedDatabase() {
  const events = await storage.getEvents();
  const vendors = await storage.getVendors();
  if (vendors.length === 0) {
    console.log("Seeding vendor directory...");
    const sampleVendors = [
      {
        businessName: "DJ Zoro Naija",
        category: "DJ",
        bio: "Lagos-based party rocker with over a decade of experience hyping crowds at weddings, shows, and street carnivals. Specialises in Afrobeats, Amapiano, and old-school Naija jams with live MC hyping.",
        gallery: JSON.stringify([
          "https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1600&auto=format&fit=crop",
        ]),
        city: "Lagos",
        serviceArea: "Lagos, Ogun, Oyo states",
        phone: "+234 801 234 5678",
        whatsapp: "2348012345678",
        status: "published",
      },
      {
        businessName: "Grill & Grace Catering",
        category: "Caterer",
        bio: "Premium small chops, grilled delicacies, and native pots for weddings and corporate events. Our suya bar and jollof station are always the first thing to finish.",
        gallery: JSON.stringify([
          "https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=1600&auto=format&fit=crop",
        ]),
        city: "Lagos",
        serviceArea: "Lagos mainland & island",
        phone: "+234 802 345 6789",
        whatsapp: "2348023456789",
        status: "published",
      },
      {
        businessName: "The Pearls Photography",
        category: "Photographer",
        bio: "Documentary-style event photography that captures the real joy of your day. Same-week sneak peeks, full galleries delivered within 14 days, photo booth available on request.",
        gallery: JSON.stringify([
          "https://images.unsplash.com/photo-1520390138845-fd2d229dd553?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1600&auto=format&fit=crop",
        ]),
        city: "Abuja",
        serviceArea: "Abuja, Nasarawa, Kaduna",
        phone: "+234 803 456 7890",
        whatsapp: "2348034567890",
        status: "published",
      },
      {
        businessName: "Ewè Band",
        category: "Live Band",
        bio: "An 8-piece highlife and Afrobeats band bringing brass, talking drums, and four-part harmonies to your stage. Full band, acoustic trio, or DJ + sax packages available.",
        gallery: JSON.stringify([
          "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1501612780327-45045538702b?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1600&auto=format&fit=crop",
        ]),
        city: "Port Harcourt",
        serviceArea: "Nationwide (travel fees apply)",
        phone: "+234 804 567 8901",
        whatsapp: "2348045678901",
        status: "published",
      },
      {
        businessName: "Ambience by Ada",
        category: "Decorator",
        bio: "Transforming halls into dreamscapes with drapery, florals, and lighting design. From intimate traditional engagements to 1,000-guest receptions.",
        gallery: JSON.stringify([
          "https://images.unsplash.com/photo-1478146896981-b80fe463b330?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1510076857177-7470076d4098?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=1600&auto=format&fit=crop",
        ]),
        city: "Enugu",
        serviceArea: "South East & South South",
        phone: "+234 805 678 9012",
        whatsapp: "2348056789012",
        status: "published",
      },
      {
        businessName: "MC Smooth Voice",
        category: "MC",
        bio: "Bilingual MC (English & Pidgin) keeping programmes flowing and guests laughing. 500+ events hosted, from church harvests to beach parties.",
        gallery: JSON.stringify([
          "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1600&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1600&auto=format&fit=crop",
        ]),
        city: "Ibadan",
        serviceArea: "Oyo, Lagos, Ogun",
        phone: "+234 806 789 0123",
        whatsapp: "2348067890123",
        status: "published",
      },
    ];

    for (const vendor of sampleVendors) {
      await storage.createVendor(vendor as any);
    }
    console.log("Vendor directory seeded!");
  }

  if (events.length === 0) {
    console.log("Seeding database...");
    const sampleEvents = [
      {
        title: "Easter Sunday Cultural Gala",
        description: "Celebrate Easter with a premium night of culture, music, and elegance at our flagship gala.",
        date: new Date("2026-04-05T19:00:00"),
        location: "Eko Hotels & Suites, Lagos",
        price: 5000000,
        capacity: 500,
        imageUrl: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=2670&auto=format&fit=crop",
        isFeatured: true,
      },
      {
        title: "Easter Afro-Beats Festival",
        description: "The biggest music festival this Easter featuring top artists and non-stop vibes.",
        date: new Date("2026-04-06T16:00:00"),
        location: "Landmark Event Centre, Lagos",
        price: 2500000,
        capacity: 2000,
        imageUrl: "https://images.unsplash.com/photo-1514525253344-781474374a33?q=80&w=2574&auto=format&fit=crop",
        isFeatured: true,
      },
      {
        title: "Easter Family Fun Day",
        description: "A fun-filled day for the whole family with games, food, and amazing performances.",
        date: new Date("2026-04-04T10:00:00"),
        location: "Millennium Park, Abuja",
        price: 1000000,
        capacity: 1000,
        imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2670&auto=format&fit=crop",
        isFeatured: false,
      }
    ];

    for (const event of sampleEvents) {
      await storage.createEvent(event);
    }
    console.log("Database seeded!");
  }
}
