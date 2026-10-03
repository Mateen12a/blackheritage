import { Event } from "@shared/schema";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { FadeImg } from "@/components/motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { priceLabelFor, scarcityFor, hostNameFor } from "@/lib/event-price";

interface EventCardCompactProps {
  event: Event;
}

/**
 * Compact horizontal event card for the mobile feed: 96px square flyer,
 * date in the leading column, hairline detail rows, price baseline-aligned.
 * Mirrors the BookingRowsSkeleton footprint on the dashboards.
 *
 * The trailing detail is a priority list, not a dump: scarcity when the event
 * is genuinely filling up, otherwise the host (a real reason to follow them),
 * and nothing at all when we know neither.
 */
export function EventCardCompact({ event }: EventCardCompactProps) {
  const priceLabel = priceLabelFor(event);
  const scarcity = scarcityFor(event);
  const host = hostNameFor(event);
  const soldOut = priceLabel === "Sold out";
  const d = new Date(event.date);

  return (
    <Link
      href={"/events/" + event.id}
      aria-label={`${event.title}, ${format(d, "EEE d MMM")}, ${event.location}, ${priceLabel}`}
    >
      <article className="flex gap-3 sm:gap-4 p-2.5 sm:p-3 -mx-2.5 sm:-mx-3 rounded-md active:bg-surface-2 transition-colors cursor-pointer">
        {/* Flyer thumb. Fluid 20/24 width to preserve text space on narrow screens */}
        <div className="relative w-20 min-[360px]:w-24 aspect-[4/5] shrink-0 rounded-md overflow-hidden bg-surface-2 border border-hairline">
          <FadeImg
            src={event.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          {soldOut && (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-background/70 backdrop-blur-[1px] flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-ink"
            >
              Sold out
            </span>
          )}
        </div>

        {/* Details: Date & Price lead row 1, Title gets full width on row 2 */}
        <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="eyebrow text-[10px] min-[360px]:text-[11px] truncate">
                {format(d, "EEE d MMM · ha")}
              </p>
              <span
                className={cn(
                  "font-display text-xs min-[360px]:text-sm shrink-0 whitespace-nowrap",
                  soldOut ? "text-muted-ink" : "text-gold font-semibold",
                )}
              >
                {priceLabel}
              </span>
            </div>
            <h3 className="mt-1 font-display text-[14px] min-[360px]:text-base font-bold leading-snug text-ink line-clamp-2 group-hover:text-gold transition-colors">
              {event.title}
            </h3>
          </div>

          <div className="mt-1.5 min-w-0 text-xs text-muted-ink">
            <div className="flex min-w-0 items-center gap-1.5">
              <MapPin className="w-3 h-3 text-gold shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{event.location}</span>
              {scarcity && (
                <span
                  className={cn(
                    "shrink-0 font-medium text-[10px] min-[360px]:text-[11px]",
                    scarcity.tone === "hot" ? "text-gold" : "text-ink/85",
                  )}
                >
                  {scarcity.label}
                </span>
              )}
            </div>
            {host && <p className="mt-0.5 truncate text-[11px] text-muted-ink/80">{host}</p>}
          </div>
        </div>
      </article>
    </Link>
  );
}
