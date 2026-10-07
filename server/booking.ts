import mongoose from "mongoose";
import { TicketModel, BookingModel, PromoCodeModel, PayoutModel, PlatformSettingModel, EventModel } from "./models";
import { generateTicketCode, buildTicketPdf } from "./tickets";
import { activeGateway } from "./payments";
import { buildEventIcs } from "./calendar";



// ── Fulfillment ──────────────────────────────────────────────────────────────
// One function owns the transition: mark the booking paid, mint single-use
// tickets, record commissions, and email the PDF. Called from the Paystack
// path, the dev simulation, and the manual-ticket route.

export interface FulfillmentResult {
  bookingId: string;
  tickets: { code: string; tierName: string; attendeeName: string; seat: number }[];
}

export async function fulfillBooking(bookingId: string): Promise<FulfillmentResult> {
  // Move status from pending to paid with a single atomic findOneAndUpdate.
  // Only the winning call proceeds to mint tickets and create payouts.
  const booking = (await BookingModel.findOneAndUpdate(
    { _id: bookingId, status: "pending" },
    { $set: { status: "paid", paidAt: new Date() } },
    { new: true }
  ).lean()) as any;

  if (!booking) {
    const existing = (await BookingModel.findById(bookingId).lean()) as any;
    if (!existing) throw new Error("Booking not found");
    if (existing.status === "paid") {
      const existingTickets = await TicketModel.find({ bookingId: existing._id }).sort({ seat: 1 }).lean();
      return {
        bookingId,
        tickets: existingTickets.map((t: any) => ({
          code: t.code,
          tierName: t.tierName,
          attendeeName: t.attendeeName,
          seat: t.seat,
        })),
      };
    }
    throw new Error(`Booking cannot be fulfilled in status: ${existing.status}`);
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
  const organizerId = (event as any)?.organizerId;
  const feeBps = settings?.ticketCommissionBps ?? 600;
  let isFounderPerkApplied = false;
  let waivedForThisBooking = 0;
  let totalWaivedCount = 0;

  if (organizerId && total > 0) {
    try {
      const { User } = await import("./models");
      const organizer = await User.findById(organizerId);
      if (organizer && organizer.founderVoucher === "FOUNDER100") {
        const used = Number(organizer.waivedTicketCount || 0);
        if (used < 100) {
          const remainingWaiver = 100 - used;
          waivedForThisBooking = Math.min(qty, remainingWaiver);
          totalWaivedCount = used + waivedForThisBooking;
          await User.updateOne(
            { _id: organizer._id },
            { $inc: { waivedTicketCount: waivedForThisBooking } }
          );
          isFounderPerkApplied = true;
        }
      }
    } catch (voucherErr) {
      console.warn("[booking] Founder voucher check failed:", voucherErr);
    }
  }

  // Calculate platform fee with prorated waiver if partially covered
  let platformFeeKobo = 0;
  if (!isFounderPerkApplied || waivedForThisBooking < qty) {
    const chargeableQty = isFounderPerkApplied ? Math.max(0, qty - waivedForThisBooking) : qty;
    const chargeableRatio = qty > 0 ? chargeableQty / qty : 1;
    platformFeeKobo = Math.round(((total * chargeableRatio) * feeBps) / 10000);
  }

  const feeNote = isFounderPerkApplied
    ? waivedForThisBooking >= qty
      ? `0% platform fee · Founder Hundred perk (${totalWaivedCount}/100 tickets used)`
      : `${feeBps / 100}% platform fee on remaining ${qty - waivedForThisBooking} tickets · Founder Hundred (${totalWaivedCount}/100 tickets used)`
    : `${feeBps / 100}% platform commission`;

  await PayoutModel.create({
    kind: "platform_fee",
    eventId: booking.eventId,
    organizerId: (event as any)?.organizerId || null,
    recipientName: "BlackHeritage",
    amount: platformFeeKobo,
    sourceBookingId: booking._id,
    status: "due",
    note: feeNote,
  }).catch(() => {});

    const promoterShareBps = (event as any)?.promoterCommissionBps || 0;
    const promoterName = (event as any)?.promoterName;
    let promoterCommissionKobo = 0;
    if (promoterShareBps > 0 && promoterName) {
      promoterCommissionKobo = Math.round((total * promoterShareBps) / 10000);
      await PayoutModel.create({
        kind: "promoter_commission",
        eventId: booking.eventId,
        organizerId: (event as any)?.organizerId || null,
        recipientName: promoterName,
        amount: promoterCommissionKobo,
        sourceBookingId: booking._id,
        status: "due",
        note: `${promoterShareBps / 100}% promoter share chosen by the organizer`,
      }).catch(() => {});
    }

    // Organizer net share tracking with verification protection
    const orgNetKobo = Math.max(0, total - platformFeeKobo - promoterCommissionKobo);
    if (orgNetKobo > 0 && organizerId) {
      try {
        const { User } = await import("./models");
        const organizer = await User.findById(organizerId).lean();
        const orgName = (organizer as any)?.displayName || (organizer as any)?.username || (event as any)?.organizerName || "Organizer";
        const isVerified = Boolean((organizer as any)?.isVerified);
        const hasSubaccount = Boolean((organizer as any)?.bankDetails?.subaccountCode);
        const wasAutoSplit = Boolean((booking as any)?.subaccountSplit);
        const gateway = (booking as any)?.paymentGateway;
        const isAutoSplitSettled = isVerified && wasAutoSplit && gateway === "paystack";

        await PayoutModel.create({
          kind: "organizer_payout",
          eventId: booking.eventId,
          organizerId: String(organizerId),
          recipientName: orgName,
          recipientId: (organizer as any)?.bankDetails?.recipientCode || null,
          amount: orgNetKobo,
          sourceBookingId: booking._id,
          status: isAutoSplitSettled ? "settled" : isVerified ? "due" : "pending_verification",
          note: isAutoSplitSettled
            ? "Automatic split settlement via Paystack subaccount"
            : !isVerified
              ? "Pending verification: identity verification required before payout disbursement"
              : !hasSubaccount
                ? "Pending bank setup: link settlement bank account in Settings"
                : "Settlement due for payout transfer",
        }).catch((err: any) => {
          console.warn("Organizer payout note:", err?.message);
        });
      } catch (orgErr: any) {
        console.warn("Organizer lookup for payout notice:", orgErr?.message);
      }
    }

  // (Status and paidAt atomically set on winner above)

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
          icsBase64: Buffer.from(
            buildEventIcs(
              {
                id: String((event as any)._id ?? (event as any).id),
                title: eventTitle,
                date: (event as any).date,
                location: (event as any)?.location || "To be announced",
                description: (event as any)?.description || "",
                slug: (event as any)?.slug,
              },
              process.env.PUBLIC_APP_URL || "https://blackhevents.com",
            ),
            "utf8",
          ).toString("base64"),
        },
      );
    }
  } catch (emailErr) {
    console.error("Ticket email failed:", emailErr);
  }

  // Tell the organizer money moved on their event. Never blocks fulfillment.
  try {
    if (organizerId) {
      const { User } = await import("./models");
      const organizer = await User.findById(organizerId).lean();
      if (organizer?.email) {
        const { sendOrganizerSaleEmail } = await import("./emails");
        await sendOrganizerSaleEmail(
          { name: (organizer as any).name || (organizer as any).username || "Organizer", email: organizer.email },
          {
            eventTitle,
            eventDate: new Date((event as any).date),
            buyerName: (booking as any).name || "Guest",
            buyerEmail: (booking as any).email || "",
            tierName: (booking as any).ticketType || "General",
            quantity: qty,
            totalKobo: total,
            bookingRef: (booking as any).paymentReference || String(booking._id).slice(-8).toUpperCase(),
            branding: (event as any)?.branding || null,
          },
        );
      }
    }
  } catch (notifyErr) {
    console.error("Organizer sale notification failed:", notifyErr);
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
  // A past-dated event is over, whatever its publish status says. No charging
  // cards for a show that already happened.
  if ((event as any).date && new Date((event as any).date).getTime() < Date.now() - 6 * 60 * 60 * 1000) {
    return { ok: false, message: "This event has ended. Tickets are no longer on sale." };
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

// ── Gate sales ───────────────────────────────────────────────────────────
// A ticket sold at the door for cash, POS, or transfer is a real sale: it
// holds seats against the tier exactly like online checkout, becomes a paid
// booking in the ledger (paymentGateway "manual" marks it offline money), and
// mints scannable tickets via the same fulfillment engine. Comps stay on the
// complimentary route; this one is for money that changed hands.
export interface GateSaleInput {
  eventId: string;
  issuedById: string;
  tierName: string;
  quantity: number;
  unitPriceKobo: number;
  method: "cash" | "pos" | "transfer" | "free";
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

const GATE_METHOD_LABEL: Record<GateSaleInput["method"], string> = {
  cash: "Cash",
  pos: "POS",
  transfer: "Bank transfer",
  free: "Free",
};

export async function createGateSale(input: GateSaleInput): Promise<{ ok: boolean; message?: string; booking?: any; tickets?: any[] }> {
  const event = await EventModel.findById(input.eventId).lean();
  if (!event) return { ok: false, message: "Event not found" };

  const tiers: any[] = JSON.parse((event as any).ticketTypes || "[]");
  const tier = tiers.find((t) => t.name === input.tierName);
  if (!tier) return { ok: false, message: "Choose a ticket tier" };

  // Same seat math as quoteBooking: the door competes with online buyers for
  // the same capacity, so a gate sale must never overshoot it.
  const available = Math.max(0, Number(tier.capacity || 0) - Number(tier.sold || 0));
  if (input.quantity > available) {
    return { ok: false, message: `Only ${available} ticket${available === 1 ? "" : "s"} left for ${tier.name}` };
  }

  const isFree = input.method === "free" || input.unitPriceKobo <= 0;
  const totalKobo = isFree ? 0 : Math.round(input.unitPriceKobo) * input.quantity;

  // Hold the seats, mirroring the initiate route (tier.sold, event capacity).
  const fresh = await EventModel.findById(input.eventId).lean();
  if (!fresh) return { ok: false, message: "Event not found" };
  const freshTiers = JSON.parse((fresh as any).ticketTypes || "[]");
  const freshTier = freshTiers.find((t: any) => t.name === input.tierName);
  if (!freshTier || Number(freshTier.sold || 0) + input.quantity > Number(freshTier.capacity || 0)) {
    return { ok: false, message: `Only ${freshTier ? Number(freshTier.capacity || 0) - Number(freshTier.sold || 0) : 0} left in ${input.tierName}. Someone was faster.` };
  }
  freshTier.sold = Number(freshTier.sold || 0) + input.quantity;
  await EventModel.updateOne(
    { _id: fresh._id },
    {
      $set: {
        ticketTypes: JSON.stringify(freshTiers),
        capacity: Math.max(0, Number((fresh as any).capacity || 0) - input.quantity),
      },
    },
  );

  try {
    const reference = `GATE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const booking = await BookingModel.create({
      // Walk-in sales often have no email. The placeholder used to be a
      // plausible-looking address (gate@blackhevents.com) that silently
      // swallowed the CSV and any later receipt. This one is unmistakably
      // synthetic, so the attendee list stays honest and nothing real is
      // ever mailed by accident.
      email: input.buyerEmail || "walk-in+no-email@blackhevents.com",
      name: input.buyerName,
      eventId: new mongoose.Types.ObjectId(input.eventId),
      ticketType: input.tierName,
      quantity: input.quantity,
      totalAmount: totalKobo,
      status: "pending",
      paymentIntentId: null,
      paymentReference: reference,
      paymentGateway: "manual",
      gatewayTxnId: `gate:${input.method}`,
      phone: input.buyerPhone || null,
      isVerified: false,
      remindersDisabled: true, // they bought at the door; no pre-event drips
    });

    const fulfillment = await fulfillBooking(String(booking._id));
    return { ok: true, booking, tickets: fulfillment.tickets };
  } catch (err: any) {
    // Roll back the seat hold so a failed sale never leaks capacity.
    try {
      const rollback = await EventModel.findById(input.eventId).lean();
      if (rollback) {
        const rollbackTiers = JSON.parse((rollback as any).ticketTypes || "[]");
        const rollbackTier = rollbackTiers.find((t: any) => t.name === input.tierName);
        if (rollbackTier) {
          rollbackTier.sold = Math.max(0, Number(rollbackTier.sold || 0) - input.quantity);
          await EventModel.updateOne(
            { _id: rollback._id },
            {
              $set: {
                ticketTypes: JSON.stringify(rollbackTiers),
                capacity: Number((rollback as any).capacity || 0) + input.quantity,
              },
            },
          );
        }
      }
    } catch {
      // Best effort; the booking never landed, so the count is off by at most
      // one sale and the organizer can edit the tier.
    }
    console.error("Gate sale failed:", err);
    return { ok: false, message: "Could not record that sale. The seats were released; try again." };
  }
}
