import { EventCard } from "@/components/EventCard";
import { EventCardCompact } from "@/components/EventCardCompact";
import { useEvents } from "@/hooks/use-events";
import { Reveal } from "@/components/motion";
import { Search } from "lucide-react";
import { DirectorySkeleton } from "@/components/AsyncStates";
import { StateFilter } from "@/components/StateFilter";
import { stateForLocation, stateOptionsForEvents } from "@/lib/nigeria";
import { useSearch } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type QuickFilter = "all" | "tonight" | "week" | "free" | "under10k";

type TypeFilter = "all" | string;

const EVENT_TYPE_FILTERS: { key: Exclude<TypeFilter, "all"> | "all"; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "party", label: "Parties" },
  { key: "concert", label: "Concerts" },
  { key: "festival", label: "Festivals" },
  { key: "brunch", label: "Brunches" },
  { key: "wedding", label: "Weddings" },
  { key: "corporate", label: "Corporate" },
  { key: "comedy_show", label: "Comedy" },
];

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tonight", label: "Tonight" },
  { key: "week", label: "This week" },
  { key: "free", label: "Free" },
  { key: "under10k", label: "Under ₦10k" },
];

export default function Events() {
  const { data: events, isLoading } = useEvents();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [stateKey, setStateKey] = useState("all");
  const rawSearch = useSearch();
  const searchParams = new URLSearchParams(rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch);
  const filterParam = searchParams.get("filter") as QuickFilter | null;

  const [quickFilter, setQuickFilter] = useState<QuickFilter>(
    filterParam && ["all", "tonight", "week", "free", "under10k"].includes(filterParam)
      ? filterParam
      : "all"
  );

  useEffect(() => {
    if (filterParam && ["all", "tonight", "week", "free", "under10k"].includes(filterParam)) {
      setQuickFilter(filterParam);
    }
  }, [filterParam]);

  const stateOptions = useMemo(() => stateOptionsForEvents(events), [events]);

  const filteredEvents = events?.filter((event) => {
    if (stateKey !== "all" && stateForLocation(event.location)?.key !== stateKey) {
      return false;
    }
    if (typeFilter !== "all") {
      const t = (event as any).eventType;
      const label = (event as any).eventTypeLabel;
      if (t === "other") {
        if (!label || !label.toLowerCase().includes("")) return false;
      } else if (t !== typeFilter) {
        return false;
      }
    }
    const term = search.toLowerCase();
    const matchesSearch =
      event.title.toLowerCase().includes(term) ||
      event.description.toLowerCase().includes(term) ||
      event.location.toLowerCase().includes(term);

    const matchesQuick = (() => {
      switch (quickFilter) {
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
        default:
          return true;
      }
    })();

    return matchesSearch && matchesQuick;
  });

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pt-6 pb-24">
        {/* Editorial header — left-anchored, solid gold rule */}
        <Reveal className="max-w-3xl mb-12">
          <p className="eyebrow">Lagos &amp; beyond</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink tracking-tight">
            Upcoming Events
          </h1>
          <div className="mt-5 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-5 text-lg text-muted-ink max-w-xl leading-relaxed hidden md:block">
            {events?.length ?? 0}
            {events?.length === 1 ? " show" : " shows"} on sale across Lagos:
            afrobeats nights, live jazz, food fests, and everything in between.
            Instant confirmation, verified entry.
          </p>
        </Reveal>

        {/* Quiet search well */}
        <div className="max-w-2xl mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-ink w-5 h-5 pointer-events-none" />
            <Input
              placeholder="Try “afrobeats”, “jazz”, or “Lekki”..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search events"
              className="w-full h-12 pl-12 bg-surface-2 border border-hairline rounded-full text-ink text-base placeholder:text-muted-ink focus-visible:border-gold focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Quick filters — quiet pills, gold only when active */}
        <div
          className="flex gap-2 mb-12 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap"
          role="group"
          aria-label="Quick filters"
        >
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={quickFilter === f.key}
              onClick={() => setQuickFilter(f.key)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200",
                quickFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-ink border-hairline hover:border-white/30 hover:text-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Event type filters — same pill language, second row */}
        <div
          className="flex gap-2 mb-12 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap"
          role="group"
          aria-label="Filter by event type"
        >
          {EVENT_TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={typeFilter === f.key}
              onClick={() => setTypeFilter(f.key)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200",
                typeFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-ink border-hairline hover:border-white/30 hover:text-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Where: states that have events on sale, with counts, so the row
            never offers a filter that leads nowhere. */}
        <StateFilter
          className="mb-12"
          options={stateOptions}
          value={stateKey}
          onChange={setStateKey}
          allCount={events?.length ?? 0}
        />

        {/* Grid */}
        {isLoading ? (
          <DirectorySkeleton count={6} label="Loading events" />
        ) : (
          <>
            {/* Compact feed on mobile, editorial grid from sm up */}
            <div className="divide-y divide-hairline md:hidden">
              {filteredEvents?.map((event) => (
                <div key={event.id} className="py-3">
                  <EventCardCompact event={event} />
                </div>
              ))}
            </div>
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents?.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </>
        )}

        {!isLoading && filteredEvents?.length === 0 && (
          <div className="text-center py-24 border border-hairline rounded-md bg-surface">
            <h2 className="font-display text-xl font-bold text-ink mb-2">
              {quickFilter === "tonight"
                ? "No shows scheduled for tonight"
                : "Nothing matches that yet"}
            </h2>
            <p className="text-muted-ink">
              {quickFilter === "tonight" ? (
                <>
                  Nothing is kicking off tonight just yet. Check{" "}
                  <button
                    type="button"
                    onClick={() => setQuickFilter("week")}
                    className="text-gold underline underline-offset-4 hover:text-gold-soft cursor-pointer"
                  >
                    this week's lineup
                  </button>{" "}
                  or view{" "}
                  <button
                    type="button"
                    onClick={() => setQuickFilter("all")}
                    className="text-gold underline underline-offset-4 hover:text-gold-soft cursor-pointer"
                  >
                    all upcoming shows
                  </button>
                  .
                </>
              ) : (
                "Try “afrobeats” or “Lekki”, or clear the search and filters to see every event on sale."
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
