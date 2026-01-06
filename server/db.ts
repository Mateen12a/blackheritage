import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  // In development, we can use a local or a placeholder if not provided, 
  // but the user said they will provide it.
  console.warn("MONGODB_URI not set. Using a placeholder for now.");
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/blackheritage";

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI not set. Skipping real DB connection.");
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.warn("MongoDB connection failed:", err);
  }
}

export const db = mongoose.connection;
