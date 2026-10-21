import { useEvent } from "@/hooks/use-events";
import { BookingModal } from "@/components/BookingModal";
import { ShareFlyerModal } from "@/components/ShareFlyerModal";
import { FlyerLightbox } from "@/components/FlyerLightbox";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { Loader2, Calendar, MapPin, Users, Share2, ArrowLeft, Tag, Clock, MessageCircle, Copy } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { BusinessModal, PARTNER_COPY, partnerSettingsOf } from "@/components/BusinessModal";
import { Reveal, FadeImg } from "@/components/motion";
import { PastEventProof } from "@/components/PastEventProof";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { BookingReturnHandler } from "@/components/BookingReturnHandler";
import { getTemplate, accentOverrides, templateFor } from "@shared/themes";
import { useEventPulse } from "@/hooks/use-pulse";
import { useCountdown } from "@/hooks/use-countdown";

interface PublicPromo {
  code: string;
  kind: "percent" | "fixed";
  value: number;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

const EVENT_TYPE_LABELS: Record<string, string> = {
  concert: "Concert",
  party: "Party",
  house_party: "House Party",
  wedding: "Wedding",
  birthday: "Birthday",
  corporate: "Corporate Event",
  festival: "Festival",
  brunch: "Brunch",
  private_gathering: "Private Gathering",
  conference: "Conference",
  comedy_show: "Comedy Show",
  art_exhibition: "Art Exhibition",
  other: "Event",
};

/**
 * Page palette: the theme preset's tokens, then the organizer's accent
 * color layered on top (recolors buttons, links, icons, and soft badges
 * while keeping contrast safe per theme). No preset and no accent means
 * the platform default shows.
 */
function useEventThemeVars(event: any): React.CSSProperties {
  return {
    ...(getTemplate(event?.theme)?.vars || {}),
    ...accentOverrides(event?.theme, event?.branding?.accentHex),
  } as React.CSSProperties;
}

const REFUND_COPY: Record<string, string> = {
  none: "No refunds",
  "7_days": "Refunds up to 7 days before the event",
  contact: "Contact the organizer about refunds",
};

export default function EventDetails() {
  const [, params] = useRoute("/events/:id");
  const [, slugParams] = useRoute("/e/:slug");
  const id = params?.id || slugParams?.slug;
  // Deep-link detection: no internal navigation history means the guest
  // arrived straight from a shared link. The back affordance then points at
  // the events directory (browsing context), and the page keeps the focus on
  // the event itself rather than assuming an in-app journey.
  const cameFromApp = typeof window !== "undefined" && window.history.length > 1 && document.referrer.includes(window.location.host);
  const { data: event, isLoading } = useEvent(id as any);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
  const [isFlyerZoomOpen, setIsFlyerZoomOpen] = useState(false);
  const [publicPromos, setPublicPromos] = useState<PublicPromo[]>([]);
  const { toast } = useToast();

  // Hooks stay above every early return so the hook order never changes
  // between a loading render and a loaded one.
  const showAttendeeCountEarly = (event as any)?.showAttendeeCount === true;
  const pulse = useEventPulse(event ? String((event as any).id) : undefined, showAttendeeCountEarly);
  const earlyTiers: any[] = event ? parseTiersSafe((event as any).ticketTypes) : [];
  const earlyClose = earlyTiers
    .map((t: any) => (t.saleClose ? new Date(t.saleClose).getTime() : 0))
    .filter((ms) => ms > Date.now())
    .sort((a: number, b: number) => a - b)[0] ?? null;
  const countdown = useCountdown(earlyClose);
  // The show is over: date passed more than six hours ago matches the
  // server's sales cutoff, so the page and the checkout agree.
  const eventEnded = !!event?.date && new Date(event.date).getTime() < Date.now() - 6 * 60 * 60 * 1000;

  // Public promo codes: fetched only when the organizer advertises them.
  // Keyed on the resolved event id, not the route param: on /e/:slug the
  // param is a slug and the API needs the real id.
  useEffect(() => {
    const eventId = (event as any)?.id;
    if (!eventId) return;
    let alive = true;
    fetch(`/api/events/${eventId}/public-promos`)
      .then((r) => (r.ok ? r.json() : []))
      .then((codes) => { if (alive) setPublicPromos(Array.isArray(codes) ? codes : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [(event as any)?.id]);

  // Old /events/<id> links keep working, but the address bar settles on the
  // pretty /e/<slug> link: Copy link, WhatsApp and Share all read the URL, so
  // whatever a guest shares from here is the clean one.
  useEffect(() => {
    const slug = (event as any)?.slug;
    if (!slug || !params?.id) return;
    window.history.replaceState(window.history.state, "", `/e/${slug}${window.location.search}${window.location.hash}`);
  }, [(event as any)?.slug, params?.id]);

  // Partner card: only when the organizer switched it on, chose who they want,
  // and the closing date (if any) has not passed.
  const partner = event ? partnerSettingsOf(event as any) : null;
  const partnerOpen = Boolean(
    event && (event as any).businessApplicationsEnabled === true && partner && partner.types.length > 0 &&
    (!partner.closesAt || new Date(partner.closesAt).getTime() > Date.now()),
  );

  const heroAccent = /^#[0-9a-fA-F]{6}$/.test((event as any)?.branding?.accentHex || "")
    ? (event as any).branding.accentHex
    : "#E3B23C";

  const handleShare = () => {
    if (!event) return;
    setIsFlyerModalOpen(true);
  };

  // ── Invite-only gate state ──
  const [accessInput, setAccessInput] = useState("");
  const [accessError, setAccessError] = useState(false);
  const requiresCode = (event as any)?.__requiresCode === true;
  const [, slugRouteParams] = useRoute("/e/:slug");
  const routeKey = params?.id || slugRouteParams?.slug || "";

  const submitAccessCode = async () => {
    const code = accessInput.trim().toUpperCase();
    if (!code || !routeKey) return;
    try {
      const res = await fetch(`/api/events/${routeKey}/access?code=${encodeURIComponent(code)}`, {
        credentials: "include",
      });
      if (res.ok) {
        sessionStorage.setItem(`bh-access-${routeKey}`, code);
        setAccessError(false);
        window.location.reload();
      } else {
        setAccessError(true);
      }
    } catch {
      setAccessError(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
        <p className="eyebrow">Off the guest list</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">
          Event not found
        </h1>
        <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-ink max-w-sm">
          It may have been taken down. The rest of Lagos is still on sale.
        </p>
        <Link href="/events" className="mt-6">
          <Button variant="outline" className="border-hairline text-ink hover:text-gold rounded-md">
            Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  // ── Private event gate: minimal, branded, no event details leak ──
  if (requiresCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="eyebrow">Private event</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink tracking-tight">
            {(event as any).title || "This is a private event"}
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-gold mx-auto" aria-hidden="true" />
          <p className="mt-5 text-sm text-muted-ink">
            This is a private event. Enter the access code to continue.
          </p>
          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitAccessCode();
            }}
          >
            <Input
              value={accessInput}
              onChange={(e) => {
                setAccessInput(e.target.value.toUpperCase());
                setAccessError(false);
              }}
              placeholder="Access code"
              className="h-12 bg-surface-2 border-hairline text-ink text-center font-mono tracking-widest uppercase rounded-md focus-visible:border-gold"
              autoFocus
              maxLength={8}
            />
            <Button
              type="submit"
              className="press h-12 px-6 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md"
            >
              Enter
            </Button>
          </form>
          {accessError && (
            <p className="mt-3 text-xs text-red-400">That code is not right. Check your invite and try again.</p>
          )}
        </div>
      </div>
    );
  }

  const ticketTypes = (() => {
    try {
      const parsed = JSON.parse(event.ticketTypes || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const price =
    event.price > 0 ? "₦" + (event.price / 100).toLocaleString() : "Free";
  const showCounts = (event as any).showRemainingCounts !== false;
  const showAttendeeCount = (event as any).showAttendeeCount === true;
  const waitlistEnabled = (event as any).waitlistEnabled === true;
  const themeVars = useEventThemeVars(event);
  // The chosen TEMPLATE decides structure and motion; the organizer's brand
  // color decides the hue. No template set = the classic poster layout.
  const template = templateFor((event as any).theme);
  const isBillboard = template.layout === "billboard";
  const isEditorial = template.layout === "editorial";
  const motionVariant = template.motion;
  const brand = (event as any).branding || null;
  const soldOut =
    ticketTypes.length > 0 &&
    ticketTypes.every((t: any) => Math.max(0, Number(t.capacity || 0) - Number(t.sold || 0)) <= 0);

  // `pulse` and `countdown` are computed above the early returns; the
  // organizer's showAttendeeCount flag decides whether any of it renders.

  return (
    <div
      className="min-h-screen bg-background pb-32 lg:pb-24"
      style={themeVars}
    >
      {/* Event-branded navbar when the organizer set a name/logo; the
          platform default renders elsewhere. Brand links still go home. */}
      <Navbar eventBrand={brand} overMedia />

      {/* Flyer hero. Height follows the TEMPLATE: billboard goes full-bleed
          and tall (the ticket card docks on it), editorial ducks low so the
          story leads, poster keeps the classic 52vh banner. */}
      <div className="relative w-full overflow-hidden lg:hidden pt-[4.5rem] md:pt-24 pb-6">
        {/* The flyer is the hero object, shown whole and sized by width: on a
            phone the poster IS the ad, so it takes most of the screen instead
            of shrinking to fit a fixed-height band. A blurred copy and the
            event's own accent light the stage behind it. */}
        <img
          src={event.imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-30"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-background/70" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: `radial-gradient(60% 50% at 50% 45%, ${heroAccent}38 0%, transparent 70%)` }}
        />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

        {/* Back and share sit above the flyer, not over its edges */}
        <div className="relative z-20 flex items-center justify-between px-3 sm:px-4">
          {cameFromApp ? (
            <Button
              variant="outline"
              size="icon"
              aria-label="Go back"
              onClick={() => window.history.back()}
              className="press rounded-full bg-background/80 backdrop-blur-md border-hairline text-ink hover:bg-surface hover:text-gold transition-colors w-9 h-9 sm:w-10 sm:h-10"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          ) : (
            <Link href="/events">
              <Button
                variant="outline"
                size="icon"
                aria-label="Browse all events"
                className="press rounded-full bg-background/80 backdrop-blur-md border-hairline text-ink hover:bg-surface hover:text-gold transition-colors w-9 h-9 sm:w-10 sm:h-10"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Share this event"
            onClick={handleShare}
            className="press rounded-full bg-background/80 backdrop-blur-md border-hairline text-ink hover:bg-surface hover:text-gold transition-colors w-9 h-9 sm:w-10 sm:h-10"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>

        <div className="relative z-10 mt-3 flex justify-center px-4">
          {/* Tap to read the flyer full size: it carries details (teams,
              dress code, line-up) the page does not repeat. */}
          <button
            type="button"
            onClick={() => setIsFlyerZoomOpen(true)}
            aria-label="View the flyer full size"
            className="w-[82vw] max-w-[440px] cursor-zoom-in rounded-md focus-visible:outline-2 focus-visible:outline-gold"
          >
            <FadeImg
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-auto max-h-[78vh] object-contain rounded-md ring-1 ring-white/10"
              style={{ boxShadow: `0 30px 90px -20px ${heroAccent}66, 0 20px 60px rgba(0,0,0,0.6)` }}
            />
          </button>
        </div>
      </div>

      {/* Wide screens: the same lit stage, behind the whole top of the page */}
      <div aria-hidden="true" className="hidden lg:block absolute inset-x-0 top-0 h-[820px] overflow-hidden pointer-events-none">
        <img src={event.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-25" />
        <div className="absolute inset-0 bg-background/75" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(40% 55% at 22% 38%, ${heroAccent}33 0%, transparent 70%)` }} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-3.5 sm:px-4 mt-1 lg:mt-0 lg:pt-28 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-8 xl:gap-10">
          {/* Wide screens: the flyer gets its own column, big whatever the
              window height, and stays in view while the details scroll. */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28">
              <button
                type="button"
                onClick={() => setIsFlyerZoomOpen(true)}
                aria-label="View the flyer full size"
                className="block w-full cursor-zoom-in rounded-md focus-visible:outline-2 focus-visible:outline-gold"
              >
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full max-h-[calc(100vh-9rem)] object-contain rounded-md ring-1 ring-white/10"
                  style={{ boxShadow: `0 30px 90px -20px ${heroAccent}66, 0 20px 60px rgba(0,0,0,0.6)` }}
                />
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-ink">Click the flyer to view it full size</p>
            </div>
          </div>

          {/* Main column: editorial, no card box */}
          <div className="lg:col-span-5">
            <Reveal variant={motionVariant}>
              <p className="eyebrow text-gold">
                {(event as any).eventTypeLabel || EVENT_TYPE_LABELS[(event as any).eventType] || "Upcoming event"}
              </p>
              <h1 className="mt-2 font-display text-2xl min-[360px]:text-3xl md:text-5xl lg:text-4xl xl:text-5xl font-bold text-ink leading-[1.15] tracking-tight">
                {event.title}
              </h1>
              <div className="mt-3 sm:mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-ink">
                {format(new Date(event.date), "EEEE, d MMMM yyyy")} ·{" "}
                {format(new Date(event.date), "h:mm a")} · {event.location}
              </p>
              {brand?.displayName && (
                <div className="mt-3">
                  <Link
                    href={`/o/${(event as any).organizerSlug || brand.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-ink hover:text-gold transition-colors group"
                  >
                    {brand.logoUrl && (
                      <img src={brand.logoUrl} alt="" className="w-5 h-5 sm:w-6 sm:h-6 rounded-md object-cover ring-1 ring-white/10" />
                    )}
                    <span>
                      Presented by <span className="text-ink font-medium group-hover:text-gold underline-offset-4 group-hover:underline">{brand.displayName}</span>
                    </span>
                  </Link>
                </div>
              )}
              {showAttendeeCount && pulse.data && pulse.data.going > 0 && (
                <p className="mt-3 sm:mt-4 flex items-center gap-2 text-xs sm:text-sm text-muted-ink">
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-60"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-gold"></span>
                  </span>
                  <span>
                    <span className="text-ink font-medium">{pulse.data.going} going</span>
                    {pulse.data.soldToday > 0 && (
                      <span className="text-muted-ink"> &middot; {pulse.data.soldToday} in the last day</span>
                    )}
                  </span>
                </p>
              )}

              {/* Share row: WhatsApp is how Nigerian events travel. */}
              <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const text = `${event.title}\n${format(new Date(event.date), "EEE d MMM, h:mm a")}\n${event.location}\n\nGet tickets: ${window.location.href}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
                  }}
                  className="press inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-hairline bg-surface-2 text-xs sm:text-sm text-ink hover:border-gold/40 hover:text-gold transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" aria-hidden="true" />
                  WhatsApp
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      toast({ title: "Link copied", description: "Paste it anywhere." });
                    } catch {
                      toast({ variant: "destructive", title: "Copy failed", description: window.location.href });
                    }
                  }}
                  className="press inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-hairline bg-surface-2 text-xs sm:text-sm text-ink hover:border-gold/40 hover:text-gold transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                  Copy link
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    onClick={async () => {
                      try {
                        await (navigator as any).share({
                          title: event.title,
                          text: `${event.title} · ${format(new Date(event.date), "EEE d MMM")}`,
                          url: window.location.href,
                        });
                      } catch {
                        // User cancelled or share failed; the two buttons above still cover it.
                      }
                    }}
                    className="press inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-hairline bg-surface-2 text-xs sm:text-sm text-ink hover:border-gold/40 hover:text-gold transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                    Share
                  </button>
                )}
              </div>
              {showAttendeeCount && pulse.data?.recent?.[0] && (
                <p className="mt-1.5 text-xs sm:text-sm text-muted-ink">
                  {pulse.data.recent[0].name} booked {pulse.data.recent[0].ago}
                </p>
              )}
            </Reveal>

            {/* The details: one hairline-separated list, gold icons */}
            <Reveal className="mt-10" variant={motionVariant}>
              <dl className="border-t border-hairline">
                <div className="flex items-start gap-4 py-5 border-b border-hairline">
                  <Calendar className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="eyebrow">Date &amp; time</dt>
                    <dd className="mt-1.5 text-ink">
                      {format(new Date(event.date), "EEEE, d MMMM yyyy")}
                    </dd>
                    <dd className="text-sm text-muted-ink">
                      Doors open {format(new Date(event.date), "h:mm a")}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-4 py-5 border-b border-hairline">
                  <MapPin className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <dt className="eyebrow">Location</dt>
                    <dd className="mt-1.5 text-ink">{event.location}</dd>
                    <dd className="mt-1.5">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location || "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-gold hover:underline underline-offset-4"
                      >
                        Get directions
                      </a>
                    </dd>
                  </div>
                </div>

                {showCounts && (
                  <div className="flex items-start gap-4 py-5 border-b border-hairline">
                    <Users className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <dt className="eyebrow">Availability</dt>
                      <dd className="mt-2">
                        {ticketTypes.length === 0 ? (
                          <span className="text-ink text-sm">
                            {event.capacity} regular tickets remaining
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {ticketTypes.map((type: any) => {
                              const remaining = Math.max(0, type.capacity - (type.sold || 0));
                              return (
                                <span
                                  key={type.name}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-hairline text-xs"
                                >
                                  <span className="text-gold font-bold">{remaining}</span>
                                  <span className="text-muted-ink">{type.name} left</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </Reveal>

            {/* Public promo codes, only when the organizer advertises them */}
            {publicPromos.length > 0 && (
              <Reveal className="mt-6" variant={motionVariant}>
                <div className="rounded-md border border-gold/25 bg-gold/[0.06] p-4">
                  <p className="eyebrow text-gold flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5" aria-hidden="true" /> Current offers
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {publicPromos.map((p) => (
                      <span
                        key={p.code}
                        className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-background/60 px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono font-bold text-ink">{p.code}</span>
                        <span className="text-muted-ink">
                          {p.kind === "percent" ? `${p.value}% off` : `${naira(p.value)} off`}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-ink">Apply the code at checkout.</p>
                </div>
              </Reveal>
            )}

            {/* About: plain editorial text */}
            <Reveal className="mt-8" variant={motionVariant}>
              <p className="eyebrow">About this event</p>
              <p className="mt-3 text-sm sm:text-[15px] text-muted-ink leading-relaxed whitespace-pre-line max-w-2xl">
                {event.description}
              </p>
            </Reveal>

            {/* Good to know: only what the organizer filled in, plus how entry works */}
            <Reveal className="mt-8" variant={motionVariant}>
              <p className="eyebrow">Good to know</p>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-md overflow-hidden border border-hairline bg-hairline">
                {[
                  (event as any).ageLimit && ["Age", (event as any).ageLimit === "All ages" ? "All ages welcome" : `${(event as any).ageLimit} only. Bring ID.`],
                  ["Starts", format(new Date(event.date), "EEE d MMM, h:mm a")],
                  (event as any).endsText && ["Ends", (event as any).endsText],
                  (event as any).dressCode && ["Dress code", (event as any).dressCode],
                  (event as any).refundPolicy && ["Refunds", REFUND_COPY[(event as any).refundPolicy] || "Contact the organizer"],
                  ["Entry", "E-ticket with QR code, scanned at the gate. Arrives by email the moment you pay."],
                ].filter(Boolean).map((row: any) => (
                  <div key={row[0]} className="bg-surface px-4 py-3">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-ink">{row[0]}</dt>
                    <dd className="mt-1 text-sm text-ink">{row[1]}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            {/* Organizer: who is behind the night, one tap to their page */}
            {brand?.displayName && (
              <Reveal className="mt-8" variant={motionVariant}>
                <p className="eyebrow">Organizer</p>
                <Link
                  href={`/o/${(event as any).organizerSlug || brand.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
                  className="mt-3 flex items-center gap-4 rounded-md border border-hairline bg-surface p-4 hover:border-gold/40 transition-colors group"
                >
                  {brand.logoUrl ? (
                    <img src={brand.logoUrl} alt="" className="w-12 h-12 rounded-md object-cover ring-1 ring-white/10 shrink-0" />
                  ) : (
                    <span className="w-12 h-12 rounded-md border border-gold/50 flex items-center justify-center font-display text-gold shrink-0">
                      {brand.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-bold text-ink truncate group-hover:text-gold">{brand.displayName}</span>
                    <span className="block text-xs text-muted-ink">See their page and upcoming events</span>
                  </span>
                  <ArrowLeft className="w-4 h-4 text-muted-ink rotate-180 shrink-0" aria-hidden="true" />
                </Link>
              </Reveal>
            )}

            <PastEventProof event={event} />
          </div>

          {/* Sidebar: the primary action surface on the page. */}
          <aside className="lg:col-span-3 mt-8 lg:mt-0">
            <div className={cn("space-y-4", !isBillboard && "sticky top-28")}>
              <div className="bg-surface border border-hairline rounded-md p-5 sm:p-7">
                <p className="eyebrow">Tickets from</p>
                <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                  <span className="font-display text-3xl sm:text-4xl font-bold text-ink">
                    {price}
                  </span>
                  {event.price > 0 && (
                    <span className="text-xs sm:text-sm text-muted-ink">/ person</span>
                  )}
                </div>

                {!countdown.expired && countdown.short && (
                  <div className="mt-3 sm:mt-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.07] px-3 py-1.5 text-xs text-gold">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    Sales close in {countdown.short}
                  </div>
                )}
                {showAttendeeCount && pulse.data && pulse.data.going > 0 && (
                  <p className="mt-3 text-xs sm:text-sm text-muted-ink">
                    <span className="text-ink font-medium">{pulse.data.going}</span> going
                  </p>
                )}

                {eventEnded ? (
                  <div className="mt-5 sm:mt-6 rounded-md border border-hairline bg-surface-2/60 px-4 py-3 text-center text-xs sm:text-sm text-muted-ink">
                    This event has ended. Thanks to everyone who came out.
                  </div>
                ) : (
                  <Button
                    onClick={() => setIsBookingOpen(true)}
                    className="press mt-5 sm:mt-6 w-full h-11 sm:h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md text-sm"
                  >
                    Get tickets
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => setIsFlyerModalOpen(true)}
                  className="press mt-2.5 w-full h-10 sm:h-11 border-hairline text-ink hover:text-gold hover:border-gold/40 font-medium rounded-md flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Share2 className="w-4 h-4 text-gold" />
                  Share Event
                </Button>

                {waitlistEnabled && soldOut && (
                  <WaitlistInline eventId={String(event.id)} />
                )}

                <p className="mt-3 sm:mt-4 text-[11px] sm:text-xs text-center text-muted-ink">
                  E-ticket arrives instantly after payment.
                </p>
              </div>

              {partnerOpen && partner && (
              <div className="rounded-md border border-hairline bg-surface p-5 sm:p-6">
                <p className="eyebrow">
                  {partner.types.map((t) => PARTNER_COPY[t].label + (t === "talent" ? "" : "s")).join(" · ")} wanted
                </p>
                <h2 className="mt-1 sm:mt-2 font-display text-base sm:text-lg font-bold text-ink leading-snug">
                  {partner.headline || "Work with this event"}
                </h2>
                <p className="mt-2 text-xs text-muted-ink leading-relaxed">
                  {partner.blurb || "Tell the organizer what you offer. They review every application and reply directly."}
                </p>
                {partner.closesAt && (
                  <p className="mt-2 text-[11px] text-muted-ink">
                    Applications close {format(new Date(partner.closesAt), "EEE d MMM")}
                  </p>
                )}
                <Button
                  className="press mt-4 w-full h-10 sm:h-11 bg-gold text-[#1a1408] hover:bg-gold-soft font-semibold rounded-md text-xs sm:text-sm"
                  onClick={() => setIsBusinessModalOpen(true)}
                >
                  {partner.types.length === 1 ? `Apply as ${partner.types[0] === "talent" ? "talent" : "a " + partner.types[0]}` : "Apply to work with us"}
                </Button>
                {partner.whatsapp && (
                  <a
                    href={`https://wa.me/${partner.whatsapp.replace(/\D/g, "").replace(/^0/, "234")}?text=${encodeURIComponent(`Hi, I'd like to work with you on ${event.title}.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="press mt-2 w-full h-10 inline-flex items-center justify-center gap-2 rounded-md border border-hairline text-xs sm:text-sm text-ink hover:border-gold/50"
                  >
                    <MessageCircle className="w-4 h-4 text-[#25D366]" /> Message the organizer
                  </a>
                )}
              </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Public promo strip on mobile sits inside the main column above. */}

      {/* Mobile app bar: price and the one action that matters, pinned where the thumb is */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur-xl px-3.5 sm:px-4 pt-2.5 sm:pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.65rem)" }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="min-w-0 pr-1">
            <p className="eyebrow text-[9.5px]">From</p>
            <p className="font-display text-lg min-[360px]:text-xl font-bold text-ink leading-none mt-0.5 truncate">{price}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFlyerModalOpen(true)}
            aria-label="Share this event"
            className="press h-10 w-10 sm:h-12 sm:w-12 shrink-0 border-hairline text-ink hover:text-gold"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          {eventEnded ? (
            <div className="flex-1 h-10 sm:h-12 flex items-center justify-center rounded-md border border-hairline bg-surface-2/60 text-xs sm:text-sm text-muted-ink">
              Event ended
            </div>
          ) : (
            <Button
              onClick={() => setIsBookingOpen(true)}
              className="press flex-1 h-10 sm:h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md text-xs sm:text-sm"
            >
              Get tickets
            </Button>
          )}
        </div>
        {waitlistEnabled && soldOut && <WaitlistInline eventId={String(event.id)} compact />}
      </div>

      <BookingReturnHandler event={event} />

      <BookingModal
        event={event}
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
      />

      <BusinessModal
        event={event}
        isOpen={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
      />

      {isFlyerZoomOpen && event.imageUrl && (
        <FlyerLightbox src={event.imageUrl} alt={event.title} onClose={() => setIsFlyerZoomOpen(false)} />
      )}
      <ShareFlyerModal
        open={isFlyerModalOpen}
        onClose={() => setIsFlyerModalOpen(false)}
        event={event}
        guestMode
      />
    </div>
  );
}

/**
 * Waitlist capture for sold-out events, shown only when the organizer turned
 * waitlists on. One input row, inline confirmation, no page jump.
 */
function parseTiersSafe(raw: unknown): any[] {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function WaitlistInline({ eventId, compact = false }: { eventId: string; compact?: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  if (state === "done") {
    return (
      <div className="mt-4 rounded-md border border-gold/30 bg-gold/[0.07] p-4 text-sm text-ink">
        You are on the list. If a spot opens, the organizer will email you.
      </div>
    );
  }

  const join = async () => {
    if (!name.trim() || !email.trim()) {
      setMessage("Add your name and email to join the waitlist.");
      setState("error");
      return;
    }
    setState("busy");
    try {
      const res = await fetch(`/api/events/${eventId}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not join");
      setState("done");
    } catch (err: any) {
      setMessage(err.message || "Could not join the waitlist");
      setState("error");
    }
  };

  return (
    <div className={compact ? "mt-3 w-full" : "mt-4"}>
      {!compact && <p className="eyebrow text-gold flex items-center gap-2"><Clock className="w-3.5 h-3.5" aria-hidden="true" /> Sold out. Join the waitlist</p>}
      {compact && <p className="text-xs text-muted-ink">Sold out. Join the waitlist:</p>}
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Your name"
          className="h-11 bg-surface-2 border-hairline text-ink rounded-md"
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
          className="h-11 bg-surface-2 border-hairline text-ink rounded-md"
        />
        <Button
          onClick={join}
          disabled={state === "busy"}
          className="press h-11 px-5 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md shrink-0"
        >
          {state === "busy" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
        </Button>
      </div>
      {state === "error" && <p className="mt-2 text-xs text-red-400">{message}</p>}
    </div>
  );
}
