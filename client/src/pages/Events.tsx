import { EventCard } from "@/components/EventCard";
import { useEvents } from "@/hooks/use-events";
import { Reveal } from "@/components/motion";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function Events() {
  const { data: events, isLoading } = useEvents();
  const [search, setSearch] = useState("");

  const filteredEvents = events?.filter(
    (event) =>
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.description.toLowerCase().includes(search.toLowerCase()) ||
      event.location.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pt-16 pb-24">
        {/* Editorial header — left-anchored, solid gold rule */}
        <Reveal className="max-w-3xl mb-12">
          <p className="eyebrow">Lagos &amp; beyond</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink tracking-tight">
            Upcoming Events
          </h1>
          <div className="mt-5 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-5 text-lg text-muted-ink max-w-xl leading-relaxed">
            {events?.length ?? 0}
            {events?.length === 1 ? " show" : " shows"} on sale across Lagos:
            afrobeats nights, live jazz, food fests, and everything in between.
            Paystack-secured, instant confirmation.
          </p>
        </Reveal>

        {/* Quiet search well */}
        <div className="max-w-2xl mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-ink w-5 h-5 pointer-events-none" />
            <Input
              placeholder="Try “afrobeats”, “jazz”, or “Lekki”..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search events"
              className="w-full h-14 pl-12 bg-surface-2 border border-hairline rounded-md text-ink text-base placeholder:text-muted-ink focus-visible:border-gold focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
            <p className="eyebrow">Loading events</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents?.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {!isLoading && filteredEvents?.length === 0 && (
          <div className="text-center py-24 border border-hairline rounded-md bg-surface">
            <h2 className="font-display text-xl font-bold text-ink mb-2">
              Nothing matches that yet
            </h2>
            <p className="text-muted-ink">
              Try “afrobeats” or “Lekki”, or clear the search to see every
              event on sale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
