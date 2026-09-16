import { Event } from "@shared/schema";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { FadeImg } from "@/components/motion";
import { format } from "date-fns";

interface EventCardProps {
  event: Event;
}

/**
 * Editorial event card: the flyer is the hero (full-bleed, portrait),
 * hairline border, no card shadow, hover = photo scale + title color only.
 * See DESIGN.md.
 */
export function EventCard({ event }: EventCardProps) {
  const ticketTypes = (() => {
    try {
      const parsed = JSON.parse(event.ticketTypes || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const availability = (() => {
    if (ticketTypes.length > 0) {
      const type = ticketTypes[0];
      return type.capacity - (type.sold || 0) + " " + type.name + " left";
    }
    return event.capacity + " capacity";
  })();

  const price =
    event.price > 0 ? "₦" + (event.price / 100).toLocaleString() : "Free";

  return (
    <Link href={"/events/" + event.id}>
      <article className="group relative overflow-hidden rounded-md bg-surface border border-hairline hover:border-white/20 transition-colors duration-200 h-full flex flex-col cursor-pointer">
        {/* The flyer is the hero */}
        <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
          <FadeImg
            src={event.imageUrl}
            alt={event.title}
            data-motion="scale-on-hover"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent"
          />
          <span className="absolute bottom-3 left-4 text-[11px] font-bold tracking-[0.18em] uppercase text-ink/80">
            {format(new Date(event.date), "EEE d MMM")}
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-grow p-5">
          <h3 className="font-display text-xl font-bold leading-snug text-ink line-clamp-2 transition-colors duration-200 group-hover:text-gold">
            {event.title}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-ink">
            <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>

          <div className="mt-auto pt-4 border-t border-hairline flex items-baseline justify-between gap-3">
            <span className="font-display text-lg text-ink">{price}</span>
            <span className="eyebrow">{availability}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
