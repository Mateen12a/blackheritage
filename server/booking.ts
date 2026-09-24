import mongoose from "mongoose";
import { TicketModel, BookingModel, PromoCodeModel, PayoutModel, PlatformSettingModel, EventModel } from "./models";
import { generateTicketCode, buildTicketPdf } from "./tickets";
import { activeGateway } from "./payments";



// ── Fulfillment ──────────────────────────────────────────────────────────────
// One function owns the transition: mark the booking paid, mint single-use
// tickets, record commissions, and email the PDF. Called from the Paystack
// path, the dev simulation, and the manual-ticket route.

export interface FulfillmentResult {
  bookingId: string;
  tickets: { code: string; tierName: string; attendeeName: string; seat: number }[];
}

export async function fulfillBooking(bookingId: string): Promise<FulfillmentResult> {
  const booking = (await BookingModel.findById(bookingId).lean()) as any;
  if (!booking) throw new Error("Booking not found");

  // Idempotency: the webhook and the finalize route can both fire.
  if (booking.status === "paid") {
    const existing = await TicketModel.find({ bookingId: booking._id }).lean();
    if (existing.length > 0) {
      return {
        bookingId,
        tickets: existing.map((t: any) => ({
          code: t.code,
          tierName: t.tierName,
          attendeeName: t.attendeeName,
          seat: t.seat,
        })),
      };
    }
  }

  const event = await EventModel.findById(booking.eventId).lean();
  const eventTitle = (event as any)?.title || "Event";
  const tiers: any[] = JSON.parse((event as any)?.ticketTypes || "[]");

  // Mint one seat record per quantity
  const tickets: any[] = [];
  const qty = (booking as any).quantity || 1;
  for (let i = 0; i < qty; i++) {
    let code = generateTicketCode();
    // Codes are unique-indexed; retry on the astronomically unlikely collision
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const doc = await TicketModel.create({
          code,
          eventId: booking.eventId,
          bookingId: booking._id,
          seat: i + 1,
          tierName: (booking as any).ticketType || "General",
          attendeeName: (booking as any).name,
          attendeeEmail: (booking as any).email,
          amountPaid: Math.round(((booking as any).totalAmount || 0) / qty),
          status: "valid",
        });
        tickets.push(doc);
        break;
      } catch (err: any) {
        if (err?.code === 11000 && attempt < 4) {
          code = generateTicketCode();
          continue;
        }
        throw err;
      }
    }
  }

  // Commissions: platform fee on paid money; organizer-chosen promoter share.
  const settings = await PlatformSettingModel.findOne({ key: "platform" }).lean();
  const total = (booking as any).totalAmount || 0;
  if (total > 0) {
    const feeBps = settings?.ticketCommissionBps ?? 600;
    await PayoutModel.create({
      kind: "platform_fee",
      eventId: booking.eventId,
      organizerId: (event as any)?.organizerId || null,
      recipientName: "BlackHeritage",
      amount: Math.round((total * feeBps) / 10000),
      sourceBookingId: booking._id,
      status: "due",
      note: `${feeBps / 100}% platform commission`,
    });

    const promoterShareBps = (event as any)?.promoterCommissionBps || 0;
    const promoterName = (event as any)?.promoterName;
    if (promoterShareBps > 0 && promoterName) {
      await PayoutModel.create({
        kind: "promoter_commission",
        eventId: booking.eventId,
        organizerId: (event as any)?.organizerId || null,
        recipientName: promoterName,
        amount: Math.round((total * promoterShareBps) / 10000),
        sourceBookingId: booking._id,
        status: "due",
        note: `${promoterShareBps / 100}% promoter share chosen by the organizer`,
      });
    }
  }

  await BookingModel.findByIdAndUpdate(booking._id, {
    status: "paid",
    paidAt: new Date(),
  });

  // Branded confirmation email with the PDF attached. Never blocks the
  // response; failures are logged, not thrown.
  try {
    if (activeGateway() !== "simulated" || process.env.RESEND_API_KEY) {
      const { sendTicketEmail } = await import("./emails");
      const pdf = await buildTicketPdf(
        tickets.map((t: any) => ({
          code: t.code,
          tierName: t.tierName,
          attendeeName: t.attendeeName,
          seat: t.seat,
        })),
        {
          title: eventTitle,
          date: new Date((event as any).date),
          location: (event as any)?.location || "To be announced",
          branding: (event as any)?.branding || null,
        },
      );
      await sendTicketEmail(
        { name: (booking as any).name, email: (booking as any).email },
        {
          eventTitle,
          eventDate: new Date((event as any).date),
          eventLocation: (event as any)?.location || "To be announced",
          branding: (event as any)?.branding || null,
          tickets: tickets.map((t: any) => ({
            code: t.code,
            tierName: t.tierName,
            attendeeName: t.attendeeName,
            seat: t.seat,
          })),
          totalPaidKobo: total,
          bookingRef: (booking as any).paymentReference || String(booking._id ?? booking.id).slice(-8).toUpperCase(),
          pdfBase64: Buffer.from(pdf).toString("base64"),
        },
      );
    }
  } catch (emailErr) {
    console.error("Ticket email failed:", emailErr);
  }

  return {
    bookingId,
    tickets: tickets.map((t: any) => ({
      code: t.code,
      tierName: t.tierName,
      attendeeName: t.attendeeName,
      seat: t.seat,
    })),
  };
}

// ── Promo validation ─────────────────────────────────────────────────────────

export interface PromoResult {
  ok: boolean;
  message: string;
  discountKobo: number;
  promoId?: string;
}

export async function validatePromo(
  promoCode: string,
  event: any,
  subtotalKobo: number,
): Promise<PromoResult> {
  const code = promoCode.trim().toUpperCase();
  const promo = await PromoCodeModel.findOne({
    code,
    eventId: new mongoose.Types.ObjectId(String(event._id)),
  }).lean();

  if (!promo) return { ok: false, message: `Code ${code} is not valid for this event`, discountKobo: 0 };
  if (!promo.active) return { ok: false, message: `Code ${code} is no longer active`, discountKobo: 0 };
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) {
    return { ok: false, message: `Code ${code} expired on ${new Date(promo.expiresAt).toLocaleDateString("en-NG")}`, discountKobo: 0 };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, message: `Code ${code} has reached its usage limit`, discountKobo: 0 };
  }

  const discount =
    promo.kind === "percent"
      ? Math.round((subtotalKobo * promo.value) / 100)
      : Math.min(promo.value, subtotalKobo);

  return { ok: true, message: `Code ${code} applied`, discountKobo: discount, promoId: String(promo._id) };
}

// ── Quote: server-computed pricing ───────────────────────────────────────────

export interface BookingQuote {
  unitPriceKobo: number;
  quantity: number;
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  available: number;
  promoApplied: boolean;
  promoMessage: string;
  ticketType: string;
  promoId?: string;
}

export async function quoteBooking(input: {
  eventId: string;
  tierName: string;
  quantity: number;
  promoCode?: string;
}): Promise<{ ok: boolean; message?: string; quote?: BookingQuote }> {
  const event = await EventModel.findById(input.eventId).lean();
  if (!event) return { ok: false, message: "Event not found" };
  if ((event as any).status === "draft" || (event as any).status === "unpublished") {
    return { ok: false, message: "Ticket sales are closed for this event" };
  }

  const tiers: any[] = JSON.parse((event as any).ticketTypes || "[]");
  const tier = tiers.find((t) => t.name === input.tierName);
  if (!tier) return { ok: false, message: "Choose a ticket tier" };
  if (tier.saleClose && new Date(tier.saleClose).getTime() < Date.now()) {
    return { ok: false, message: `Sales for ${tier.name} closed on ${new Date(tier.saleClose).toLocaleDateString("en-NG")}` };
  }
  if (tier.saleOpen && new Date(tier.saleOpen).getTime() > Date.now()) {
    return { ok: false, message: `Sales for ${tier.name} open on ${new Date(tier.saleOpen).toLocaleDateString("en-NG")}` };
  }

  const available = Math.max(0, Number(tier.capacity || 0) - Number(tier.sold || 0));
  if (input.quantity > available) {
    return { ok: false, message: `Only ${available} ticket${available === 1 ? "" : "s"} left for ${tier.name}` };
  }

  const subtotal = Math.round(Number(tier.price) * input.quantity);
  let discount = 0;
  let promoApplied = false;
  let promoMessage = "";
  let promoId: string | undefined;

  if (input.promoCode && input.promoCode.trim()) {
    const promo = await validatePromo(input.promoCode, event, subtotal);
    if (!promo.ok) return { ok: false, message: promo.message };
    discount = promo.discountKobo;
    promoApplied = true;
    promoMessage = promo.message;
    promoId = promo.promoId;
  }

  return {
    ok: true,
    quote: {
      unitPriceKobo: Math.round(Number(tier.price)),
      quantity: input.quantity,
      subtotalKobo: subtotal,
      discountKobo: discount,
      totalKobo: subtotal - discount,
      available,
      promoApplied,
      promoMessage,
      ticketType: tier.name,
      promoId,
    },
  };
}

export async function getPlatformSettings() {
  let doc = await PlatformSettingModel.findOne({ key: "platform" }).lean();
  if (!doc) {
    doc = (await PlatformSettingModel.create({ key: "platform" })).toObject();
  }
  return doc;
}
