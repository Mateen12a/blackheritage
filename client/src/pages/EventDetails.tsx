import { useEvent } from "@/hooks/use-events";
import { BookingModal } from "@/components/BookingModal";
import { ShareFlyerModal } from "@/components/ShareFlyerModal";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { Loader2, Calendar, MapPin, Users, Share2, ArrowLeft, Tag, Clock, MessageCircle, Copy } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BusinessModal } from "@/components/BusinessModal";
import { Reveal, FadeImg } from "@/components/motion";
import { PastEventProof } from "@/components/PastEventProof";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { BookingReturnHandler } from "@/components/BookingReturnHandler";
import { getPreset, accentOverrides } from "@shared/themes";
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
    ...(getPreset(event?.theme)?.vars || {}),
    ...accentOverrides(event?.theme, event?.branding?.accentHex),
  } as React.CSSProperties;
}

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
  const brand = (event as any).branding || null;
  const soldOut =
    ticketTypes.length > 0 &&
    ticketTypes.every((t: any) => Math.max(0, Number(t.capacity || 0) - Number(t.sold || 0)) <= 0);

  // `pulse` and `countdown` are computed above the early returns; the
  // organizer's showAttendeeCount flag decides whether any of it renders.

  return (
    <div
      className="min-h-screen bg-background pb-40 lg:pb-24"
      style={themeVars}
    >
      {/* Event-branded navbar when the organizer set a name/logo; the
          platform default renders elsewhere. Brand links still go home. */}
      <Navbar eventBrand={brand} overMedia />

      {/* Flyer hero: the photo leads, gradients sink it into the page */}
      <div className="relative h-[52vh] w-full overflow-hidden">
        <FadeImg
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10"
        />
        <div className="absolute top-4 md:top-28 left-4 right-4 z-20 flex items-center justify-between">
          {cameFromApp ? (
            <Button
              variant="outline"
              size="icon"
              aria-label="Go back"
              onClick={() => window.history.back()}
              className="press rounded-full bg-background/70 border-hairline text-ink hover:bg-surface hover:text-gold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <Link href="/events">
              <Button
                variant="outline"
                size="icon"
                aria-label="Browse all events"
                className="press rounded-full bg-background/70 border-hairline text-ink hover:bg-surface hover:text-gold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Share this event"
            onClick={handleShare}
            className="press rounded-full bg-background/70 border-hairline text-ink hover:bg-surface hover:text-gold transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-28 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main column: editorial, no card box */}
          <div className="lg:col-span-2">
            <Reveal>
              <p className="eyebrow text-gold">
                {(event as any).eventTypeLabel || EVENT_TYPE_LABELS[(event as any).eventType] || "Upcoming event"}
              </p>
              <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink leading-[1.1] tracking-tight">
                {event.title}
              </h1>
              <div className="mt-5 h-0.5 w-16 bg-gold" aria-hidden="true" />
              <p className="mt-5 text-lg text-muted-ink">
                {format(new Date(event.date), "EEEE, d MMMM yyyy")} ·{" "}
                {format(new Date(event.date), "h:mm a")} · {event.location}
              </p>
              {brand?.displayName && (
                <div className="mt-3">
                  <Link
                    href={`/o/${(event as any).organizerSlug || brand.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
                    className="inline-flex items-center gap-2 text-sm text-muted-ink hover:text-gold transition-colors group"
                  >
                    {brand.logoUrl && (
                      <img src={brand.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover ring-1 ring-white/10" />
                    )}
                    <span>
                      Presented by <span className="text-ink font-medium group-hover:text-gold underline-offset-4 group-hover:underline">{brand.displayName}</span>
                    </span>
                  </Link>
                </div>
              )}
              {showAttendeeCount && pulse.data && pulse.data.going > 0 && (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-ink">
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
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const text = `${event.title}\n${format(new Date(event.date), "EEE d MMM, h:mm a")}\n${event.location}\n\nGet tickets: ${window.location.href}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
                  }}
                  className="press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-hairline bg-surface-2 text-sm text-ink hover:border-gold/40 hover:text-gold transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-green-500" aria-hidden="true" />
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
                  className="press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-hairline bg-surface-2 text-sm text-ink hover:border-gold/40 hover:text-gold transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  Copy link
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    onClick={async () => {
                      try {
                        await (navigator as any).share({
                          title: event.title,
                          text: `${event.title} — ${format(new Date(event.date), "EEE d MMM")}`,
                          url: window.location.href,
                        });
                      } catch {
                        // User cancelled or share failed; the two buttons above still cover it.
                      }
                    }}
                    className="press inline-flex items-center gap-2 px-4 py-2 rounded-full border border-hairline bg-surface-2 text-sm text-ink hover:border-gold/40 hover:text-gold transition-colors cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    Share
                  </button>
                )}
              </div>
              {showAttendeeCount && pulse.data?.recent?.[0] && (
                <p className="mt-1.5 text-sm text-muted-ink">
                  {pulse.data.recent[0].name} booked {pulse.data.recent[0].ago}
                </p>
              )}
            </Reveal>

            {/* The details: one hairline-separated list, gold icons */}
            <Reveal className="mt-10">
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
                  </div>
                </div>

                {showCounts && (
                  <div className="flex items-start gap-4 py-5 border-b border-hairline">
                    <Users className="w-5 h-5 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="eyebrow">Availability</dt>
                      <dd className="mt-1.5">
                        {ticketTypes.length === 0 ? (
                          <span className="text-ink">
                            {event.capacity} regular tickets remaining
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {ticketTypes.map((type: any) => (
                              <span key={type.name} className="text-ink">
                                <span className="text-gold font-medium">
                                  {type.capacity - (type.sold || 0)}
                                </span>{" "}
                                {type.name} left
                              </span>
                            ))}
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
              <Reveal className="mt-8">
                <div className="rounded-md border border-gold/25 bg-gold/[0.06] p-5">
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
            <Reveal className="mt-10">
              <p className="eyebrow">About this event</p>
              <p className="mt-4 text-muted-ink leading-relaxed whitespace-pre-line max-w-2xl">
                {event.description}
              </p>
            </Reveal>

            <PastEventProof event={event} />
          </div>

          {/* Sidebar: the primary action surface on the page */}
          <aside className="lg:col-span-1">
            <div className="sticky top-28 space-y-4">
              <div className="bg-surface border border-hairline rounded-md p-7">
                <p className="eyebrow">Tickets from</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold text-ink">
                    {price}
                  </span>
                  {event.price > 0 && (
                    <span className="text-sm text-muted-ink">/ person</span>
                  )}
                </div>

                {!countdown.expired && countdown.short && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.07] px-3 py-1.5 text-xs text-gold">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    Sales close in {countdown.short}
                  </div>
                )}
                {showAttendeeCount && pulse.data && pulse.data.going > 0 && (
                  <p className="mt-3 text-sm text-muted-ink">
                    <span className="text-ink font-medium">{pulse.data.going}</span> going
                  </p>
                )}

                <Button
                  onClick={() => setIsBookingOpen(true)}
                  className="press hidden lg:inline-flex mt-6 w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md"
                >
                  Get Tickets
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setIsFlyerModalOpen(true)}
                  className="press hidden lg:inline-flex mt-2.5 w-full h-11 border-hairline text-ink hover:text-gold hover:border-gold/40 font-medium rounded-md items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4 text-gold" />
                  Share &amp; Create Flyers
                </Button>

                {waitlistEnabled && soldOut && (
                  <WaitlistInline eventId={String(event.id)} />
                )}

                <p className="mt-4 text-xs text-center text-muted-ink">
                  E-ticket arrives instantly after payment.
                </p>
              </div>

              <div className="rounded-xl border border-gold/25 bg-gradient-to-b from-gold/[0.08] to-transparent p-6 shadow-[0_0_40px_-16px_rgba(227,178,60,0.35)]">
                <p className="eyebrow">Sponsors &amp; vendors</p>
                <h2 className="mt-2 font-display text-lg font-bold text-ink leading-snug">
                  Be in front of everyone at this event
                </h2>
                <p className="mt-2 text-xs text-muted-ink leading-relaxed">
                  A sponsor or vendor spot puts your brand next to the whole
                  crowd. The organizer reviews every application.
                </p>
                <Button
                  className="press mt-4 w-full h-11 bg-gold text-[#1a1408] hover:bg-gold-soft font-semibold rounded-md"
                  onClick={() => setIsBusinessModalOpen(true)}
                >
                  Apply as Sponsor or Vendor
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Public promo strip on mobile sits inside the main column above. */}

      {/* Mobile app bar: price and the one action that matters, pinned where the thumb is */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-hairline bg-background/95 backdrop-blur-xl px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="eyebrow">From</p>
            <p className="font-display text-xl font-bold text-ink leading-none mt-0.5">{price}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFlyerModalOpen(true)}
            aria-label="Create event flyer or share"
            className="press h-12 w-12 shrink-0 border-hairline text-ink hover:text-gold"
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setIsBookingOpen(true)}
            className="press flex-1 h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md"
          >
            Get Tickets
          </Button>
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

      <ShareFlyerModal
        open={isFlyerModalOpen}
        onClose={() => setIsFlyerModalOpen(false)}
        event={event}
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
