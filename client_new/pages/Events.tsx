import { Navbar } from "@/components/Navbar";
import { EventCard } from "@/components/EventCard";
import { useEvents } from "@/hooks/use-events";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <Navbar />

      <div className="pt-34 pb-20 container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-6xl font-display font-bold mb-6 text-white tracking-tight">
              Upcoming <span className="gold-text-gradient">Events</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
              Pick a show or party you like and get your ticket in seconds.
            </p>
          </motion.div>
        </div>

        {/* Search Bar - Simplified */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <div className="flex flex-col sm:flex-row gap-4 items-center bg-card/30 border border-white/10 rounded-3xl p-3 shadow-xl">
              <div className="flex-grow relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-6 h-6" />
                <Input
                  placeholder="Search for a show or place..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-14 h-16 bg-transparent border-none text-white text-xl placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-primary text-background font-bold text-xl hover:bg-white transition-all duration-200">
                Find Event
              </Button>
            </div>
            <p className="text-center mt-3 text-sm text-muted-foreground">
              Type what you are looking for above
            </p>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium animate-pulse">
              Loading amazing events...
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
          >
            {filteredEvents?.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <EventCard event={event} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!isLoading && filteredEvents?.length === 0 && (
          <div className="text-center py-24">
            <h3 className="text-xl font-bold text-white mb-2">
              No events found
            </h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
