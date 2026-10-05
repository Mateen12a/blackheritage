import { RoleHowItWorks } from "@/components/RoleHowItWorks";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { useVendors } from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Flame, ArrowUpRight, MapPin } from "lucide-react";
import { priceLabelFor } from "@/lib/event-price";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Event } from "@shared/schema";
import { NativeSponsorSpotlight } from "@/components/NativeSponsorSpotlight";
import { MostBooked } from "@/components/MostBooked";
import { WHATSAPP_DISPLAY, whatsappLink } from "@/lib/contact";
import { Footer } from "@/components/Footer";
import logoImg from "../assets/logo.png";

/**
 * Animated heading: each character staggers in. Two locked lines so the
 * headline can never break mid-word at any width.
 */
function AnimatedHeading({ centered = false }: { centered?: boolean } = {}) {
  return (
    <h1
      className={cn(
        "mt-3.5 sm:mt-4 font-display text-4xl min-[380px]:text-5xl sm:text-6xl lg:text-7xl font-bold text-ink leading-[1.02] tracking-tight flex flex-col",
        centered
          ? "text-center items-center"
          : "text-center lg:text-left items-center lg:items-start"
      )}
    >
      <motion.span
        className="block whitespace-nowrap"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        Heritage
      </motion.span>
      <motion.span
        className="block whitespace-nowrap italic text-gold"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        & Vibes
      </motion.span>
    </h1>
  );
}

const EMBERS = [
  { left: "18%", bottom: "16%", size: 4, delay: "0s", duration: "10s", drift: "20px" },
  { left: "44%", bottom: "10%", size: 5, delay: "3.2s", duration: "11s", drift: "-22px" },
  { left: "70%", bottom: "20%", size: 4, delay: "6.1s", duration: "9.5s", drift: "18px" },
  { left: "86%", bottom: "12%", size: 3, delay: "1.6s", duration: "12s", drift: "-14px" },
];

/** Slow rising sparks around the poster. Pure CSS, GPU-safe, collapsed for reduced motion. */
function HeroEmbers() {
  return (
    <div aria-hidden="true" className="absolute -inset-8 overflow-visible pointer-events-none">
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-ember"
          style={
            {
              left: e.left,
              bottom: e.bottom,
              width: e.size,
              height: e.size,
              background: "#E3B23C",
              boxShadow: "0 0 6px 1px rgba(227,178,60,0.55)",
              animationDelay: e.delay,
              animationDuration: e.duration,
              "--ember-drift": e.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Scarcity state for one event, computed from its real tier data:
 * fill %, the tag that fill earns, and how hot the badge should burn.
 * Tiers with sale closed or zero capacity are ignored; no tier data at all
 * means "On Sale" with no percentage rather than an invented one.
 */
function scarcityFor(event: Event): { tag: string; pct: number | null; hot: 0 | 1 | 2 } {
  // Organizers can switch remaining-counts off for the whole event. When they
  // have, the badge stays honest: "On Sale", no invented percentage.
  if ((event as any).showRemainingCounts === false) {
    return { tag: "On Sale", pct: null, hot: 0 };
  }

  let capacity = 0;
  let sold = 0;
  try {
    const tiers = JSON.parse((event as any).ticketTypes || "[]");
    for (const t of tiers) {
      const cap = Number(t.capacity || 0);
      if (!cap || t.saleOpen === false) continue;
      capacity += cap;
      sold += Math.min(Number(t.sold || 0), cap);
    }
  } catch { /* malformed tiers → no data */ }
  if (capacity <= 0) return { tag: "On Sale", pct: null, hot: 0 };
  const pct = Math.round((sold / capacity) * 100);
  if (pct >= 90) return { tag: "Last Few Spots", pct, hot: 2 };
  if (pct >= 60) return { tag: "Selling Fast", pct, hot: 2 };
  if (pct >= 25) return { tag: "Filling Up", pct, hot: 1 };
  return { tag: "On Sale", pct, hot: 0 };
}

const SCARCITY_HOT = {
  2: { border: "border-gold/40", text: "text-gold", flame: true },
  1: { border: "border-gold/20", text: "text-gold/90", flame: false },
  0: { border: "border-white/15", text: "text-ink/80", flame: false },
} as const;

/**
 * The live scarcity badge on each poster. The flame only breathes when the
 * event is genuinely hot, and a one-beat delay on mount keeps the flip
 * between posters from feeling like a constant blink.
 */
function ScarcityBadge({ event, slideKey }: { event: Event; slideKey: string }) {
  const { tag, pct, hot } = scarcityFor(event);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const t = setTimeout(() => setShown(true), 350);
    return () => clearTimeout(t);
  }, [slideKey]);
  const skin = SCARCITY_HOT[hot];
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={shown ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/85 backdrop-blur-md border text-[11px] font-semibold shadow-lg pointer-events-none",
        skin.border,
        skin.text,
      )}
    >
      <Flame className={cn("w-3.5 h-3.5", skin.flame ? "animate-pulse" : "opacity-60")} />
      <span>
        {tag}
        {pct !== null && <span className="opacity-80"> · {pct}% booked</span>}
      </span>
    </motion.div>
  );
}

/**
 * The live poster deck: real on-sale events rotate like gig posters outside a
 * venue. Auto-advances with a slow push-in, pauses on hover, and any poster
 * can be called up by its thumb. One event is always on screen.
 */
function HeroPosterDeck({ events }: { events: Event[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !events || events.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % events.length), 4500);
    return () => clearInterval(t);
  }, [paused, events?.length]);

  if (!events || events.length === 0) {
    return (
      <div className="relative mx-auto w-full max-w-[34rem] aspect-[4/5] rounded-2xl border border-white/15 bg-surface flex flex-col items-center justify-center p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <Flame className="w-12 h-12 text-gold/40 mb-3" aria-hidden="true" />
        <h3 className="font-display text-xl font-bold text-ink mb-1.5">New Events Dropping Soon</h3>
        <p className="text-xs text-muted-ink max-w-xs mb-5 leading-relaxed">
          Tickets for upcoming parties, live concerts, and festivals across Nigeria will appear here once published.
        </p>
        <Link href="/organizers">
          <span className="press inline-flex items-center justify-center h-11 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-gold-soft transition-colors cursor-pointer">
            List an event
          </span>
        </Link>
      </div>
    );
  }

  const current = events[index % events.length];
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="relative mx-auto w-full max-w-[34rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroEmbers />
      {/* Desktop only: the next poster waits at the right edge, so the panel
          reads as a queue to page through instead of one static card. It swaps
          with the deck, so the page has life without any new animation.
          Decorative: the thumbs below remain the real control. */}
      {events.length > 1 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-6 hidden lg:block w-36 xl:w-40 -translate-x-10"
        >
          <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 opacity-55 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <img
              src={events[(index + 1) % events.length].imageUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          </div>
        </div>
      )}
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.55)] outline outline-1 outline-white/10">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {failed || !current.imageUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-surface-2">
                <Flame className="w-10 h-10 text-gold/40" aria-hidden="true" />
                <span className="text-xs text-muted-ink">Flyer coming soon</span>
              </div>
            ) : (
              <img
                src={current.imageUrl}
                alt={current.title}
                onError={() => setFailed(true)}
                className="w-full h-full object-cover animate-slow-zoom"
              />
            )}
          </motion.div>
        </AnimatePresence>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/10 to-transparent pointer-events-none"
        />
        {/* Real ticket scarcity, keyed to this poster. Every poster used to
            wear the same "Selling Fast · 89% Booked" sticker, invented from
            the event id. The fill rate now comes from the tiers the organizer
            actually set, and the tag moves with it: On Sale, Filling Up,
            Selling Fast, Last Few Spots. */}
        <ScarcityBadge event={current} slideKey={current.id} />
        <div className="absolute inset-x-3 sm:inset-x-4 bottom-3 sm:bottom-4 flex items-center justify-between gap-2 sm:gap-3 pointer-events-none">
          <div className="min-w-0 pr-1">
            <p className="eyebrow text-[10px] sm:text-[11px] truncate">{format(new Date(current.date), "EEE d MMM · ha")}</p>
            <p className="mt-0.5 sm:mt-1 font-display text-base sm:text-lg font-bold text-ink truncate">
              {current.title}
            </p>
            <p className="mt-0.5 text-xs sm:text-[13px] font-medium text-gold/90">{priceLabelFor(current)}</p>
          </div>
          <Link href={"/events/" + current.id} className="pointer-events-auto shrink-0">
            <span className="press inline-flex items-center gap-1 h-8 sm:h-9 px-3 sm:px-4 rounded-full bg-primary text-primary-foreground text-xs sm:text-[13px] font-medium hover:bg-gold-soft transition-colors cursor-pointer whitespace-nowrap">
              Get tickets
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            </span>
          </Link>
        </div>
      </div>
      {/* Poster thumbs: pick what's on the marquee.
          Each control is a 24×24 hit area with the visible 2px bar centred
          inside it. The old version made the bar itself the button (8×8),
          which is well under the 24px minimum target on a phone, and on
          the hero these dots are the only way to choose a poster. */}
      {events.length > 1 && (
        <div className="mt-3 flex justify-center gap-1">
          {events.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={"Show " + e.title}
              aria-current={i === index % events.length}
              className="group/dot press grid h-6 min-w-6 place-items-center"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-all duration-300",
                  i === index % events.length
                    ? "w-6 bg-gold"
                    : "w-2 bg-white/25 group-hover/dot:bg-white/50"
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { data: events, isLoading } = useEvents();
  const { user } = useAuth();
  const { data: vendors } = useVendors();

  const featuredEvents =
    events?.filter((e) => e.isFeatured).slice(0, 3) ||
    events?.slice(0, 3);

  const posterDeck = (events ?? []).slice(0, 4);
  const vendorsWithWork = (vendors ?? []).filter((v) => {
    try {
      const g = JSON.parse(v.gallery || "[]");
      return Array.isArray(g) && g.length > 0;
    } catch {
      return false;
    }
  });

  const dashboardHref =
    user?.role === "admin" || user?.role === "organizer" || user?.isAdmin
      ? "/admin"
      : user?.role === "vendor"
        ? "/vendor-dashboard"
        : "/dashboard";

  return (
    <div className="min-h-screen">
      {/* Hero: atmospheric concert motion, headline, Afrobeats player, live poster panel */}
      <section className="relative overflow-hidden">
        {/* Concert still, not a looping video. The MP4 was several megabytes
            pulled from a third-party CDN on every home visit, on the device
            class most of our audience browses on, to render at 20% opacity
            behind a heavy scrim. A still frame carries the same atmosphere for
            a fraction of the cost, and leaves the motion budget to the flyers,
            which are the thing worth looking at. */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <img
            src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1600&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-25 filter contrast-125 saturate-150 animate-kenburns"
          />
          {/* Luxury scrim keeping Playfair headlines crisp and meeting DESIGN.md */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/80 to-background" />
        </div>

        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[520px] animate-hero-glow pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 50% 30%, rgba(227,178,60,0.18) 0%, transparent 70%)",
          }}
        />

        <div className="container relative z-10 pt-4 md:pt-6 pb-12 md:pb-16">
          {/* Poster-first split. The copy and a real flyer share the first
              screen, so a visitor meets an actual event before reading a word
              of positioning. Stacked below lg: headline, then the flyer, then
              the buttons. The flyer still lands above the fold on a phone.
              Copy is left-anchored, per DESIGN.md's editorial header rule. */}
          {/* The poster track is an explicit width, not `auto`: the deck's own
              width is a percentage of its track, so an auto track resolves
              against the only fixed thing inside it, the 4 × 24px thumb row,
              and collapses to 108px. */}
          {/* When no events exist, center-align hero text. When events exist, show split layout with text on left and image deck on right. */}
          {posterDeck.length === 0 ? (
            <div className="max-w-3xl mx-auto text-center flex flex-col items-center py-6 sm:py-10">
              <Reveal y={16} duration={0.55}>
                <p className="text-[10px] min-[360px]:text-[11px] font-bold tracking-[0.10em] min-[360px]:tracking-[0.16em] sm:tracking-[0.18em] uppercase text-gold text-center">
                  Nigeria · Concerts · Festivals · Culture
                </p>
              </Reveal>

              <AnimatedHeading centered />

              <Reveal y={16} delay={0.4} duration={0.6}>
                <p className="mt-3.5 sm:mt-5 max-w-xl text-sm sm:text-base lg:text-lg text-ink/80 leading-relaxed text-center mx-auto">
                  Tickets to concerts, parties, and festivals in Lagos, Abuja, and beyond. Then the DJs, caterers, and sound engineers who work them, each with a portfolio you can check before you book.
                </p>
              </Reveal>

              <Reveal y={12} delay={0.5} duration={0.55}>
                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-center items-center">
                  <Link href="/events">
                    <Button className="press h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-full w-full sm:w-auto">
                      Explore events
                    </Button>
                  </Link>
                  <Link href="/talent">
                    <Button
                      variant="outline"
                      className="press h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base border-white/20 bg-white/5 text-ink hover:bg-white/10 hover:text-gold font-medium rounded-full w-full sm:w-auto backdrop-blur-sm"
                    >
                      Book Talent
                    </Button>
                  </Link>
                  <Link href={user ? "/admin/events/new" : "/auth?returnTo=/admin/events/new"}>
                    <Button
                      variant="outline"
                      className="press h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 font-medium rounded-full w-full sm:w-auto backdrop-blur-sm"
                    >
                      Host an Event
                    </Button>
                  </Link>
                </div>

                {user && (
                  <div className="text-center mt-4">
                    <Link href={dashboardHref}>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                        My Dashboard
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                      </span>
                    </Link>
                  </div>
                )}

                {/* Quick discovery */}
                <div className="mt-5 sm:mt-6 flex flex-wrap gap-1.5 min-[360px]:gap-2 justify-center">
                  {[
                    { label: "Lagos", href: "/events?city=Lagos" },
                    { label: "Abuja", href: "/events?city=Abuja" },
                    { label: "Concerts", href: "/events?category=Concerts" },
                    { label: "Festivals", href: "/events?category=Festivals" },
                    { label: "Free", href: "/events?price=free" },
                  ].map((pill) => (
                    <Link key={pill.label} href={pill.href}>
                      <span className="press inline-flex items-center h-7.5 min-[360px]:h-8 px-3 min-[360px]:px-3.5 rounded-full border border-white/10 bg-white/5 text-[11px] min-[360px]:text-xs font-medium text-ink/70 hover:border-gold/30 hover:text-gold transition-colors cursor-pointer backdrop-blur-sm">
                        {pill.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </Reveal>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_30rem] xl:grid-cols-[minmax(0,1fr)_34rem] lg:gap-x-12 lg:gap-y-2 xl:gap-x-14 lg:items-center">
              {/* Copy, part one: the claim */}
              <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
                <Reveal y={16} duration={0.55}>
                  <p className="text-[10px] min-[360px]:text-[11px] font-bold tracking-[0.10em] min-[360px]:tracking-[0.16em] sm:tracking-[0.18em] uppercase text-gold text-center lg:text-left">
                    Nigeria · Concerts · Festivals · Culture
                  </p>
                </Reveal>

                <AnimatedHeading centered={false} />

                <Reveal y={16} delay={0.4} duration={0.6}>
                  <p className="mt-3.5 sm:mt-4 max-w-xl text-sm sm:text-base lg:text-lg text-ink/80 leading-relaxed text-center lg:text-left mx-auto lg:mx-0">
                    Tickets to concerts, parties, and festivals in Lagos, Abuja, and beyond. Then the DJs, caterers, and sound engineers who work them, each with a portfolio you can check before you book.
                  </p>
                </Reveal>
              </div>

              {/* The live poster marquee: right-bleeding */}
              <Reveal
                y={18}
                delay={0.2}
                duration={0.7}
                className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center"
              >
                <HeroPosterDeck events={posterDeck} />
              </Reveal>

              {/* Copy, part two: the action */}
              <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
                <Reveal y={12} delay={0.5} duration={0.55}>
                  <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-center lg:justify-start">
                    <Link href="/events">
                      <Button className="press h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-full w-full sm:w-auto">
                        See all events
                      </Button>
                    </Link>
                    <Link href="/talent">
                      <Button
                        variant="outline"
                        className="press h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base border-white/20 bg-white/5 text-ink hover:bg-white/10 hover:text-gold font-medium rounded-full w-full sm:w-auto backdrop-blur-sm"
                      >
                        Book Talent
                      </Button>
                    </Link>
                  </div>

                  {user && (
                    <div className="text-center lg:text-left">
                      <Link href={dashboardHref}>
                        <span className="mt-3.5 inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                          My Dashboard
                          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                        </span>
                      </Link>
                    </div>
                  )}

                  {/* Quick discovery */}
                  <div className="mt-4 sm:mt-5 flex flex-wrap gap-1.5 min-[360px]:gap-2 justify-center lg:justify-start">
                    {[
                      { label: "Lagos", href: "/events?city=Lagos" },
                      { label: "Abuja", href: "/events?city=Abuja" },
                      { label: "Concerts", href: "/events?category=Concerts" },
                      { label: "Festivals", href: "/events?category=Festivals" },
                      { label: "Free", href: "/events?price=free" },
                    ].map((pill) => (
                      <Link key={pill.label} href={pill.href}>
                        <span className="press inline-flex items-center h-7.5 min-[360px]:h-8 px-3 min-[360px]:px-3.5 rounded-full border border-white/10 bg-white/5 text-[11px] min-[360px]:text-xs font-medium text-ink/70 hover:border-gold/30 hover:text-gold transition-colors cursor-pointer backdrop-blur-sm">
                          {pill.label}
                        </span>
                      </Link>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          )}

              {/* Counts are off until there are enough shows and vendors for
                  the numbers to mean anything. Kept here for the day they are:
                  uncomment and compute `cheapestTicket` with `cheapestPriceKobo`
                  in the component body.

              <Reveal y={10} delay={0.58} duration={0.5}>
                <dl className="mt-9 flex items-stretch">
                  <div className="pr-5 sm:pr-7">
                    <dt className="sr-only">Shows on sale</dt>
                    <dd className="font-display text-3xl sm:text-4xl font-bold text-gold leading-none tabular-nums">
                      {events?.length ?? 0}
                    </dd>
                    <dd className="eyebrow mt-2.5">shows on sale</dd>
                  </div>
                  <div className="pl-5 sm:pl-7 border-l border-hairline">
                    <dt className="sr-only">Vendors across Nigeria</dt>
                    <dd className="font-display text-3xl sm:text-4xl font-bold text-gold leading-none tabular-nums">
                      {vendors?.length ?? 0}
                    </dd>
                    <dd className="eyebrow mt-2.5">vendors across Nigeria</dd>
                  </div>
                  {cheapestTicket !== null && (
                    <div className="pl-5 sm:pl-7 border-l border-hairline">
                      <dt className="sr-only">Cheapest ticket on sale</dt>
                      <dd className="font-display text-3xl sm:text-4xl font-bold text-gold leading-none tabular-nums">
                        {formatNaira(cheapestTicket)}
                      </dd>
                      <dd className="eyebrow mt-2.5">tickets from</dd>
                    </div>
                  )}
                </dl>
              </Reveal>
              */}
            </div>
          </div>
        </div>

        {/* The ticker that scrolled the same events under the deck is gone. The
            home page should not announce the same events three times in a row:
            the deck is the hero's event surface, the ranked rail below is the
            list, and "See all events" is the way into the directory. */}
      </section>

      {/* What is actually filling up, ranked from real tier data */}
      {events && events.length > 0 && <MostBooked events={events} />}

      {/* The separate "Shows Across Nigeria" grid is off for now. The ranked
          rail above already lists real events, and two event sections stacked on
          one page made the landing feel like a directory. Switch it back on when
          the catalogue is big enough that a grid shows more than the rail can:
          uncomment below and re-add the `EventCard` import (plus `Loader2` for
          the spinner). `featuredEvents` and `isLoading` above are kept for it.

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10 gap-6">
            <Reveal>
              <div>
                <p className="eyebrow">On sale now</p>
                <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
                  Shows Across Nigeria
                </h2>
                <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
                <p className="mt-4 text-sm text-muted-ink">
                  Everything on sale right now. The good ones fill up first.
                </p>
              </div>
            </Reveal>
            <Link href="/events" className="hidden md:block">
              <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                See all events →
              </span>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gold" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredEvents?.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          {!isLoading && (!featuredEvents || featuredEvents.length === 0) && (
            <div className="text-center py-16 bg-surface border border-hairline rounded-md">
              <p className="text-muted-ink">
                No events on sale at the moment.
              </p>
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <Link href="/events">
              <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                See all events →
              </span>
            </Link>
          </div>
        </div>
      </section>
      */}

      {/* Editorial Brand Spotlight / Native Placement */}
      <section className="py-6">
        <div className="container mx-auto px-4">
          <NativeSponsorSpotlight placement="home_spotlight" />
        </div>
      </section>

      {/* The talent wall: real vendor work, drag to browse */}
      {vendorsWithWork.length >= 3 && (
        <section aria-label="Vendors at work" className="py-16 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-10 gap-6">
              <Reveal>
                <div>
                  <p className="eyebrow">The talent</p>
                  <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
                    Hire DJs, caterers, and decorators
                  </h2>
                  <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
                  <p className="mt-4 text-sm text-muted-ink">
                    Portfolio photos from working vendors. Open a profile and
                    message them on WhatsApp.
                  </p>
                </div>
              </Reveal>
              <Link href="/vendors" className="hidden md:block shrink-0">
                <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                  See all vendors →
                </span>
              </Link>
            </div>
          </div>
          <Reveal>
            {/* Full-bleed drag rail: content bleeds, controls stay inside */}
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 md:px-[max(2rem,calc((100vw-76rem)/2+2rem))] pb-2 scroll-smooth no-scrollbar">
                {vendorsWithWork.map((v) => (
                  <Link
                    key={v.id}
                    href={"/vendors/" + v.id}
                    className="group relative shrink-0 w-64 md:w-72 snap-start overflow-hidden rounded-md border border-hairline aspect-[4/5] cursor-pointer"
                  >
                    <img
                      src={(() => {
                        try {
                          const g = JSON.parse(v.gallery || "[]");
                          return Array.isArray(g) ? g[0] : "";
                        } catch {
                          return "";
                        }
                      })()}
                      alt={v.businessName}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/15 to-transparent"
                    />
                    <div className="absolute inset-x-4 bottom-4">
                      <p className="eyebrow">{v.category}</p>
                      <p className="mt-1 font-display text-lg font-bold text-ink truncate transition-colors duration-200 group-hover:text-gold">
                        {v.businessName}
                      </p>
                      <p className="mt-1 text-xs text-muted-ink flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gold" aria-hidden="true" />
                        {v.city || v.serviceArea || "Lagos"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              {/* Subtle edge fade indicator for mobile scrollability */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent md:hidden"
              />
            </div>
          </Reveal>
        </section>
      )}

      {/* Two-sided marketplace: Organizers & Talent */}
      <section className="border-t border-hairline py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Reveal className="h-full">
              <div className="h-full border border-hairline rounded-md bg-surface p-5 sm:p-6 md:p-8 flex flex-col justify-between hover:border-white/20 transition-colors duration-200">
                <div>
                  <p className="eyebrow">For organizers &amp; promoters</p>
                  <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                    List your event. Sell out.
                  </h2>
                  <div className="mt-4 h-0.5 w-12 bg-gold" aria-hidden="true" />
                  <p className="mt-4 text-muted-ink leading-relaxed">
                    Set your tiers and ticket prices yourself. Buyers get instant QR tickets, and revenue settles straight to your Nigerian bank account the next business day.
                  </p>
                  <div className="mt-6 border-t border-hairline pt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" aria-hidden="true" />
                      <p className="text-xs text-ink/80 leading-relaxed">
                        <strong className="text-ink font-semibold">Zero platform fee</strong> on your first 100 tickets sold (flat 6% transparent fee after).
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" aria-hidden="true" />
                      <p className="text-xs text-ink/80 leading-relaxed">
                        <strong className="text-ink font-semibold">Door scanner ready:</strong> staff scan QR codes from phones or badges with instant verification.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" aria-hidden="true" />
                      <p className="text-xs text-ink/80 leading-relaxed">
                        <strong className="text-ink font-semibold">Direct checkout:</strong> Fast checkout supporting cards, bank transfer, and USSD.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-2.5 sm:gap-3">
                  <Link href="/organizers">
                    <span className="press inline-flex items-center justify-center h-10 sm:h-11 px-4 sm:px-5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-gold-soft transition-colors cursor-pointer text-xs">
                      See Organizer Benefits
                    </span>
                  </Link>
                  <Link href={user ? "/admin" : "/auth?tab=register"}>
                    <span className="press inline-flex items-center justify-center h-10 sm:h-11 px-4 sm:px-5 rounded-md border border-hairline text-ink font-medium hover:bg-surface-2 hover:text-gold transition-colors cursor-pointer text-xs">
                      Host an Event
                    </span>
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08} className="h-full">
              <div className="h-full border border-hairline rounded-md bg-surface p-5 sm:p-6 md:p-8 flex flex-col justify-between hover:border-white/20 transition-colors duration-200">
                <div>
                  <p className="eyebrow">For DJs, MCs, caterers &amp; crew</p>
                  <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                    Direct client discovery. Zero monthly dues.
                  </h2>
                  <div className="mt-4 h-0.5 w-12 bg-gold" aria-hidden="true" />
                  <p className="mt-4 text-muted-ink leading-relaxed">
                    A permanent profile displaying your portfolio photos, service areas, and direct WhatsApp contact. Event planners and promoters discover and book you directly.
                  </p>
                  <div className="mt-6 border-t border-hairline pt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" aria-hidden="true" />
                      <p className="text-xs text-ink/80 leading-relaxed">
                        <strong className="text-ink font-semibold">100% free listing:</strong> showcase your event photo gallery and services with zero monthly dues.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0" aria-hidden="true" />
                      <p className="text-xs text-ink/80 leading-relaxed">
                        <strong className="text-ink font-semibold">Direct client conversations:</strong> planners chat with you on WhatsApp without platform lock-in.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-2.5 sm:gap-3">
                  <Link href={user ? "/vendor-dashboard" : "/auth?tab=register"}>
                    <span className="press inline-flex items-center justify-center h-10 sm:h-11 px-4 sm:px-6 rounded-md bg-primary text-primary-foreground font-medium hover:bg-gold-soft transition-colors cursor-pointer text-xs sm:text-sm">
                      List your profile
                    </span>
                  </Link>
                  <Link href="/vendors">
                    <span className="press inline-flex items-center justify-center h-10 sm:h-11 px-4 sm:px-5 rounded-md text-muted-ink hover:text-gold transition-colors cursor-pointer text-xs">
                      Explore Directory
                    </span>
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works: role-based, switchable between guests / organizers / vendors / brands */}
      <RoleHowItWorks />

      {/* Footer */}
      <Footer />
    </div>
  );
}
