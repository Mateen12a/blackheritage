import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { useVendors } from "@/hooks/use-vendors";
import { EventCardCompact } from "@/components/EventCardCompact";
import { VendorCard } from "@/components/VendorCard";
import { HeaderSkeleton, LoadError } from "@/components/AsyncStates";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, CalendarDays, MapPin } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { FadeImg } from "@/components/motion";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { NativeSponsorSpotlight } from "@/components/NativeSponsorSpotlight";
import { stateForLocation, stateOptionsForEvents } from "@/lib/nigeria";
import { cn } from "@/lib/utils";

/**
 * App-style Explore: large title, always-present search, one merged filter
 * row (when / type / where — the same shape as the public Events page),
 * then a vertical event feed with a vendor rail. Eventbrite/Partyverse
 * structure; DESIGN.md surface (large Playfair title, gold chips, hairlines).
 * Desktop keeps the same feed in a centered column.
 */

type QuickFilter = "all" | "tonight" | "week" | "free" | "under10k" | "featured";
type TypeFilter = "all" | string;

const QUICK_FILTERS: { key: Exclude<QuickFilter, "all">; label: string }[] = [
  { key: "tonight", label: "Tonight" },
  { key: "week", label: "This week" },
  { key: "free", label: "Free" },
  { key: "under10k", label: "Under ₦10k" },
  { key: "featured", label: "Featured" },
];

const EVENT_TYPE_FILTERS: { key: Exclude<TypeFilter, "all">; label: string }[] = [
  { key: "party", label: "Parties" },
  { key: "concert", label: "Concerts" },
  { key: "festival", label: "Festivals" },
  { key: "brunch", label: "Brunches" },
  { key: "wedding", label: "Weddings" },
  { key: "corporate", label: "Corporate" },
  { key: "comedy_show", label: "Comedy" },
];

function matchesQuick(event: any, key: QuickFilter): boolean {
  switch (key) {
    case "tonight": {
      const eventDate = new Date(event.date);
      const now = new Date();
      const isSameDay =
        eventDate.getFullYear() === now.getFullYear() &&
        eventDate.getMonth() === now.getMonth() &&
        eventDate.getDate() === now.getDate();
      const diffHours = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      return isSameDay || (diffHours >= 0 && diffHours <= 18);
    }
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

function matchesType(event: any, key: TypeFilter): boolean {
  if (key === "all") return true;
  return (event.eventType || "party") === key;
}

const chipClass = (selected: boolean) =>
  cn(
    "shrink-0 h-9 px-4 rounded-full border text-sm font-medium transition-colors duration-200",
    selected
      ? "bg-primary text-primary-foreground border-primary"
      : "bg-transparent text-muted-ink border-hairline hover:border-gold/40 hover:text-ink",
  );

export default function Explore() {
  const { user } = useAuth();
  const { data: events, isLoading, isError, refetch } = useEvents();
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const [search, setSearch] = useState("");
  const [stateKey, setStateKey] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(() => {
    if (!events) return [];
    const term = search.trim().toLowerCase();
    return events
      .filter((e) => stateKey === "all" || stateForLocation(e.location)?.key === stateKey)
      .filter((e) => matchesQuick(e, quickFilter))
      .filter((e) => matchesType(e, typeFilter))
      .filter(
        (e) =>
          !term ||
          e.title.toLowerCase().includes(term) ||
          e.description.toLowerCase().includes(term) ||
          e.location.toLowerCase().includes(term)
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, search, stateKey, quickFilter, typeFilter]);

  const stateOptions = useMemo(() => stateOptionsForEvents(events), [events]);
  const selectedState = stateOptions.find((option) => option.key === stateKey) ?? null;
  const browsingOneState = stateKey !== "all" && !search && quickFilter === "all" && typeFilter === "all";
  const anyFilterActive = quickFilter !== "all" || typeFilter !== "all" || stateKey !== "all";
  const clearAllFilters = () => {
    setQuickFilter("all");
    setTypeFilter("all");
    setStateKey("all");
  };

  // The hero follows the filter. Picking a state should change the page, not
  // only the list under it, so the state view leads with that state's featured
  // event and falls back to its next event.
  const spotlight = useMemo(() => {
    if (search || quickFilter !== "all" || typeFilter !== "all") return null;
    const pool = stateKey === "all" ? events ?? [] : filtered;
    return pool.find((e) => e.isFeatured) ?? (stateKey === "all" ? null : pool[0] ?? null);
  }, [events, filtered, stateKey, search, quickFilter, typeFilter]);

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
      {/* Large title + search: sticky search collapses under the title on scroll */}
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
            placeholder="Search events or venues across Nigeria"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search events"
            enterKeyHint="search"
            className="w-full h-12 pl-12 bg-surface-2 border border-hairline rounded-full text-ink text-base placeholder:text-muted-ink focus-visible:border-gold focus-visible:ring-0"
          />
        </div>
      </div>

      {/* One merged filter row, led by an "All" that resets every group:
          when / type / where share a single scroller like the public Events
          page, so filtering never teaches two different patterns. */}
      <div
        role="group"
        aria-label="Event filters"
        className="-mx-4 px-4 md:mx-0 md:px-0 mt-4 pb-1 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap"
      >
        <button
          type="button"
          aria-pressed={!anyFilterActive}
          onClick={clearAllFilters}
          className={chipClass(!anyFilterActive)}
        >
          All
        </button>

        <div role="group" aria-label="Filter by date" className="contents">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={quickFilter === f.key}
              onClick={() => setQuickFilter((current) => (current === f.key ? "all" : f.key))}
              className={chipClass(quickFilter === f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span aria-hidden="true" className="shrink-0 h-6 w-px bg-hairline" />

        <div role="group" aria-label="Filter by event type" className="contents">
          {EVENT_TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={typeFilter === f.key}
              onClick={() => setTypeFilter((current) => (current === f.key ? "all" : f.key))}
              className={chipClass(typeFilter === f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span aria-hidden="true" className="shrink-0 h-6 w-px bg-hairline" />

        {/* Where: only states with events on sale, with counts, so the row
            never offers a filter that leads nowhere. */}
        <div role="group" aria-label="Filter by state" className="contents">
          {stateOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={stateKey === option.key}
              onClick={() => setStateKey((current) => (current === option.key ? "all" : option.key))}
              className={cn(chipClass(stateKey === option.key), "inline-flex items-center gap-1.5")}
            >
              {option.name}
              <span className="opacity-60">{option.count}</span>
            </button>
          ))}
        </div>
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
          {spotlight && (
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
                  {browsingOneState && selectedState
                    ? `${selectedState.name} has nothing on sale yet`
                    : "Nothing matches that yet"}
                </h3>
                <p className="text-sm text-muted-ink">
                  {browsingOneState && selectedState
                    ? "Events show up here the moment an organizer publishes one."
                    : "Try another search, or clear the filters to see everything on sale."}
                </p>
                {stateKey !== "all" && (
                  <button
                    type="button"
                    onClick={() => setStateKey("all")}
                    className="press mt-5 inline-flex items-center h-10 px-5 rounded-full border border-hairline text-sm font-medium text-ink hover:border-gold/50 hover:text-gold transition-colors"
                  >
                    See every state
                  </button>
                )}
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

          {/* Native Partner Spotlight */}
          <div className="mt-8">
            <NativeSponsorSpotlight placement="explore_feed" />
          </div>

          {/* Vendor rail — full cards, peeking 24px past the scroll edge */}
          <section className="mt-10" aria-label="Vendors to book">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-xl font-bold text-ink">Vendors</h2>
              <div className="text-xs text-muted-ink">
                {vendorsLoading ? (
                  <Skeleton className="h-3 w-16" />
                ) : (
                  vendorRail.length + " listed"
                )}
              </div>
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
