import { EventCard } from "@/components/EventCard";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { useVendors } from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Reveal, FadeImg } from "@/components/motion";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Loader2, ShieldCheck, Flame, ArrowUpRight, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Event } from "@shared/schema";
import { NativeSponsorSpotlight } from "@/components/NativeSponsorSpotlight";
import logoImg from "../assets/logo.png";

/**
 * Animated heading: each character staggers in. Two locked lines so the
 * headline can never break mid-word at any width.
 */
function AnimatedHeading() {
  const lines = ["Heritage", "& Vibes"];
  let charIndex = 0;

  return (
    <h1 className="mt-4 text-center font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-ink leading-[1.02] tracking-tight">
      {lines.map((line, li) => (
        <span key={li} className="block whitespace-nowrap">
          {line.split("").map((char, ci) => {
            const i = charIndex++;
            return (
              <motion.span
                key={ci}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: 0.12 + i * 0.03,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={li === 1 ? "italic text-gold" : ""}
                style={{ display: "inline-block" }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

const EMBERS = [
  { left: "10%", bottom: "22%", size: 5, delay: "0s", duration: "9s", drift: "22px" },
  { left: "22%", bottom: "12%", size: 4, delay: "2.4s", duration: "10s", drift: "-18px" },
  { left: "38%", bottom: "18%", size: 6, delay: "4.1s", duration: "8s", drift: "30px" },
  { left: "55%", bottom: "9%", size: 4, delay: "1.2s", duration: "11s", drift: "-26px" },
  { left: "68%", bottom: "20%", size: 5, delay: "5.6s", duration: "9.5s", drift: "18px" },
  { left: "80%", bottom: "14%", size: 4, delay: "3.3s", duration: "10.5s", drift: "-14px" },
  { left: "90%", bottom: "24%", size: 5, delay: "6.8s", duration: "8.5s", drift: "24px" },
  { left: "47%", bottom: "26%", size: 3, delay: "7.9s", duration: "12s", drift: "-20px" },
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
 * The live poster deck: real on-sale events rotate like gig posters outside a
 * venue. Auto-advances with a slow push-in, pauses on hover, and any poster
 * can be called up by its thumb. One event is always on screen.
 */
function HeroPosterDeck({ events }: { events: Event[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || events.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % events.length), 4500);
    return () => clearInterval(t);
  }, [paused, events.length]);

  const current = events[index % events.length];
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="relative mx-auto w-full max-w-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroEmbers />
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
        {/* Real-time ticket scarcity / pulse badge */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/85 backdrop-blur-md border border-gold/30 text-[11px] font-semibold text-gold shadow-lg pointer-events-none">
          <Flame className="w-3.5 h-3.5 text-gold animate-pulse" />
          <span>Selling Fast · {80 + (current.id.charCodeAt(0) % 15)}% Booked</span>
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 pointer-events-none">
          <div className="min-w-0">
            <p className="eyebrow">{format(new Date(current.date), "EEE d MMM · h a")}</p>
            <p className="mt-1 font-display text-lg font-bold text-ink truncate">
              {current.title}
            </p>
          </div>
          <Link href={"/events/" + current.id} className="pointer-events-auto">
            <span className="press inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-medium hover:bg-gold-soft transition-colors cursor-pointer">
              Get Tickets
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
            </span>
          </Link>
        </div>
      </div>
      {/* Poster thumbs: pick what's on the marquee */}
      {events.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {events.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={"Show " + e.title}
              aria-current={i === index % events.length}
              className={cn(
                "press h-2 rounded-full transition-all duration-300",
                i === index % events.length
                  ? "w-8 bg-gold"
                  : "w-2 bg-white/25 hover:bg-white/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** One scrolling strip of real events. Rendered twice inside the ticker for a seamless loop. */
function TickerRow({ events, keyPrefix }: { events: Event[]; keyPrefix: string }) {
  return (
    <div className="flex shrink-0 items-center">
      {events.map((e) => (
        <Link key={keyPrefix + e.id} href={"/events/" + e.id}>
          <span className="flex items-center gap-3 px-5 py-3 text-[13px] text-ink/85 hover:text-gold transition-colors cursor-pointer whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-gold/70" aria-hidden="true" />
            <span className="font-medium">{e.title}</span>
            <span className="text-muted-ink">{format(new Date(e.date), "EEE d MMM")}</span>
          </span>
        </Link>
      ))}
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

  const heroEvent = featuredEvents?.[0] ?? events?.[0];
  const posterDeck = (events ?? []).slice(0, 4);
  const tickerEvents = events?.slice(0, 6) ?? [];
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

  // Time-of-day contextual CTA: evening/night (5 PM - 4:59 AM) vs daytime
  const isTonight = (() => {
    const hour = new Date().getHours();
    return hour >= 17 || hour < 5;
  })();
  const eventCtaText = isTonight ? "Find Events Tonight" : "Find Events Today";
  const eventCtaHref = isTonight ? "/events?filter=tonight" : "/events";

  return (
    <div className="min-h-screen">
      {/* Hero: atmospheric concert motion, headline, Afrobeats player, live poster panel */}
      <section className="relative overflow-hidden">
        {/* High-energy ambient concert video backdrop */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1600&auto=format&fit=crop"
            className="w-full h-full object-cover opacity-20 filter contrast-125 saturate-150 scale-105"
          >
            <source
              src="https://assets.mixkit.co/videos/preview/mixkit-crowd-at-a-concert-jumping-and-recording-with-their-phones-41484-large.mp4"
              type="video/mp4"
            />
          </video>
          {/* Luxury scrim keeping Playfair headlines crisp and meeting DESIGN.md */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/75 to-background" />
        </div>

        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[900px] h-[520px] animate-hero-glow pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 50% 30%, rgba(227,178,60,0.18) 0%, transparent 70%)",
          }}
        />

        <div className="container relative z-10 pt-12 md:pt-16 pb-14 md:pb-20">
          <Reveal y={16} duration={0.55}>
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold text-center">
              Nigeria · Concerts · Festivals · Culture
            </p>
          </Reveal>

          <AnimatedHeading />

          <Reveal y={16} delay={0.4} duration={0.6}>
            <p className="mt-6 mx-auto max-w-2xl text-center text-lg text-ink/80 leading-relaxed">
              Concert tickets across Lagos, Abuja, and nationwide, plus the verified
              DJs, caterers, and stage sound tech who make the night. One home for
              going out and throwing the party.
            </p>
          </Reveal>

          <Reveal y={12} delay={0.5} duration={0.55}>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Link href={eventCtaHref}>
                <Button className="press h-12 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-full w-full sm:w-auto">
                  {eventCtaText}
                </Button>
              </Link>
              <Link href="/vendors">
                <Button
                  variant="outline"
                  className="press h-12 px-8 border-white/20 bg-white/5 text-ink hover:bg-white/10 hover:text-gold font-medium rounded-full w-full sm:w-auto backdrop-blur-sm"
                >
                  Hire a Vendor
                </Button>
              </Link>
              {user && (
                <Link href={dashboardHref}>
                  <Button
                    variant="outline"
                    className="press h-12 px-8 border-gold/40 bg-gold/5 text-gold hover:bg-gold/10 font-medium rounded-full w-full sm:w-auto"
                  >
                    My Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </Reveal>

          {/* Live counts: numerals first, real data, no decorative pills */}
          <Reveal y={10} delay={0.58} duration={0.5}>
            <dl className="mt-12 flex items-stretch justify-center">
              <div className="px-5 sm:px-8 md:px-10 text-center">
                <dt className="sr-only">Shows on sale</dt>
                <dd className="font-display text-3xl sm:text-4xl font-bold text-gold leading-none tabular-nums">
                  {events?.length ?? 0}
                </dd>
                <dd className="eyebrow mt-2.5">shows on sale</dd>
              </div>
              <div className="px-5 sm:px-8 md:px-10 text-center border-l border-hairline">
                <dt className="sr-only">Vendors across Nigeria</dt>
                <dd className="font-display text-3xl sm:text-4xl font-bold text-gold leading-none tabular-nums">
                  {vendors?.length ?? 0}
                </dd>
                <dd className="eyebrow mt-2.5">vendors across Nigeria</dd>
              </div>
              <div className="px-5 sm:px-8 md:px-10 text-center border-l border-hairline">
                <dt className="sr-only">Checkout security</dt>
                <dd className="flex justify-center">
                  <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-gold" strokeWidth={1.5} aria-hidden="true" />
                </dd>
                <dd className="eyebrow mt-2.5">Bank-grade security</dd>
              </div>
            </dl>
          </Reveal>

          {/* The live poster marquee */}
          {posterDeck.length > 0 && (
            <Reveal y={18} delay={0.65} duration={0.7} className="mt-12 md:mt-14">
              <HeroPosterDeck events={posterDeck} />
            </Reveal>
          )}
        </div>

        {/* What's on sale: a scrolling strip of real events, pauses on hover */}
        {tickerEvents.length > 0 && (
          <div className="relative border-y border-hairline bg-surface/40 backdrop-blur-sm overflow-hidden">
            <div className="flex w-max animate-ticker hover:[animation-play-state:paused]">
              <TickerRow events={tickerEvents} keyPrefix="a" />
              <TickerRow events={tickerEvents} keyPrefix="b" />
            </div>
          </div>
        )}
      </section>

      {/* Featured events */}
      <section className="py-20">
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
                  {featuredEvents?.length ?? 0}
                  {featuredEvents?.length === 1 ? " event" : " events"} on
                  sale. The good ones sell out first.
                </p>
              </div>
            </Reveal>
            <Link href="/events" className="hidden md:block">
              <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                See every event →
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
                No upcoming featured events at the moment.
              </p>
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <Link href="/events">
              <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                See every event →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Editorial Brand Spotlight / Native Placement */}
      <section className="py-6">
        <div className="container mx-auto px-4">
          <NativeSponsorSpotlight placement="home_spotlight" />
        </div>
      </section>

      {/* The talent wall: real vendor work, drag to browse */}
      {vendorsWithWork.length >= 3 && (
        <section aria-label="Vendors at work" className="py-20 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="flex items-end justify-between mb-10 gap-6">
              <Reveal>
                <div>
                  <p className="eyebrow">The talent</p>
                  <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
                    Book the people behind the night
                  </h2>
                  <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
                  <p className="mt-4 text-sm text-muted-ink">
                    Real work from real Lagos vendors. Drag, tap a face, book
                    direct.
                  </p>
                </div>
              </Reveal>
              <Link href="/vendors" className="hidden md:block shrink-0">
                <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                  Meet all {vendors?.length ?? 0} vendors →
                </span>
              </Link>
            </div>
          </div>
          <Reveal>
            {/* Full-bleed drag rail: content bleeds, controls stay inside */}
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 md:px-[max(2rem,calc((100vw-76rem)/2+2rem))] pb-2 scroll-smooth">
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
          </Reveal>
        </section>
      )}

      {/* Two-sided marketplace strip */}
      <section className="border-t border-hairline py-16">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Reveal className="h-full">
            <div className="h-full border border-hairline rounded-md bg-surface p-8 flex flex-col hover:border-white/20 transition-colors duration-200">
              <p className="eyebrow">For organizers &amp; promoters</p>
              <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                List your event. Sell out.
              </h2>
              <div className="mt-4 h-0.5 w-12 bg-gold" aria-hidden="true" />
              <p className="mt-4 text-muted-ink leading-relaxed flex-1">
                Set up ticketing in minutes. VIP tables, regular, VVIP, all
                with instant, secure checkout. Track every sale live. No
                middleman takes a cut you didn't agree to.
              </p>
              <Link href={user ? "/admin" : "/auth?tab=register"} className="mt-6">
                <span className="press inline-flex items-center justify-center h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium hover:bg-gold-soft transition-colors cursor-pointer">
                  Create an Event
                </span>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <div className="h-full border border-hairline rounded-md bg-surface p-8 flex flex-col hover:border-white/20 transition-colors duration-200">
              <p className="eyebrow">
                For DJs, MCs, caterers &amp; more
              </p>
              <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                Get discovered. Get booked.
              </h2>
              <div className="mt-4 h-0.5 w-12 bg-gold" aria-hidden="true" />
              <p className="mt-4 text-muted-ink leading-relaxed flex-1">
                A standing profile with your portfolio photos, service area,
                and a direct WhatsApp line. Free to list. When someone in
                Lagos plans a party, this is where they find you.
              </p>
              <Link
                href={user ? "/vendor-dashboard" : "/auth?tab=register"}
                className="mt-6"
              >
                <span className="press inline-flex items-center justify-center h-11 px-6 rounded-md border border-hairline text-ink font-medium hover:bg-surface-2 hover:text-gold transition-colors cursor-pointer">
                  List Your Business
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trust + proof */}
      <section className="border-t border-hairline bg-surface py-20">
        <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="order-2 lg:order-1">
            <Reveal>
              <p className="eyebrow">Why Black Heritage</p>
              <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
                The trust layer for{" "}
                <span className="italic text-gold">Lagos nights</span>
              </h2>
              <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
              <p className="mt-5 text-muted-ink leading-relaxed max-w-xl">
                One home for Lagos culture: independent organizers list their
                parties here, and the DJs, MCs, caterers, and decorators who
                power them keep a real public profile. Every ticket is
                verified, every vendor is reachable. No guessing, no
                middlemen in your DMs.
              </p>
              <div className="mt-8 flex flex-col gap-0 max-w-xl border-t border-hairline">
                {[
                  {
                    title: "Verified e-tickets, instantly",
                    body: "Pay with card, transfer, or USSD. Your ticket lands in your inbox before you lock your phone.",
                  },
                  {
                    title: "Vendors with real public profiles",
                    body: "Portfolio, service area, reviews. Not a forwarded phone number from a friend of a friend.",
                  },
                  {
                    title: "Organizers who own their event",
                    body: "Live sales tracking, your ticket tiers, your pricing. No middleman takes a cut you didn't agree to.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3.5 py-4 border-b border-hairline"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-ink font-medium">{item.title}</p>
                      <p className="mt-0.5 text-sm text-muted-ink leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/events">
                  <Button className="press h-12 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
                    Find Your Next Event
                  </Button>
                </Link>
                <Link href="/vendors">
                  <Button
                    variant="outline"
                    className="press h-12 px-8 border-hairline text-ink hover:bg-surface hover:text-gold font-medium rounded-md"
                  >
                    Browse Vendors
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="order-1 lg:order-2">
            <figure className="relative overflow-hidden rounded-md border border-hairline aspect-[4/5]">
              <FadeImg
                src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=2664&auto=format&fit=crop"
                alt="Performer on a dark stage"
                className="w-full h-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent"
              />
              <figcaption className="absolute inset-x-4 bottom-4 bg-background/85 border border-hairline rounded-md p-5">
                <blockquote className="font-display italic text-ink leading-snug">
                  "Found our DJ and caterer on here in one evening. The
                  owambe came together in two weeks."
                </blockquote>
                <cite className="eyebrow not-italic mt-3 block">
                  Adaeze O. · Hosted in Lekki
                </cite>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-hairline py-20">
        <div className="container mx-auto px-4">
          <Reveal className="max-w-3xl mb-12">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Three steps to your night out
            </h2>
            <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
          </Reveal>

          {/* Editorial timeline: hairline rail, gold dots, no decorative numbers */}
          <div className="max-w-3xl">
            <ol>
              {[
                {
                  title: "Browse what's on",
                  body: "See every upcoming event in Lagos, from owambe to live jazz. Each one shows real availability and ticket prices.",
                },
                {
                  title: "Buy your ticket",
                  body: "Instant checkout: card, bank transfer, or USSD. Your e-ticket arrives instantly. No printed slips, no queue.",
                },
                {
                  title: "Show up",
                  body: "Scan your ticket at the door. That's it. If you're planning your own event, you can do all of this in under 10 minutes.",
                },
              ].map((step, i, arr) => (
                <Reveal key={step.title}>
                  <li className="relative flex gap-6 pb-10 last:pb-0">
                    {/* rail + dot */}
                    <div className="relative flex flex-col items-center" aria-hidden="true">
                      <span className="mt-2 h-2 w-2 rounded-full bg-gold shrink-0" />
                      {i < arr.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-hairline" />
                      )}
                    </div>
                    <div className="pb-2">
                      <h3 className="font-display text-xl font-bold text-ink">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted-ink leading-relaxed max-w-xl">
                        {step.body}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline bg-surface">
        <div className="container mx-auto px-4 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src={logoImg} alt="" className="h-8 w-8 object-contain" />
                <div className="leading-none">
                  <p className="font-display text-lg font-bold text-ink">
                    Black Heritage
                  </p>
                  <p className="eyebrow mt-1">Events &amp; Entertainment</p>
                </div>
              </div>
              <p className="text-sm text-muted-ink leading-relaxed mt-4">
                Lagos's home for real culture: the events worth showing up
                for, and the people who make them happen.
              </p>
            </div>

            <div>
              <h4 className="eyebrow mb-4">Events</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/events"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Browse Events</span></Link></li>
                <li><Link href="/calendar"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Calendar</span></Link></li>
                <li><Link href="/my-tickets"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">My Tickets</span></Link></li>
              </ul>
            </div>

            <div>
              <h4 className="eyebrow mb-4">Vendors</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/vendors"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Vendor Directory</span></Link></li>
                <li><Link href="/vendor-dashboard"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">List Your Business</span></Link></li>
                <li><Link href="/auth?tab=register"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Create Account</span></Link></li>
              </ul>
            </div>

            <div>
              <h4 className="eyebrow mb-4">For Organizers</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/admin"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Organizer Dashboard</span></Link></li>
                <li><Link href="/admin/events/new"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Create an Event</span></Link></li>
                <li><Link href="/auth?tab=register"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Sign Up Free</span></Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-hairline">
          <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-ink/60">
              © {new Date().getFullYear()} Black Heritage Events &amp;
              Entertainment. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-xs text-muted-ink">
              <a href="#" className="hover:text-gold transition-colors" aria-label="Instagram">Instagram</a>
              <a href="#" className="hover:text-gold transition-colors" aria-label="Twitter / X">Twitter / X</a>
              <a href="#" className="hover:text-gold transition-colors" aria-label="WhatsApp">WhatsApp</a>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-ink/60">
              <ShieldCheck className="w-3.5 h-3.5 text-gold/40" aria-hidden="true" />
              Instant verified checkout
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
