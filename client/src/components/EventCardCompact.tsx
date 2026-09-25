import { Event } from "@shared/schema";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { FadeImg } from "@/components/motion";
import { format } from "date-fns";

interface EventCardCompactProps {
  event: Event;
}

/**
 * Compact horizontal event card for the mobile feed: 96px square flyer,
 * date in the leading column, hairline detail rows, price baseline-aligned.
 * Mirrors the BookingRowsSkeleton footprint on the dashboards.
 */
export function EventCardCompact({ event }: EventCardCompactProps) {
  const ticketTypes = (() => {
    try {
      const parsed = JSON.parse(event.ticketTypes || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const availability = ticketTypes[0]
    ? ticketTypes[0].capacity - (ticketTypes[0].sold || 0) + " " + ticketTypes[0].name + " left"
    : event.capacity + " capacity";

  const price = event.price > 0 ? "₦" + (event.price / 100).toLocaleString() : "Free";
  const d = new Date(event.date);

  return (
    <Link href={"/events/" + event.id} aria-label={event.title + ", " + format(d, "EEE d MMM") + ", " + event.location + ", " + price}>
      <article className="flex gap-4 p-3 -mx-3 rounded-md active:bg-surface-2 transition-colors cursor-pointer">
        {/* Flyer thumb */}
        <div className="relative w-24 h-24 shrink-0 rounded-md overflow-hidden bg-surface-2 border border-hairline">
          <FadeImg
            src={event.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">{format(d, "EEE d MMM · h:mm a")}</p>
              <h3 className="mt-1 font-display text-base font-bold leading-snug text-ink line-clamp-2">
                {event.title}
              </h3>
            </div>
            <span className="font-display text-base text-gold shrink-0 pt-4">
              {price}
</span>
            </div>
          {/* Both middle cells carry min-w-0 so a long ticket-tier name
              ellipsises instead of widening the card and scrolling the page. */}
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-ink">
            <MapPin className="w-3 h-3 text-gold shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{event.location}</span>
            <span aria-hidden="true" className="text-muted-ink shrink-0">·</span>
            <span className="min-w-0 max-w-[62%] truncate">{availability}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
