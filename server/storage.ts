import { EventModel, BookingModel, BusinessBookingModel, User, type IEvent, type IBooking, type IBusinessBooking } from "./models";
import type { InsertEvent, InsertBooking, Event, Booking, BusinessBooking } from "@shared/schema";
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

function mapBooking(doc: any): Booking {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    ...obj,
    id: obj._id?.toString() || obj.id,
    eventId: obj.eventId?.toString() || obj.eventId,
    createdAt: new Date(obj.createdAt),
  };
}

const mockEvents: Event[] = [];

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
      return { ...booking, id: Math.random().toString(), createdAt: new Date() } as Booking;
    }
    // Log the incoming data to storage
    console.log("Storage layer receiving booking:", { name: booking.name, email: booking.email });
    
    const doc = new BookingModel(booking);
    await doc.save();
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
