import { Navbar } from "@/components/Navbar";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Ticket, Calendar, MapPin, Search } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Reveal } from "@/components/motion";

export default function MyTickets() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [searchEmail, setSearchEmail] = useState("");

  const {
    data: bookings,
    isLoading,
  } = useQuery<any[]>({
    queryKey: ["/api/bookings/search", searchEmail],
    queryFn: async () => {
      if (!searchEmail) return [];
      const res = await fetch(
        `/api/bookings/search?email=${encodeURIComponent(searchEmail)}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!searchEmail,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchEmail(email);
  };

  // Auto-search on mount if user has email
  const hasSearched = searchEmail !== "";
  const showResults = hasSearched && !isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pt-32 pb-16 container mx-auto px-4">
        <Reveal className="max-w-3xl mb-10">
          <p className="eyebrow">Your tickets</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink tracking-tight">
            Track My Tickets
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-4 text-muted-ink max-w-lg">
            Enter your email to see every booking you've made. Each one
            comes with a verified e-ticket.
          </p>
        </Reveal>

        <div className="max-w-md mb-14">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
              required
            />
            <Button
              type="submit"
              className="h-12 bg-primary text-primary-foreground hover:bg-gold-soft px-6 rounded-md font-medium press"
            >
              <Search className="w-5 h-5" />
            </Button>
          </form>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          </div>
        ) : showResults && bookings && bookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bookings.map((booking) => (
              <article
                key={booking.id}
                className="border border-hairline rounded-md bg-surface overflow-hidden hover:border-white/20 transition-colors"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider w-fit ${
                          booking.isVerified
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-gold/10 text-gold border border-gold/20"
                        }`}
                      >
                        {booking.isVerified ? "Used" : "Confirmed"}
                      </span>
                      <span className="text-[9px] text-muted-ink font-mono">
                        REF: {booking.paymentReference?.slice(0, 12)}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-display text-lg font-bold text-ink mb-2">
                    {booking.event?.title || "Event"}
                  </h3>

                  <div className="space-y-1.5 text-sm text-muted-ink mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gold" />
                      <span>
                        {booking.event?.date
                          ? format(
                              new Date(booking.event.date),
                              "EEE, MMM d · h:mm a"
                            )
                          : "TBA"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gold" />
                      <span className="truncate">
                        {booking.event?.location || "TBA"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-hairline flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-ink">
                        {booking.ticketType}
                      </p>
                      <p className="text-sm font-medium text-ink">
                        {booking.quantity} Ticket{booking.quantity > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-hairline text-muted-ink hover:text-gold hover:border-gold/40"
                      onClick={() => {
                        const ticketInfo = `TICKET: ${booking.id}\nEVENT: ${booking.event?.title}\nTYPE: ${booking.ticketType}\nNAME: ${booking.name}`;
                        alert(
                          `Show this to the event organizer:\n\n${ticketInfo}`
                        );
                      }}
                    >
                      <Ticket className="w-4 h-4 mr-2" /> View Ticket
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : showResults ? (
          <div className="text-center py-16 border border-hairline rounded-md bg-surface">
            <Ticket className="w-10 h-10 text-muted-ink/20 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-ink mb-2">
              No bookings found
            </h3>
            <p className="text-muted-ink text-sm mb-6">
              We couldn't find any tickets for {searchEmail}. Try a
              different email, or browse upcoming events.
            </p>
            <Link href="/events">
              <Button className="press bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
                Browse Events
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-16 border border-hairline rounded-md bg-surface">
            <Ticket className="w-10 h-10 text-muted-ink/20 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-ink mb-2">
              Search for your tickets
            </h3>
            <p className="text-muted-ink text-sm">
              Enter the email you used when booking to see your tickets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
