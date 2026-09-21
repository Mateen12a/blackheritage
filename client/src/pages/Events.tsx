import { EventCard } from "@/components/EventCard";
import { EventCardCompact } from "@/components/EventCardCompact";
import { useEvents } from "@/hooks/use-events";
import { Reveal } from "@/components/motion";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type QuickFilter = "all" | "week" | "free" | "under10k";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "week", label: "This week" },
  { key: "free", label: "Free" },
  { key: "under10k", label: "Under ₦10k" },
];

export default function Events() {
  const { data: events, isLoading } = useEvents();
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const filteredEvents = events?.filter((event) => {
    const term = search.toLowerCase();
    const matchesSearch =
      event.title.toLowerCase().includes(term) ||
      event.description.toLowerCase().includes(term) ||
      event.location.toLowerCase().includes(term);

    const matchesQuick = (() => {
      switch (quickFilter) {
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
            Paystack-secured, instant confirmation.
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

        {/* Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
            <p className="eyebrow">Loading events</p>
          </div>
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
              Nothing matches that yet
            </h2>
            <p className="text-muted-ink">
              Try “afrobeats” or “Lekki”, or clear the search and filters to
              see every event on sale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
