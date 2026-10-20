// Promote an existing account to platform admin.
// usage (on the server, in the app folder):  node scripts/make-admin.cjs <username>
// Reads MONGODB_URI from .env. Admins approve organizer verification and
// mark payouts settled; admins can also create and manage events.
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#") && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

(async () => {
  const username = process.argv[2];
  if (!username) {
    console.error("usage: node scripts/make-admin.cjs <username>");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.db.collection("users");
  const user = await users.findOne({ username });
  if (!user) {
    console.error(`No account with username "${username}".`);
    process.exit(1);
  }
  await users.updateOne({ _id: user._id }, { $set: { role: "admin", isVerified: true, verificationStatus: "verified" } });
  console.log(`${username} is now an admin. Sign out and back in, then open /admin.`);
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
