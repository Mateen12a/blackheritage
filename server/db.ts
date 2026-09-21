import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  console.warn("MONGODB_URI not set. Falling back to localhost; the seed and dev-store paths handle the rest.");
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/blackheritage";

// Production must not boot without a real database. A silent dev-store
// fallback here would take payments against memory. Atlas SRV resolution
// can be flaky, so connection attempts retry with backoff before dev mode
// is allowed to continue without a database.
export async function connectDB(): Promise<boolean> {
  const attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
      console.log("Connected to MongoDB");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (i < attempts) {
        console.warn(`MongoDB connection attempt ${i}/${attempts} failed, retrying:`, message.slice(0, 120));
        await new Promise((r) => setTimeout(r, 3000 * i));
      } else if (process.env.NODE_ENV === "production") {
        console.error("MongoDB connection failed in production. Refusing to start:", err);
        process.exit(1);
      } else {
        console.warn("MongoDB unreachable after retries (dev continues on the in-memory store):", message.slice(0, 160));
      }
    }
  }
  return false;
}

export const db = mongoose.connection;
