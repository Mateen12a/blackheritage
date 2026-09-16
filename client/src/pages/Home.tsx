import { EventCard } from "@/components/EventCard";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Reveal, FadeImg } from "@/components/motion";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";
import logoImg from "../assets/logo.png";

/**
 * Animated heading: each character staggers in.
 */
function AnimatedHeading() {
  const line1 = "Heritage ";
  const line2 = "& Vibes";
  const allChars = line1.split("").concat(line2.split(""));

  return (
    <h1 className="mt-4 font-display text-5xl md:text-7xl font-bold text-ink leading-[1.05] tracking-tight max-w-3xl">
      {allChars.map((char, i) => {
        const isGold = i >= line1.length;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: 0.12 + i * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={isGold ? "italic text-gold" : ""}
            style={{ display: "inline-block", whiteSpace: char === " " ? "pre" : undefined }}
          >
            {char}
          </motion.span>
        );
      })}
    </h1>
  );
}

export default function Home() {
  const { data: events, isLoading } = useEvents();
  const { user } = useAuth();

  const featuredEvents =
    events?.filter((e) => e.isFeatured).slice(0, 3) ||
    events?.slice(0, 3);

  const dashboardHref =
    user?.role === "admin" || user?.role === "organizer" || user?.isAdmin
      ? "/admin"
      : user?.role === "vendor"
        ? "/vendor-dashboard"
        : "/dashboard";

  return (
    <div className="min-h-screen">
      {/* ─── Hero ─── */}
      <section className="relative flex min-h-screen items-end overflow-hidden -mt-[7rem]">
        {/* Background layers */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          {/* Main photo with ken-burns */}
          <img
            src="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=2670&auto=format&fit=crop"
            alt=""
            loading="eager"
            data-motion="kenburns"
            className="w-full h-full object-cover animate-kenburns"
          />

          {/* Living gradient — slow-moving warm overlay that gives the hero
              a sense of energy without being a particle system or AI slop.
              Shifts position over 12s, colors drawn from the brand palette. */}
          <div
            className="absolute inset-0 animate-hero-glow mix-blend-overlay opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 80%, rgba(227,178,60,0.25) 0%, transparent 70%), " +
                "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(180,80,40,0.15) 0%, transparent 60%)",
            }}
          />

          {/* Bottom gradient — deep enough to make text readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />

          {/* Extra bottom scrim for text legibility on any background */}
          <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-gradient-to-t from-background via-background/90 to-transparent" />
        </div>

        <div className="container relative z-10 px-4 pb-24 pt-32">
          <Reveal y={16} duration={0.55}>
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold">
              Lagos · Parties · Concerts · Culture
            </p>
          </Reveal>

          <AnimatedHeading />

          <Reveal y={16} delay={0.4} duration={0.6}>
            <p className="mt-5 max-w-xl text-lg text-white/80 leading-relaxed">
              The Lagos marketplace for nights out and the people who make
              them. Concert tickets in seconds, plus vetted DJs, caterers, and
              decorators when you're the one throwing the party.
            </p>
          </Reveal>
          <Reveal y={12} delay={0.5} duration={0.55}>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link href="/events">
                <Button className="press h-12 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
                  Find Events Tonight
                </Button>
              </Link>
              <Link href="/vendors">
                <Button
                  variant="outline"
                  className="press h-12 px-8 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-gold font-medium rounded-md backdrop-blur-sm"
                >
                  Hire a Vendor
                </Button>
              </Link>
              {user && (
                <Link href={dashboardHref}>
                  <Button
                    variant="outline"
                    className="press h-12 px-8 border-gold/40 bg-gold/5 text-gold hover:bg-gold/10 font-medium rounded-md"
                  >
                    My Dashboard →
                  </Button>
                </Link>
              )}
            </div>
          </Reveal>
          <Reveal y={10} delay={0.58} duration={0.5}>
            <p className="mt-6 flex items-center gap-2 text-sm text-white/50">
              <ShieldCheck className="w-4 h-4 text-gold" aria-hidden="true" />
              Secure checkout via Paystack: card, transfer, or USSD.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── Featured events ─── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10 gap-6">
            <Reveal>
              <div>
                <p className="eyebrow">On sale now</p>
                <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
                  This Week in Lagos
                </h2>
                <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
                <p className="mt-4 text-sm text-muted-ink">
                  {featuredEvents?.length ?? 0}
                  {featuredEvents?.length === 1 ? " event" : " events"} on
                  sale — the good ones sell out first.
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

      {/* ─── Two-sided marketplace strip ─── */}
      <section className="border-t border-hairline py-16">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Reveal className="h-full">
            <div className="h-full border border-hairline rounded-md bg-surface p-8 flex flex-col">
              <p className="eyebrow">For organizers &amp; promoters</p>
              <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                List your event. Sell out.
              </h2>
              <div className="mt-4 h-0.5 w-12 bg-gold" aria-hidden="true" />
              <p className="mt-4 text-muted-ink leading-relaxed flex-1">
                Set up ticketing in minutes — VIP tables, regular, VVIP — with
                secure Paystack checkout. Track every sale live. No middleman
                takes a cut you didn't agree to.
              </p>
              <Link href={user ? "/admin" : "/auth?tab=register"} className="mt-6">
                <span className="press inline-flex items-center justify-center h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium hover:bg-gold-soft transition-colors cursor-pointer">
                  Create an Event
                </span>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="h-full">
            <div className="h-full border border-hairline rounded-md bg-surface p-8 flex flex-col">
              <p className="eyebrow">
                For DJs, MCs, caterers &amp; more
              </p>
              <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-ink tracking-tight">
                Get booked on your work
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

      {/* ─── Trust + proof ─── */}
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

      {/* ─── How it works ─── */}
      <section className="border-t border-hairline py-20">
        <div className="container mx-auto px-4">
          <Reveal className="max-w-3xl mb-12">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
              Three steps to your night out
            </h2>
            <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "Browse what's on",
                body: "See every upcoming event in Lagos — from owambe to live jazz. Each one shows real availability and ticket prices.",
              },
              {
                num: "02",
                title: "Buy your ticket",
                body: "Paystack checkout: card, bank transfer, or USSD. Your e-ticket arrives instantly. No printed slips, no queue.",
              },
              {
                num: "03",
                title: "Show up",
                body: "Scan your ticket at the door. That's it. If you're planning your own event, you can do all of this in under 10 minutes.",
              },
            ].map((step) => (
              <Reveal key={step.num}>
                <div className="border border-hairline rounded-md bg-surface p-7">
                  <span className="font-display text-4xl font-bold text-gold/30">
                    {step.num}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold text-ink">
                    {step.title}
                  </h3>
                  <div className="mt-3 h-0.5 w-8 bg-gold" aria-hidden="true" />
                  <p className="mt-4 text-sm text-muted-ink leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
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
                Lagos's home for real culture — the events worth showing up
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
              Paystack-secured checkout
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
