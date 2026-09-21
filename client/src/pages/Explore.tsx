import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { useVendors } from "@/hooks/use-vendors";
import { EventCardCompact } from "@/components/EventCardCompact";
import { VendorCard } from "@/components/VendorCard";
import { HeaderSkeleton, LoadError } from "@/components/AsyncStates";
import { Search, CalendarDays, MapPin } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { FadeImg } from "@/components/motion";
import { format } from "date-fns";
import { useMemo, useState } from "react";

/**
 * App-style Explore: large title, always-present search, category chips,
 * then a vertical event feed with a vendor rail. Eventbrite/Partyverse
 * structure; DESIGN.md surface (large Playfair title, gold chips, hairlines).
 * Desktop keeps the same feed in a centered column.
 */

type Category = { key: string; label: string };

const CATEGORIES: Category[] = [
  { key: "all", label: "All" },
  { key: "week", label: "This week" },
  { key: "free", label: "Free" },
  { key: "under10k", label: "Under ₦10k" },
  { key: "featured", label: "Featured" },
];

function matchesCategory(event: any, key: string): boolean {
  switch (key) {
    case "week": {
      const inOneWeek = Date.now() + 7 * 24 * 60 * 60 * 1000;
      return new Date(event.date).getTime() <= inOneWeek;
    }
    case "free":
      return event.price === 0;
    case "under10k":
      return event.price > 0 && event.price <= 1000000;
    case "featured":
      return !!event.isFeatured;
    default:
      return true;
  }
}

export default function Explore() {
  const { user } = useAuth();
  const { data: events, isLoading, isError, refetch } = useEvents();
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    if (!events) return [];
    const term = search.trim().toLowerCase();
    return events
      .filter((e) => matchesCategory(e, category))
      .filter(
        (e) =>
          !term ||
          e.title.toLowerCase().includes(term) ||
          e.description.toLowerCase().includes(term) ||
          e.location.toLowerCase().includes(term)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, search, category]);

  const featured = useMemo(
    () => events?.filter((e) => e.isFeatured).slice(0, 2) ?? [],
    [events]
  );
  const spotlight = featured[0];
  const vendorRail = vendors?.filter((v) => v.status === "published") ?? [];

  if (isLoading) {
    return (
      <div>
        <HeaderSkeleton bare />
        <div className="mt-8 space-y-6" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-24 h-24 rounded-md bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-2.5 py-2">
                <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Large title + search — sticky search collapses under the title on scroll */}
      <div className="pt-2">
        <p className="eyebrow">Welcome back, {user?.username}</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-ink tracking-tight">
          Explore
        </h1>

        <div className="relative mt-5">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-ink w-5 h-5 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            placeholder="Search events or venues"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search events"
            enterKeyHint="search"
            className="w-full h-12 pl-12 bg-surface-2 border border-hairline rounded-full text-ink text-base placeholder:text-muted-ink focus-visible:border-gold focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Category chips — horizontally scrollable, gold when active */}
      <div
        role="group"
        aria-label="Filter events"
        className="-mx-4 px-4 md:mx-0 md:px-0 mt-4 pb-1 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(c.key)}
              className={
                "shrink-0 h-9 px-4 rounded-full border text-sm font-medium transition-colors duration-200 " +
                (active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-ink border-hairline hover:border-gold/40 hover:text-ink")
              }
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {isError ? (
        <div className="mt-8">
          <LoadError
            title="Couldn't load events"
            message="Check your connection and try again."
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <>
          {/* Featured spotlight — photo-led card, leads the feed */}
          {spotlight && !search && category === "all" && (
            <Link
              href={"/events/" + spotlight.id}
              className="block mt-6 group"
              aria-label={"Featured: " + spotlight.title}
            >
              <div className="relative overflow-hidden rounded-md border border-hairline">
                <div className="aspect-[16/9] md:aspect-[21/9] bg-surface-2">
                  <FadeImg
                    src={spotlight.imageUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"
                />
                <div className="absolute bottom-0 inset-x-0 p-4 md:p-6">
                  <span className="eyebrow text-gold">Featured</span>
                  <h2 className="mt-1 font-display text-2xl md:text-3xl font-bold text-ink leading-tight">
                    {spotlight.title}
                  </h2>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                      {format(new Date(spotlight.date), "EEE d MMM")}
                    </span>
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-gold shrink-0" aria-hidden="true" />
                      <span className="truncate">{spotlight.location}</span>
                    </span>
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Event feed */}
          <section className="mt-7" aria-label="Upcoming events">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-xl font-bold text-ink">
                {search ? "Results" : "Upcoming"}
              </h2>
              <span className="text-xs text-muted-ink">
                {filtered.length} {filtered.length === 1 ? "event" : "events"}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <h3 className="font-display text-lg font-bold text-ink mb-1.5">
                  Nothing matches that yet
                </h3>
                <p className="text-sm text-muted-ink">
                  Try another search, or clear the filters to see everything on sale.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {filtered.map((event) => (
                  <div key={event.id} className="py-3">
                    <EventCardCompact event={event} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Vendor rail — full cards, peeking 24px past the scroll edge */}
          <section className="mt-10" aria-label="Vendors to book">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-xl font-bold text-ink">Vendors</h2>
              <span className="text-xs text-muted-ink">
                {vendorsLoading ? "Loading" : vendorRail.length + " listed"}
              </span>
            </div>
            <div className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {vendorRail.slice(0, 10).map((v) => (
                <div key={v.id} className="w-56 shrink-0 snap-start">
                  <VendorCard vendor={v} />
                </div>
              ))}
              {vendorRail.length === 0 && !vendorsLoading && (
                <p className="text-sm text-muted-ink py-4">No vendors listed yet.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
