import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

// Parse .env manually without external dependencies
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("ERROR: MONGODB_URI is not set in .env");
  process.exit(1);
}

const isConfirmed = process.argv.includes("--confirm");

async function main() {
  console.log("=== Black Heritage Demo Purge Utility ===");
  if (!isConfirmed) {
    console.log("MODE: DRY RUN (Default). No records or files will be modified or deleted.");
    console.log("Pass --confirm to perform actual deletion.\n");
  } else {
    console.log("MODE: LIVE PURGE (--confirm provided). Flagged demo records and orphaned images will be deleted.\n");
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const collections = ["events", "vendors", "users", "bookings", "tickets"];
  const summary: Record<string, number> = {};

  for (const collName of collections) {
    const coll = db.collection(collName);
    const count = await coll.countDocuments({ isDemo: true });
    summary[collName] = count;
    console.log(`Collection [${collName}]: ${count} records flagged with isDemo: true`);

    if (isConfirmed && count > 0) {
      const result = await coll.deleteMany({ isDemo: true });
      console.log(`  -> Deleted ${result.deletedCount} documents from ${collName}.`);
    }
  }

  // Orphaned demo image files
  const root = path.resolve(__dirname, "..");
  const candidateImages = [
    path.join(root, "client", "public", "dj-zoro.jpg"),
    path.join(root, "client", "public", "sip-and-paint.jpg"),
    path.join(root, "client", "public", "sip-and-paint-2.jpg"),
  ];

  console.log("\nChecking orphaned demo image files:");
  let imageCount = 0;
  for (const imgPath of candidateImages) {
    if (fs.existsSync(imgPath)) {
      imageCount++;
      console.log(`  - Found demo image: ${path.relative(root, imgPath)}`);
      if (isConfirmed) {
        fs.unlinkSync(imgPath);
        console.log(`    -> Deleted file: ${path.relative(root, imgPath)}`);
      }
    }
  }

  await client.close();

  console.log("\n=== Purge Summary ===");
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k}: ${v} records ${isConfirmed ? "deleted" : "targeted for deletion"}`);
  }
  console.log(`  image files: ${imageCount} files ${isConfirmed ? "deleted" : "targeted for deletion"}`);

  if (!isConfirmed) {
    console.log("\nDry run completed successfully. Zero changes were made.");
  } else {
    console.log("\nPurge completed successfully.");
  }
}

main().catch((err) => {
  console.error("Purge error:", err);
  process.exit(1);
});
