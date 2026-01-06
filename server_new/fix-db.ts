import mongoose from "mongoose";
import { User } from "./models/index";

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Connected to MongoDB");
  try {
    await User.collection.dropIndex("id_1");
    console.log("Dropped id_1 index");
  } catch (e) {
    console.log("Index id_1 does not exist or already dropped");
  }
  process.exit(0);
}

fix();
