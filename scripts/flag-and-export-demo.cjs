const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

// Parse .env manually without external dependencies
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
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

const seedEventSlugs = [
  'detty-december-afrobeats-festival-2026',
  'the-lagos-street-and-sound-festival',
  'lagos-alte-and-indie-sound-gathering-2026',
  'sub-bass-beachfront-sessions-season-closer',
  'sip-and-paint-rooftop-edition-lagos',
  'abuja-live-concert-gala-night-2026',
  'island-block-party-beachside-lagos',
  'eko-atlantic-amapiano-sunset-cruise',
  'lekki-food-and-wine-experience-2026',
  'owambe-live-band-cultural-extravaganza',
  'ibadan-drum-circle-agodi-garden-sessions'
];

const seedVendorSlugs = [
  'dj-zoro',
  'dj-consequence',
  'mc-lively-lagos',
  'lekki-gourmet-grills',
  'drapery-lagos',
  'shuttercraft-lagos',
  'afrobeat-brass-kings',
  'the-heritage-decor-co',
  'vibes-by-tolu',
  'moist-beach-security-elite',
  'cocktails-and-co-lagos',
  'golden-crust-bakeries',
  'mainland-staging-sound'
];

const seedUsernames = [
  'tunde_organizer',
  'ayo_attendee',
  'naija_vendor',
  'gate_lead',
  'gate_clerk'
];

async function run() {
  console.log("Connecting to MongoDB to identify and flag seeded/demo records...");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const exportData = {
    exportedAt: new Date().toISOString(),
    events: [],
    vendors: [],
    users: [],
    bookings: [],
    tickets: [],
    imageFiles: []
  };

  // 1. Identify Demo Events
  const eventsColl = db.collection('events');
  const demoEvents = await eventsColl.find({
    $or: [
      { slug: { $in: seedEventSlugs } },
      { title: { $regex: /sip.*paint|detty december|zoro|afrobeats republic/i } }
    ]
  }).toArray();
  exportData.events = demoEvents.map(e => ({ id: String(e._id), title: e.title, slug: e.slug }));
  const demoEventIds = demoEvents.map(e => e._id);

  // 2. Identify Demo Vendors
  const vendorsColl = db.collection('vendors');
  const demoVendors = await vendorsColl.find({
    $or: [
      { slug: { $in: seedVendorSlugs } },
      { businessName: { $regex: /DJ Zoro|MC Lively|Drapery Lagos|ShutterCraft/i } }
    ]
  }).toArray();
  exportData.vendors = demoVendors.map(v => ({ id: String(v._id), businessName: v.businessName, slug: v.slug }));

  // 3. Identify Demo Users
  const usersColl = db.collection('users');
  const demoUsers = await usersColl.find({
    $or: [
      { username: { $in: seedUsernames } },
      { email: { $regex: /blackhevents\.com$|example\.com$/i } }
    ]
  }).toArray();
  exportData.users = demoUsers.map(u => ({ id: String(u._id), username: u.username, email: u.email }));

  // 4. Identify Demo Bookings & Tickets
  const bookingsColl = db.collection('bookings');
  const demoBookings = await bookingsColl.find({
    $or: [
      { eventId: { $in: demoEventIds } },
      { email: { $regex: /example\.com$/i } },
      { paymentReference: { $regex: /^DEMO_|^seed-/i } }
    ]
  }).toArray();
  exportData.bookings = demoBookings.map(b => ({ id: String(b._id), ref: b.paymentReference, eventId: String(b.eventId) }));
  const demoBookingIds = demoBookings.map(b => b._id);

  const ticketsColl = db.collection('tickets');
  const demoTickets = await ticketsColl.find({
    $or: [
      { eventId: { $in: demoEventIds } },
      { bookingId: { $in: demoBookingIds } },
      { code: { $regex: /^BH-ZORO/i } }
    ]
  }).toArray();
  exportData.tickets = demoTickets.map(t => ({ id: String(t._id), code: t.code }));

  // 5. Image Files
  const root = path.resolve(__dirname, '..');
  const publicDir = path.join(root, 'client', 'public');
  const uploadsDir = path.join(root, 'uploads');

  const candidateImages = [
    'dj-zoro.jpg',
    'sip-and-paint.jpg',
    'sip-and-paint-2.jpg',
  ];
  for (const img of candidateImages) {
    const pubImg = path.join(publicDir, img);
    if (fs.existsSync(pubImg)) exportData.imageFiles.push(path.relative(root, pubImg));
  }

  // Flag records with isDemo: true (non-destructive update)
  console.log("\nFlagging identified records with isDemo: true...");

  if (demoEvents.length > 0) {
    const res = await eventsColl.updateMany({ _id: { $in: demoEventIds } }, { $set: { isDemo: true } });
    console.log(`  - Flagged ${res.modifiedCount} events with isDemo: true`);
  }
  if (demoVendors.length > 0) {
    const res = await vendorsColl.updateMany({ _id: { $in: demoVendors.map(v => v._id) } }, { $set: { isDemo: true } });
    console.log(`  - Flagged ${res.modifiedCount} vendors with isDemo: true`);
  }
  if (demoUsers.length > 0) {
    const res = await usersColl.updateMany({ _id: { $in: demoUsers.map(u => u._id) } }, { $set: { isDemo: true } });
    console.log(`  - Flagged ${res.modifiedCount} users with isDemo: true`);
  }
  if (demoBookings.length > 0) {
    const res = await bookingsColl.updateMany({ _id: { $in: demoBookingIds } }, { $set: { isDemo: true } });
    console.log(`  - Flagged ${res.modifiedCount} bookings with isDemo: true`);
  }
  if (demoTickets.length > 0) {
    const res = await ticketsColl.updateMany({ _id: { $in: demoTickets.map(t => t._id) } }, { $set: { isDemo: true } });
    console.log(`  - Flagged ${res.modifiedCount} tickets with isDemo: true`);
  }

  // Export results to out/demo-records-export.json
  const exportPath = path.join(root, 'out', 'demo-records-export.json');
  fs.mkdirSync(path.dirname(exportPath), { recursive: true });
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');

  console.log(`\nDemo records exported to: out/demo-records-export.json`);
  console.log(`Summary of identified demo records:`);
  console.log(`  Events: ${exportData.events.length}`);
  console.log(`  Vendors: ${exportData.vendors.length}`);
  console.log(`  Users: ${exportData.users.length}`);
  console.log(`  Bookings: ${exportData.bookings.length}`);
  console.log(`  Tickets: ${exportData.tickets.length}`);
  console.log(`  Image files: ${exportData.imageFiles.length}`);

  await client.close();
}

run().catch(err => {
  console.error("Flag and export failed:", err.message);
  process.exit(1);
});
