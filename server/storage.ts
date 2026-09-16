import { EventModel, BookingModel, BusinessBookingModel, VendorModel, User, type IEvent, type IBooking, type IBusinessBooking, type IVendor } from "./models";
import type { InsertEvent, InsertBooking, Event, Booking, BusinessBooking, Vendor, InsertVendor } from "@shared/schema";
import mongoose from "mongoose";

export interface IStorage {
  getEvents(): Promise<Event[]>;
  getEvent(id: string | number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string | number, event: Partial<InsertEvent>): Promise<Event>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingsByUser(userId: string): Promise<(Booking & { event: Event })[]>;
  getBookingsByEvent(eventId: string | number): Promise<(Booking & { user: any })[]>;
  getBusinessBookingsByEvent(eventId: string | number): Promise<BusinessBooking[]>;
  getAdminStats(): Promise<{ totalEvents: number; totalTicketsSold: number; totalRevenue: number }>;
  getVendors(category?: string): Promise<Vendor[]>;
  getVendor(id: string | number): Promise<Vendor | undefined>;
  getAllVendors(): Promise<Vendor[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string | number, vendor: Partial<InsertVendor>): Promise<Vendor>;
  
  // Auth related
  getUser(id: string): Promise<any>;
  createUser(user: any): Promise<any>;
}

function mapEvent(doc: any): Event {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id?.toString() || obj.id,
    date: new Date(obj.date),
  };
}

// DEV FALLBACK DATA — used only when MongoDB is unreachable, so the public
// pages still render real content in local preview. Not used in production.
const mockVendors: Vendor[] = [
  {
    id: "vendor-dj-shady",
    businessName: "DJ Shady Bantz",
    category: "DJ",
    bio: "Lagos-born party starter with a decade of afrobeats, amapiano and old-school blends. Resident DJ at three of the island's biggest nightlife spots and a fixture at owambe season.",
    gallery: JSON.stringify([
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1571266028243-1e588a5d1e33?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop",
    ]),
    city: "Lagos",
    serviceArea: "Lagos Island, Lekki, Ikoyi, Victoria Island",
    phone: "+234 803 555 0117",
    whatsapp: "+2348035550117",
    status: "published",
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vendor-mc-papi",
    businessName: "MC Papi Flex",
    category: "MC",
    bio: "Your ceremony's chief hype officer. Bilingual Yoruba-English MC for weddings, corporate galas and street carnivals — keeps timelines tight and dance floors fuller.",
    gallery: JSON.stringify([
      "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop",
    ]),
    city: "Lagos",
    serviceArea: "Lagos mainland & island, Ogun State on request",
    phone: "+234 802 555 0142",
    whatsapp: "+2348025550142",
    status: "published",
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vendor-chops-and-grills",
    businessName: "Chops & Grills Co.",
    category: "Caterer",
    bio: "Small chops stations, live asun grills and full continental spreads for 50 to 2,000 guests. HACCP-certified kitchen in Yaba, uniformed service crew included.",
    gallery: JSON.stringify([
      "https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop",
    ]),
    city: "Lagos",
    serviceArea: "All of Lagos, Ibadan for large events",
    phone: "+234 809 555 0163",
    whatsapp: "+2348095550163",
    status: "published",
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vendor-drapery-lagos",
    businessName: "Drapery Lagos",
    category: "Decorator",
    bio: "Stage drapery, floral installations and lighting design that photograph beautifully. From intimate proposals to 1,000-guest ballroom transformations.",
    gallery: JSON.stringify([
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1478146896981-b80fe463b330?q=80&w=1200&auto=format&fit=crop",
    ]),
    city: "Lekki",
    serviceArea: "Lagos & Abuja",
    phone: "+234 815 555 0188",
    whatsapp: "+2348155550188",
    status: "published",
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vendor-lens-obi",
    businessName: "Lens by Obi",
    category: "Photographer",
    bio: "Documentary-style event photography with a same-week gallery turnaround. Concerts, white weddings and everything in between — 300+ events shot across Nigeria.",
    gallery: JSON.stringify([
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=1200&auto=format&fit=crop",
    ]),
    city: "Lagos",
    serviceArea: "Nationwide (travel fees outside Lagos)",
    phone: "+234 806 555 0129",
    whatsapp: null,
    status: "published",
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "vendor-palmwine-collective",
    businessName: "Palmwine Collective",
    category: "Live Band",
    bio: "Seven-piece highlife and palmwine band with full horn section. Traditional wedding sets, jazz lounge hours and afrobeats covers arranged for live instrumentation.",
    gallery: JSON.stringify([
      "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1200&auto=format&fit=crop",
    ]),
    city: "Lagos",
    serviceArea: "Lagos, Ogun, Oyo",
    phone: "+234 812 555 0150",
    whatsapp: "+2348125550150",
    status: "published",
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function mapBooking(doc: any): Booking {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id?.toString() || obj.id,
    eventId: obj.eventId?.toString() || obj.eventId,
    isVerified: obj.isVerified || false,
    verifiedAt: obj.verifiedAt ? new Date(obj.verifiedAt) : undefined,
    createdAt: new Date(obj.createdAt),
  };
}

function mapVendor(doc: any): Vendor {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id?.toString() || obj.id,
    createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
    updatedAt: obj.updatedAt ? new Date(obj.updatedAt) : new Date(),
  };
}

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

// DEV FALLBACK DATA — see note above mockVendors.
const mockEvents: Event[] = [
  {
    id: "event-afrobeats-night",
    title: "Afrobeats Republic: Lagos Night Shift",
    description: "The biggest open-air afrobeats party of the season. Three stages, twelve artists, one unforgettable Lagos night.",
    date: inDays(12),
    location: "Eko Atlantic, Victoria Island, Lagos",
    price: 700000,
    capacity: 5000,
    imageUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=1200&auto=format&fit=crop",
    isFeatured: true,
    status: "published",
    organizerId: null,
    sponsorPackages: "[]",
    vendorPackages: "[]",
    sponsorsEnabled: true,
    vendorsEnabled: true,
    ticketTypes: JSON.stringify([
      { name: "Regular", price: 700000, capacity: 4000, sold: 1830 },
      { name: "VIP", price: 2000000, capacity: 900, sold: 240 },
      { name: "VVIP Table", price: 8000000, capacity: 100, sold: 31 },
    ]),
  },
  {
    id: "event-owambe-royale",
    title: "Owambe Royale: The Heritage Ball",
    description: "Black-tie meets owambe. A cultural celebration of music, aso-ebi elegance and small chops till sunrise.",
    date: inDays(26),
    location: "Harbour Point, Wilmot Point Road, Lagos",
    price: 500000,
    capacity: 1200,
    imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop",
    isFeatured: true,
    status: "published",
    organizerId: null,
    sponsorPackages: "[]",
    vendorPackages: "[]",
    sponsorsEnabled: true,
    vendorsEnabled: true,
    ticketTypes: JSON.stringify([
      { name: "Regular", price: 500000, capacity: 1000, sold: 410 },
      { name: "VIP", price: 1500000, capacity: 200, sold: 88 },
    ]),
  },
  {
    id: "event-detty-jazz-sessions",
    title: "Detty December Jazz Sessions",
    description: "Live band evenings under the palms — highlife, jazz and palmwine music with special guests every night.",
    date: inDays(40),
    location: "Muri Okunola Park, Victoria Island, Lagos",
    price: 300000,
    capacity: 800,
    imageUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop",
    isFeatured: true,
    status: "published",
    organizerId: null,
    sponsorPackages: "[]",
    vendorPackages: "[]",
    sponsorsEnabled: true,
    vendorsEnabled: true,
    ticketTypes: "[]",
  },
];

export class MongoStorage implements IStorage {
  async getEvents(): Promise<Event[]> {
    try {
      if (mongoose.connection.readyState !== 1) return mockEvents;
      const docs = await EventModel.find({ status: 'published' });
      return docs.map(mapEvent);
    } catch (e) {
      return mockEvents;
    }
  }

  async getAllEvents(): Promise<Event[]> {
    try {
      if (mongoose.connection.readyState !== 1) return mockEvents;
      const docs = await EventModel.find();
      return docs.map(mapEvent);
    } catch (e) {
      return mockEvents;
    }
  }

  async getEvent(id: string | number): Promise<Event | undefined> {
    try {
      if (mongoose.connection.readyState !== 1) return mockEvents.find(e => e.id === id.toString());
      if (!mongoose.Types.ObjectId.isValid(id.toString())) return undefined;
      const doc = await EventModel.findById(id);
      return doc ? mapEvent(doc) : undefined;
    } catch (e) {
      return undefined;
    }
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    if (mongoose.connection.readyState !== 1) {
      const newEvent = { ...event, id: Math.random().toString(), date: new Date(event.date) } as Event;
      mockEvents.push(newEvent);
      return newEvent;
    }
    const doc = new EventModel(event);
    await doc.save();
    return mapEvent(doc);
  }

  async updateEvent(id: string | number, event: Partial<InsertEvent>): Promise<Event> {
    if (mongoose.connection.readyState !== 1) {
      const idx = mockEvents.findIndex(e => e.id === id.toString());
      if (idx === -1) throw new Error("Event not found");
      mockEvents[idx] = { ...mockEvents[idx], ...event } as Event;
      return mockEvents[idx];
    }
    const doc = await EventModel.findByIdAndUpdate(id, event, { new: true });
    if (!doc) throw new Error("Event not found");
    return mapEvent(doc);
  }

  async createBooking(booking: any): Promise<Booking> {
    if (mongoose.connection.readyState !== 1) {
      return { ...booking, id: Math.random().toString(), createdAt: new Date(), isVerified: false } as Booking;
    }
    // Log the incoming data to storage
    console.log("Storage layer receiving booking:", { name: booking.name, email: booking.email, ticketType: booking.ticketType });
    
    const doc = new BookingModel({
      ...booking,
      isVerified: false
    });
    await doc.save();
    return mapBooking(doc);
  }

  async verifyBooking(id: string): Promise<Booking> {
    const doc = await BookingModel.findByIdAndUpdate(new mongoose.Types.ObjectId(id), {
      isVerified: true,
      verifiedAt: new Date()
    }, { new: true });
    if (!doc) throw new Error("Booking not found");
    return mapBooking(doc);
  }

  async getBookingsByUser(userId: string): Promise<(Booking & { event: Event })[]> {
    const docs = await BookingModel.find({ userId }).populate('eventId');
    return docs.map(doc => {
      const booking = mapBooking(doc);
      return {
        ...booking,
        event: mapEvent(doc.eventId)
      };
    });
  }

  async getBookingsByEmail(email: string): Promise<(Booking & { event: Event })[]> {
    const docs = await BookingModel.find({ email }).populate('eventId');
    return docs.map(doc => {
      const booking = mapBooking(doc);
      return {
        ...booking,
        event: mapEvent(doc.eventId)
      };
    });
  }

  async getBookingsByEvent(eventId: string | number): Promise<(Booking & { user: any })[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId.toString())) return [];
    const docs = await BookingModel.find({ eventId: new mongoose.Types.ObjectId(eventId.toString()) }).lean();
    // In a real app we'd join with users, for now return as is with mock user
    return docs.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
      eventId: doc.eventId.toString(),
      user: { username: "User" }
    }));
  }

  async getBusinessBookingsByEvent(eventId: string | number): Promise<BusinessBooking[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId.toString())) return [];
    const docs = await BusinessBookingModel.find({ eventId: new mongoose.Types.ObjectId(eventId.toString()) });
    return docs.map((doc: any) => ({
      ...doc.toObject(),
      id: doc._id.toString(),
      eventId: doc.eventId.toString(),
    }));
  }

  async getVendors(category?: string): Promise<Vendor[]> {
    try {
      if (mongoose.connection.readyState !== 1) {
        return category ? mockVendors.filter(v => v.category === category) : mockVendors;
      }
      const query: any = { status: 'published' };
      if (category) query.category = category;
      const docs = await VendorModel.find(query);
      return docs.map(mapVendor);
    } catch (e) {
      return [];
    }
  }

  async getAllVendors(): Promise<Vendor[]> {
    try {
      if (mongoose.connection.readyState !== 1) return mockVendors;
      const docs = await VendorModel.find();
      return docs.map(mapVendor);
    } catch (e) {
      return [];
    }
  }

  async getVendor(id: string | number): Promise<Vendor | undefined> {
    try {
      if (mongoose.connection.readyState !== 1) return mockVendors.find(v => v.id === id.toString());
      if (!mongoose.Types.ObjectId.isValid(id.toString())) return undefined;
      const doc = await VendorModel.findById(id);
      return doc ? mapVendor(doc) : undefined;
    } catch (e) {
      return undefined;
    }
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    if (mongoose.connection.readyState !== 1) {
      const newVendor = { ...vendor, id: Math.random().toString(), createdAt: new Date(), updatedAt: new Date() } as unknown as Vendor;
      mockVendors.push(newVendor);
      return newVendor;
    }
    const doc = new VendorModel(vendor);
    await doc.save();
    return mapVendor(doc);
  }

  async updateVendor(id: string | number, vendor: Partial<InsertVendor>): Promise<Vendor> {
    if (mongoose.connection.readyState !== 1) {
      const idx = mockVendors.findIndex(v => v.id === id.toString());
      if (idx === -1) throw new Error("Vendor not found");
      mockVendors[idx] = { ...mockVendors[idx], ...vendor } as Vendor;
      return mockVendors[idx];
    }
    const doc = await VendorModel.findByIdAndUpdate(id, { ...vendor, updatedAt: new Date() }, { new: true });
    if (!doc) throw new Error("Vendor not found");
    return mapVendor(doc);
  }

  async getAdminStats(): Promise<{ totalEvents: number; totalTicketsSold: number; totalRevenue: number }> {
    const totalEvents = await EventModel.countDocuments();
    const result = await BookingModel.aggregate([
      { $group: { _id: null, totalSold: { $sum: "$quantity" }, totalRevenue: { $sum: "$totalAmount" } } }
    ]);
    
    const stats = result[0] || { totalSold: 0, totalRevenue: 0 };
    return {
      totalEvents,
      totalTicketsSold: stats.totalSold,
      totalRevenue: stats.totalRevenue
    };
  }

  async getUser(id: string): Promise<any> {
    return await User.findById(id);
  }

  async createUser(user: any): Promise<any> {
    const newUser = new User(user);
    await newUser.save();
    return newUser;
  }

  async deleteEvent(id: string | number): Promise<void> {
    await EventModel.findByIdAndDelete(id);
  }
}

export const storage = new MongoStorage();
