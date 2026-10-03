import { Event } from "@shared/schema";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { FadeImg } from "@/components/motion";
import { format } from "date-fns";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  priceLabelFor,
  scarcityFor,
  socialProofFor,
  hostNameFor,
} from "@/lib/event-price";

interface EventCardProps {
  event: Event;
}

/**
 * Cover image with a graceful fallback: a dead URL (expired CDN link,
 * host block) must never render as a broken image frame.
 */
function EventImage({ event }: { event: Event }) {
  const [failed, setFailed] = useState(false);
  if (failed || !event.imageUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-surface-2">
        <CalendarDays className="w-10 h-10 text-gold/40" aria-hidden="true" />
        <span className="text-xs text-muted-ink">Flyer coming soon</span>
      </div>
    );
  }
  return (
    <FadeImg
      src={event.imageUrl}
      alt={event.title}
      data-motion="scale-on-hover"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
    />
  );
}

/** The one scarcity pill skin. Gold only when the event is genuinely hot. */
const SCARCITY_SKIN = {
  hot: "border-gold/40 text-gold",
  warm: "border-white/15 text-ink/85",
} as const;

/**
 * Editorial event card: the flyer is the hero (full-bleed, portrait),
 * hairline border, no card shadow, hover = photo scale + title color only.
 * See DESIGN.md.
 *
 * The footer states one number and one truth: what the cheapest ticket costs,
 * and (only when it is real) how close the room is to full. Available seats
 * are deliberately not printed — "620 left" is volume, not urgency, and the
 * organizer can switch counts off entirely from event settings.
 */
export function EventCard({ event }: EventCardProps) {
  const priceLabel = priceLabelFor(event);
  const scarcity = scarcityFor(event);
  const going = socialProofFor(event);
  const host = hostNameFor(event);
  const soldOut = priceLabel === "Sold out";

  return (
    <Link href={"/events/" + event.id}>
      <article className="group relative overflow-hidden rounded-md bg-surface border border-hairline hover:border-white/20 transition-colors duration-200 h-full flex flex-col cursor-pointer">
        {/* The flyer is the hero */}
        <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
          <EventImage event={event} />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent"
          />
          <span className="absolute bottom-3 left-4 text-[11px] font-bold tracking-[0.18em] uppercase text-ink/80">
            {format(new Date(event.date), "EEE d MMM")}
          </span>
          {scarcity && (
            <span
              className={cn(
                "absolute top-3 left-3 rounded-full border bg-background/85 backdrop-blur-md px-3 py-1 text-[11px] font-semibold shadow-lg",
                SCARCITY_SKIN[scarcity.tone],
              )}
            >
              {scarcity.label}
            </span>
          )}
          {soldOut && (
            <span className="absolute top-3 right-3 rounded-full border border-hairline bg-background/85 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-muted-ink">
              Sold out
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-grow p-5">
          <h3 className="font-display text-xl font-bold leading-snug text-ink line-clamp-2 transition-colors duration-200 group-hover:text-gold">
            {event.title}
          </h3>

          {host && (
            <p className="mt-1.5 text-[13px] font-medium text-muted-ink truncate">
              {host}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2 text-sm text-muted-ink">
            <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>

          <div className="mt-auto pt-4 border-t border-hairline flex items-baseline justify-between gap-3">
            <span
              className={cn(
                "font-display text-lg whitespace-nowrap",
                soldOut ? "text-muted-ink" : "text-ink",
              )}
            >
              {priceLabel}
            </span>
            {going && <span className="eyebrow whitespace-nowrap">{going}</span>}
          </div>
        </div>
      </article>
    </Link>
  );
}
