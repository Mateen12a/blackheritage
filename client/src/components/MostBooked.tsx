import { Event } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";
import { Reveal } from "@/components/motion";
import { parseTiers, priceLabelFor, hostNameFor } from "@/lib/event-price";

/**
 * Fill rate for one event, or null when there is nothing honest to publish:
 * no tier carries a real capacity, nothing has sold yet, or the organizer
 * turned remaining counts off for the event.
 */
export function fillRateFor(event: Event): number | null {
  if ((event as any).showRemainingCounts === false) return null;

  const tiers = parseTiers(event).filter(
    (t) => t.saleOpen !== false && Number(t.capacity || 0) > 0,
  );
  const capacity = tiers.reduce((sum, t) => sum + Number(t.capacity || 0), 0);
  const sold = tiers.reduce(
    (sum, t) => sum + Math.min(Number(t.sold || 0), Number(t.capacity || 0)),
    0,
  );

  if (capacity <= 0 || sold <= 0) return null;
  return Math.round((sold / capacity) * 100);
}

/**
 * The events people are actually buying, in order. Sorted by fill rate from
 * the organizers' own tier data, so the top row is the room filling fastest.
 * Below three entries this renders nothing: two rows is not a ranking, and
 * padding it would be a lie.
 */
export function MostBooked({ events, limit = 5 }: { events: Event[]; limit?: number }) {
  const ranked = events
    .map((event) => ({ event, pct: fillRateFor(event) }))
    .filter((row): row is { event: Event; pct: number } => row.pct !== null)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);

  if (ranked.length < 3) return null;

  return (
    <section className="border-t border-hairline py-14 md:py-16">
      <div className="container mx-auto px-4">
        <Reveal>
          <div className="flex items-end justify-between gap-6 mb-9">
            <div>
              <p className="eyebrow">By seats sold</p>
              <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
                Filling up fastest
              </h2>
              <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
              <p className="mt-4 text-sm text-muted-ink max-w-xl">
                Ordered by how full each room is, using the ticket tiers the
                organizers set.
              </p>
            </div>
            <Link href="/events" className="hidden md:block shrink-0">
              <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                See all events →
              </span>
            </Link>
          </div>
        </Reveal>

        <ol className="border-t border-hairline">
          {ranked.map(({ event, pct }, i) => {
            const host = hostNameFor(event);
            const price = priceLabelFor(event);
            return (
              <li key={event.id} className="border-b border-hairline">
                <Link href={"/events/" + event.id}>
                  <article className="group py-3.5 md:py-4 cursor-pointer">
                    <div className="flex items-center gap-3 md:gap-5">
                      {/* The rank is a real order, so it is a real numeral:
                          plain, dimmed, never gold. */}
                      <span
                        aria-hidden="true"
                        className="w-4 md:w-6 shrink-0 font-display text-sm md:text-base font-bold leading-none text-ink/30 tabular-nums"
                      >
                        {i + 1}
                      </span>

                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-11 w-11 md:h-16 md:w-16 shrink-0 rounded-md object-cover border border-hairline bg-surface-2"
                        />
                      ) : (
                        <div className="h-11 w-11 md:h-16 md:w-16 shrink-0 rounded-md border border-hairline bg-surface-2" />
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-base md:text-lg font-bold text-ink line-clamp-2 md:line-clamp-1 transition-colors duration-200 group-hover:text-gold">
                          {event.title}
                        </h3>
                        <p className="eyebrow mt-1.5 truncate">
                          {host ? host + " · " : ""}
                          {format(new Date(event.date), "EEE d MMM")}
                        </p>
                      </div>

                      {/* Desktop: price and fill in a column on the right. */}
                      <div className="hidden md:block shrink-0 text-right">
                        <p className="font-display text-base text-ink whitespace-nowrap">
                          {price}
                        </p>
                        <p className="eyebrow mt-1.5 tabular-nums">{pct}% full</p>
                      </div>
                    </div>

                    {/* Phone: the same numbers as a fill bar across the row.
                        Two right-hand columns on a 390px screen left the title
                        about 120px and truncated almost every one of them. */}
                    <div className="mt-2.5 flex items-center gap-2.5 md:hidden">
                      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-gold"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-gold tabular-nums">
                        {pct}%
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-muted-ink">
                        {price}
                      </span>
                    </div>
                  </article>
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="mt-7 md:hidden">
          <Link href="/events">
            <span className="press flex h-12 items-center justify-center rounded-full border border-hairline text-sm font-medium text-ink hover:bg-surface-2 hover:text-gold transition-colors cursor-pointer">
              See all events
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
