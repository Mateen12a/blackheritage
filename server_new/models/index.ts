import mongoose, { Schema, model, type Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  role: 'organizer' | 'admin';
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['organizer', 'admin'], default: 'organizer' },
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
  sponsorPackages: { type: String, default: '[]' },
  vendorPackages: { type: String, default: '[]' },
  sponsorsEnabled: { type: Boolean, default: true },
  vendorsEnabled: { type: Boolean, default: true },
  ticketTypes: { type: String, default: '[]' }, // Added ticketTypes
});

export const EventModel = mongoose.models.Event || model<IEvent>("Event", EventSchema);

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
  isVerified: { type: Boolean, default: false }, // Added isVerified
  verifiedAt: { type: Date }, // Added verifiedAt
  createdAt: { type: Date, default: Date.now }
});

export const BookingModel = mongoose.models.Booking || model<IBooking>("Booking", BookingSchema);

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
