/**
 * Meta Pixel (Black Heritage dataset). Tells Meta which ad clicks turned into
 * event views, checkouts, paid tickets and challenge entries, so campaigns can
 * optimise for bookings instead of video views.
 *
 * Loads only on the live domain: local dev and previews never send events, so
 * test bookings don't train the ads. Every call is a no-op when the pixel is
 * blocked (ad blockers, no network). It never receives names, emails or phone
 * numbers; only page URLs, event ids and naira amounts.
 */
const PIXEL_ID = "1856403795791782";
const LIVE_HOSTS = ["blackhevents.com", "www.blackhevents.com"];

type Fbq = ((...args: unknown[]) => void) & { callMethod?: Function; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let started = false;

function enabled(): boolean {
  return typeof window !== "undefined" && LIVE_HOSTS.includes(window.location.hostname);
}

/** Meta's base snippet, as code. Safe to call more than once. */
export function initPixel(): void {
  if (started || !enabled()) return;
  started = true;
  if (!window.fbq) {
    const n: any = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    window._fbq = window._fbq || n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  window.fbq!("init", PIXEL_ID);
}

let lastPath = "";
/** One PageView per real navigation (the SPA never reloads). */
export function trackPageView(path: string): void {
  if (!enabled() || path === lastPath) return;
  lastPath = path;
  window.fbq?.("track", "PageView");
}

type Params = Record<string, unknown>;

function track(name: string, params?: Params, eventId?: string): void {
  if (!enabled() || !window.fbq) return;
  try {
    if (eventId) window.fbq("track", name, params || {}, { eventID: eventId });
    else window.fbq("track", name, params || {});
  } catch {
    /* never let analytics break a booking */
  }
}

const naira = (kobo: number | undefined | null) => Math.round(Number(kobo || 0)) / 100;

export const pixel = {
  /** An event page opened. */
  viewEvent(event: { id?: unknown; title?: string }) {
    track("ViewContent", { content_ids: [String(event.id ?? "")], content_name: event.title, content_type: "product" });
  },
  /** "Book" tapped with a tier chosen: the buyer is heading to pay. */
  startCheckout(event: { id?: unknown; title?: string }, totalKobo: number | undefined, quantity: number) {
    track("InitiateCheckout", {
      content_ids: [String(event.id ?? "")],
      content_name: event.title,
      num_items: quantity,
      value: naira(totalKobo),
      currency: "NGN",
    });
  },
  /** Tickets issued. bookingId de-duplicates a refresh or a second confirm. */
  purchase(event: { id?: unknown; title?: string }, bookingId: string | undefined, totalKobo: number | undefined, quantity: number) {
    track(
      "Purchase",
      {
        content_ids: [String(event.id ?? "")],
        content_name: event.title,
        num_items: quantity,
        value: naira(totalKobo),
        currency: "NGN",
      },
      bookingId ? `purchase-${bookingId}` : undefined,
    );
  },
  /** BH Challenge video sent. Free, so it's a Lead, not a Purchase. */
  challengeEntry(category: string) {
    track("Lead", { content_name: "BH Challenge", content_category: category });
  },
};
