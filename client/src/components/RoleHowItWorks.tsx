import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Megaphone, Store, BadgePercent } from "lucide-react";
import { Reveal, EASE_OUT } from "@/components/motion";

/**
 * "How it works" that speaks to every role the platform carries. One timeline
 * per audience; the tab row switches between them. Copy stays concrete: what
 * each person does first, what they get, and what it costs them (nothing to
 * start, fees only where stated).
 */

interface RoleJourney {
  id: string;
  label: string;
  icon: typeof Ticket;
  headline: string;
  steps: { title: string; body: string }[];
  cta: { label: string; href: string };
}

const JOURNEYS: RoleJourney[] = [
  {
    id: "guests",
    label: "Guests",
    icon: Ticket,
    headline: "From scrolling to standing in the crowd",
    steps: [
      {
        title: "Find your night",
        body: "Every upcoming event in one place, with real availability and real prices. No DMs, no guesswork.",
      },
      {
        title: "Pay your way",
        body: "Card, bank transfer, or USSD. Your e-ticket with its QR code lands in your inbox before you lock your phone.",
      },
      {
        title: "Walk in",
        body: "Gate staff scan your code. No printed slips, no screenshots, no arguing at the door.",
      },
    ],
    cta: { label: "Browse Events", href: "/events" },
  },
  {
    id: "organizers",
    label: "Organizers",
    icon: Megaphone,
    headline: "Sell out your event, keep your brand",
    steps: [
      {
        title: "Create in minutes",
        body: "Upload a flyer and the form fills itself, or start from scratch. Your tiers, your prices, your table plan.",
      },
      {
        title: "Share your branded page",
        body: "Your logo and colors on your own booking link. QR tickets carry your brand, not ours, into every WhatsApp group.",
      },
      {
        title: "Track and settle",
        body: "Live sales, gate verification with your own staff codes, and payouts to your bank. Flat platform fee, no surprises.",
      },
    ],
    cta: { label: "Host an Event", href: "/organizers" },
  },
  {
    id: "vendors",
    label: "Vendors",
    icon: Store,
    headline: "A profile that books you work",
    steps: [
      {
        title: "Build your profile",
        body: "Portfolio photos, service area, starting prices, your WhatsApp line. Free to list.",
      },
      {
        title: "Get found",
        body: "Planners browsing events and the directory book you directly. No agent, no commission on your gigs.",
      },
      {
        title: "Grow your name",
        body: "Ratings from real events, a verified badge, and a page you can put on your Instagram bio.",
      },
    ],
    cta: { label: "List Your Business", href: "/vendors" },
  },
  {
    id: "brands",
    label: "Brands",
    icon: BadgePercent,
    headline: "Be part of the night, not an interruption",
    steps: [
      {
        title: "Pick your placement",
        body: "Home spotlight, category sponsorship, or event partnership. Limited slots, chosen to fit the room.",
      },
      {
        title: "We build it native",
        body: "Designed into the platform in your brand: no pop-ups, no loan-app banners, nothing that burns the audience.",
      },
      {
        title: "Reach people going out",
        body: "An audience with tickets bought and plans made. Measured placements, one conversation to book.",
      },
    ],
    cta: { label: "Partner With Us", href: "/organizers#sponsor" },
  },
];

export function RoleHowItWorks() {
  const [active, setActive] = useState("guests");
  const journey = JOURNEYS.find((j) => j.id === active)!;

  return (
    <section className="border-t border-hairline py-20">
      <div className="container mx-auto px-4">
        <Reveal className="max-w-3xl mb-10">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
            Built for everyone in the room
          </h2>
          <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
        </Reveal>

        {/* Role switcher: pill row, gold active state, instant swap */}
        <div
          role="tablist"
          aria-label="Choose your role"
          className="flex flex-wrap gap-2 mb-10"
        >
          {JOURNEYS.map(({ id, label, icon: Icon }) => {
            const selected = id === active;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(id)}
                className={`press inline-flex items-center gap-2 h-11 px-5 rounded-full border text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  selected
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "border-hairline text-muted-ink hover:text-ink hover:border-white/25"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={journey.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr] gap-10"
          >
            <div>
              <h3 className="font-display text-2xl font-bold text-ink tracking-tight">
                {journey.headline}
              </h3>
              <a href={journey.cta.href}>
                <span className="press mt-6 inline-flex items-center justify-center h-11 px-6 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-gold-soft transition-colors cursor-pointer text-sm">
                  {journey.cta.label}
                </span>
              </a>
            </div>

            {/* Editorial timeline: hairline rail, gold dots, staggered entry */}
            <ol>
              {journey.steps.map((step, i, arr) => (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 * i, ease: EASE_OUT }}
                  className="relative flex gap-6 pb-10 last:pb-0"
                >
                  <div className="relative flex flex-col items-center" aria-hidden="true">
                    <span className="mt-2 h-2 w-2 rounded-full bg-gold shrink-0" />
                    {i < arr.length - 1 && <span className="mt-1 w-px flex-1 bg-hairline" />}
                  </div>
                  <div className="pb-2">
                    <h4 className="font-display text-lg font-bold text-ink">
                      <span className="text-gold mr-2">{i + 1}.</span>
                      {step.title}
                    </h4>
                    <p className="mt-1.5 text-sm text-muted-ink leading-relaxed max-w-xl">
                      {step.body}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
