import type { Event } from "@shared/schema";

/**
 * One place that turns an event's raw tier JSON into the three things every
 * card needs: what it costs, how scarce it is, and who is hosting it.
 *
 * Before this module, `EventCard` and `EventCardCompact` each parsed
 * `ticketTypes` themselves and printed the first tier's raw remainder
 * ("620 General Palmwine Pass left") whether or not that tier was scarce and
 * whether or not the organizer had asked us to hide counts. Both now read
 * from here, so the two cards can never drift apart again.
 */

/** A tier as stored in `event.ticketTypes` (JSON string). */
interface TicketTier {
  name?: string;
  price?: number; // kobo
  capacity?: number;
  sold?: number;
  saleOpen?: boolean;
}

/** Fields the API attaches to event payloads beyond the stored schema. */
export type EventWithHost = Event & {
  organizerSlug?: string | null;
  organizerName?: string | null;
};

export function parseTiers(event: Event): TicketTier[] {
  try {
    const parsed = JSON.parse((event as any).ticketTypes || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 1500000 kobo -> "₦15,000" */
export function formatNaira(kobo: number): string {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

/** Tiers that are actually on sale right now. */
function openTiers(event: Event): TicketTier[] {
  return parseTiers(event).filter(
    (t) => t && t.saleOpen !== false && Number(t.capacity || 0) > 0,
  );
}

/** How many seats are left on a tier (never negative). */
function remainingOn(tier: TicketTier): number {
  return Math.max(0, Number(tier.capacity || 0) - Number(tier.sold || 0));
}

/**
 * The price line for a card.
 *
 * - "Sold out"      every open tier is gone
 * - "Free entry"    every open tier is free (or the event has no paid price)
 * - "From ₦15,000"  the open tiers cost different amounts
 * - "₦15,000"       one price across all open tiers
 *
 * Falls back to the legacy `event.price` when an event has no usable tiers,
 * so older events keep showing a real number instead of "Free".
 */
export function priceLabelFor(event: Event): string {
  const tiers = openTiers(event);

  if (tiers.length === 0) {
    return event.price > 0 ? formatNaira(event.price) : "Free entry";
  }

  if (tiers.every((t) => remainingOn(t) === 0)) return "Sold out";

  // Cheapest price you can actually buy today.
  const buyable = tiers
    .filter((t) => remainingOn(t) > 0)
    .map((t) => Number(t.price || 0));

  if (buyable.every((p) => p === 0)) return "Free entry";

  const cheapest = Math.min(...buyable);
  const distinct = new Set(buyable.filter((p) => p > 0));

  if (cheapest === 0) return "Free entry";
  return distinct.size > 1 ? "From " + formatNaira(cheapest) : formatNaira(cheapest);
}

/**
 * The cheapest price you can actually buy today, in kobo, or null when the
 * event is free (or carries no usable price at all). Used by the category
 * tiles to say "from ₦5,000" honestly across a whole category.
 */
export function cheapestPriceKobo(event: Event): number | null {
  const tiers = openTiers(event);
  const prices = tiers.length
    ? tiers.filter((t) => remainingOn(t) > 0).map((t) => Number(t.price || 0))
    : [Number(event.price || 0)];
  const paid = prices.filter((p) => p > 0);
  return paid.length ? Math.min(...paid) : null;
}

export interface Scarcity {
  label: string;
  /** hot = gold, warm = ink, calm = muted. Tone picks the pill skin. */
  tone: "hot" | "warm";
}

/**
 * Real scarcity, or nothing.
 *
 * Silence is the default: a card with 620 of 700 seats left says nothing,
 * because "620 left" is volume, not urgency. A badge appears only when the
 * event is genuinely filling up, and never when the organizer has turned
 * `showRemainingCounts` off. Sold-out is already said by the price line.
 */
export function scarcityFor(event: Event): Scarcity | null {
  if ((event as any).showRemainingCounts === false) return null;

  const tiers = openTiers(event);
  if (tiers.length === 0) return null;

  const capacity = tiers.reduce((sum, t) => sum + Number(t.capacity || 0), 0);
  const sold = tiers.reduce(
    (sum, t) => sum + Math.min(Number(t.sold || 0), Number(t.capacity || 0)),
    0,
  );
  if (capacity <= 0) return null;

  const remaining = capacity - sold;
  if (remaining <= 0) return null; // price line already says "Sold out"

  const pct = sold / capacity;

  // "Only 12 left" is the strongest thing a card can say, so it needs both
  // signals: a small absolute remainder AND a room that is genuinely filling.
  // Without the percentage test, a 50-seat event on 15 sales would announce
  // "Only 35 left" — true, but it is half empty and not scarce at all.
  if (remaining <= 40 && pct >= 0.5) return { label: `Only ${remaining} left`, tone: "hot" };
  if (pct >= 0.9) return { label: "Almost gone", tone: "hot" };
  if (pct >= 0.6) return { label: "Selling fast", tone: "warm" };
  return null;
}

/**
 * "142 going" — only when the organizer opted into attendee counts and enough
 * people have actually bought for the number to mean something.
 */
export function socialProofFor(event: Event): string | null {
  if ((event as any).showAttendeeCount !== true) return null;

  const tiers = openTiers(event);
  const sold = tiers.length
    ? tiers.reduce(
        (sum, t) => sum + Math.min(Number(t.sold || 0), Number(t.capacity || 0)),
        0,
      )
    : 0;

  if (sold < 10) return null;
  return `${sold.toLocaleString("en-NG")} going`;
}

/**
 * Who is hosting: their event-level branding wins, then the organizer's
 * display name, then their handle. Null when the API has not sent one.
 */
export function hostNameFor(event: Event): string | null {
  const branded = (event as any).branding?.displayName;
  if (branded) return String(branded);
  const named = (event as any).organizerName;
  return named ? String(named) : null;
}
