// Automated event reminders. Every few minutes the scheduler scans paid
// bookings for events that are 7 days, 1 day, or 2 hours away and emails
// guests who have not already received that touch. The EventReminder
// collection is the dedupe ledger: one unique row per (booking, kind), so
// a backend restart mid-run can never double-send. Guests opt out with a
// link in every reminder (remindersDisabled on the booking).

import { BookingModel, EventModel, EventReminderModel } from "./models";
import { sendEventReminderEmail, type ReminderKind } from "./emails";
import { buildEventIcs } from "./calendar";

const RUN_INTERVAL_MS = 5 * 60 * 1000;

// Windows are wide on purpose: the unique ledger is what prevents double
// sends, the window only decides which run picks the booking up.
const WINDOWS: { kind: ReminderKind; minMs: number; maxMs: number }[] = [
  { kind: "week", minMs: 6.5 * 24 * 60 * 60 * 1000, maxMs: 8 * 24 * 60 * 60 * 1000 },
  { kind: "day", minMs: 20 * 60 * 60 * 1000, maxMs: 30 * 60 * 60 * 1000 },
  { kind: "soon", minMs: 1 * 60 * 60 * 1000, maxMs: 3 * 60 * 60 * 1000 },
];

let running = false;

function appUrl(): string {
  return process.env.PUBLIC_APP_URL || "http://localhost:5000";
}

export async function runReminderSweepOnce(): Promise<{ sent: number; skipped: number }> {
  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const win of WINDOWS) {
    // Bookings whose event starts inside this window. Paid only: pending
    // money has no tickets to remind about, cancelled guests get nothing.
    const bookings = await BookingModel.find({
      status: "paid",
      remindersDisabled: { $ne: true },
      // Gate/walk-in tickets carry a synthetic address; never mail them.
      email: { $not: /^walk-in\+no-email@blackhevents\.com$/i },
    })
      .sort({ _id: -1 })
      .limit(2000)
      .lean();

    for (const booking of bookings) {
      try {
        const event = await EventModel.findById(booking.eventId).lean();
        if (!event || event.status !== "published") continue;
        const startMs = new Date(event.date).getTime();
        if (!Number.isFinite(startMs)) continue;
        const delta = startMs - now;
        if (delta < win.minMs || delta > win.maxMs) continue;

        const already = await EventReminderModel.findOne({
          bookingId: booking._id,
          kind: win.kind,
        }).lean();
        if (already) continue;

        const email = booking.email;
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;

        const ics = buildEventIcs(
          {
            id: String(event._id),
            title: event.title,
            date: event.date,
            location: event.location,
            description: event.description,
            slug: (event as any).slug,
          },
          process.env.PUBLIC_APP_URL || "https://blackhevents.com",
        );

        await sendEventReminderEmail(
          { email, name: booking.name || "there" },
          {
            kind: win.kind,
            eventTitle: event.title,
            eventDate: new Date(event.date),
            eventLocation: event.location,
            ticketsUrl: `${appUrl()}/tickets`,
            bookingId: String(booking._id),
            icsBase64: Buffer.from(ics, "utf8").toString("base64"),
            branding: (event as any).branding || null,
          },
        );

        await EventReminderModel.create({
          bookingId: booking._id,
          kind: win.kind,
          sentAt: new Date(),
        });
        sent++;
        console.log(`[reminders] sent (${win.kind}) booking=${booking._id} event=${event.title}`);
      } catch (err: any) {
        skipped++;
        console.error("reminder sweep booking error:", err?.message);
      }
    }
  }

  return { sent, skipped };
}

export function startReminderScheduler() {
  if (running) return;
  running = true;
  // First pass after a short delay so server startup is never blocked.
  setTimeout(() => {
    runReminderSweepOnce().catch((e) => console.error("reminder sweep error:", e?.message));
  }, 45 * 1000);
  setInterval(() => {
    runReminderSweepOnce().catch((e) => console.error("reminder sweep error:", e?.message));
  }, RUN_INTERVAL_MS);
  console.log(`[reminders] scheduler on (every ${RUN_INTERVAL_MS / 60000} min)`);
}
