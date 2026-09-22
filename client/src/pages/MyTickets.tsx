import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBookingTickets, bookingPdfUrl } from "@/hooks/use-tickets";
import {
  Ticket,
  Calendar,
  MapPin,
  Search,
  ShieldCheck,
  Download,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { Reveal } from "@/components/motion";
import {
  BookingRowsSkeleton,
  LoadError,
} from "@/components/AsyncStates";

export default function MyTickets() {
  const { user } = useAuth();
  // Signed-in: the session is the query. Guests: email lookup. Everyone:
  // a ticket reference pasted in finds the booking directly.
  const isMember = !!user;
  const [guestEmail, setGuestEmail] = useState("");
  const [code, setCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [activeTicket, setActiveTicket] = useState<any>(null);

  const {
    data: bookings,
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/bookings/search", isMember ? "session" : searchEmail, submittedCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (submittedCode) params.set("code", submittedCode);
      else if (!isMember && searchEmail) params.set("email", searchEmail);
      const res = await fetch(`/api/bookings/search?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not load bookings");
      return res.json();
    },
    enabled: isMember || !!searchEmail || !!submittedCode,
    retry: 1,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      setSubmittedCode(code.trim().toUpperCase());
    } else if (!isMember && guestEmail.trim()) {
      setSearchEmail(guestEmail.trim());
    }
  };

  const hasSearched = isMember || searchEmail !== "" || submittedCode !== "";
  const showResults = hasSearched && !isLoading;

  return (
    <div>
      <Reveal className="max-w-3xl mb-10">
        <p className="eyebrow">Your tickets</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink tracking-tight">
          Track My Tickets
        </h1>
        <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
        <p className="mt-4 text-muted-ink max-w-lg">
          {isMember
            ? "Every booking on your account, plus any ticket reference you paste in. Each one comes with a verified e-ticket."
            : "Search with the email you booked with, or paste a ticket reference. Each booking comes with a verified e-ticket."}
        </p>
      </Reveal>

      <div className="max-w-md mb-14">
          <form onSubmit={handleSearch} className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={isMember ? "Ticket reference (optional)" : "Ticket reference or email"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0 font-mono"
              />
              <Button
                type="submit"
                aria-label="Search for tickets"
                className="h-12 bg-primary text-primary-foreground hover:bg-gold-soft px-6 rounded-md font-medium press"
              >
                <Search className="w-5 h-5" aria-hidden="true" />
                <span className="sr-only">Search for tickets</span>
              </Button>
            </div>
            {!isMember && (
              <Input
                type="email"
                placeholder="the email you booked with"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
              />
            )}
          </form>
        </div>

        {isLoading ? (
          <BookingRowsSkeleton count={2} />
        ) : isError ? (
          <LoadError
            title="Couldn't load your bookings"
            message="Check the email address and your connection, then try again."
            onRetry={() => refetch()}
          />
        ) : showResults && bookings && bookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bookings.map((booking) => (
              <article
                key={booking.id}
                className="border border-hairline rounded-md bg-surface overflow-hidden hover:border-white/20 transition-colors"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
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
                      className="border-hairline text-muted-ink hover:text-gold hover:border-gold/40 press"
                      onClick={() => setActiveTicket(booking)}
                    >
                      <Ticket className="w-4 h-4 mr-2" /> View Tickets
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
            <p className="text-muted-ink text-sm mb-6 max-w-sm mx-auto">
              Nothing matched{submittedCode ? ` the reference ${submittedCode}` : searchEmail ? ` ${searchEmail}` : " your account"}. Check it, or browse upcoming events.
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
              {isMember
                ? "Your bookings appear here automatically. Paste a reference to pull in a specific ticket."
                : "Enter the email you booked with, or a ticket reference."}
            </p>
          </div>
        )}

      {/* Ticket stub dialog: the e-ticket itself */}
      <Dialog
        open={!!activeTicket}
        onOpenChange={(open) => !open && setActiveTicket(null)}
      >
        <DialogContent className="bg-surface border-hairline text-ink sm:max-w-md p-0 overflow-hidden">
          {activeTicket && (
            <div>
              <div className="p-6 border-b border-dashed border-hairline">
                <p className="eyebrow">E-ticket · Show at the door</p>
                <DialogTitle className="mt-3 font-display text-2xl font-bold text-ink leading-snug">
                  {activeTicket.event?.title || "Event"}
                </DialogTitle>
                {activeTicket.event?.branding?.displayName && (
                  <div className="mt-2.5">
                    <Link
                      href={`/o/${activeTicket.event.branding.slug || activeTicket.event.organizerSlug || activeTicket.event.branding.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-ink hover:text-gold transition-colors"
                    >
                      {activeTicket.event.branding.logoUrl && (
                        <img
                          src={activeTicket.event.branding.logoUrl}
                          alt=""
                          className="w-4 h-4 rounded-sm object-cover"
                        />
                      )}
                      <span>
                        Presented by <span className="font-semibold text-ink underline-offset-2 hover:underline">{activeTicket.event.branding.displayName}</span>
                      </span>
                    </Link>
                  </div>
                )}
                <div className="mt-4 space-y-2 text-sm text-muted-ink">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gold" aria-hidden="true" />
                    {activeTicket.event?.date
                      ? format(
                          new Date(activeTicket.event.date),
                          "EEEE, d MMMM yyyy · h:mm a"
                        )
                      : "Date to be announced"}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gold" aria-hidden="true" />
                    {activeTicket.event?.location || "Venue to be announced"}
                  </p>
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-baseline">
                  <div>
                    <p className="eyebrow">Guest</p>
                    <p className="mt-1.5 text-ink font-medium">
                      {activeTicket.name || "Guest"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="eyebrow">Tickets</p>
                    <p className="mt-1.5 font-display text-xl font-bold text-gold">
                      {activeTicket.quantity}× {activeTicket.ticketType}
                    </p>
                  </div>
                </div>

                <TicketCodes bookingId={activeTicket.id} />

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-ink">
                  <ShieldCheck className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                  Show a code at the gate. Each one works once.
                </p>

                <a
                  href={bookingPdfUrl(activeTicket.id)}
                  className="press mt-4 flex items-center justify-center gap-2 h-12 rounded-md bg-primary text-primary-foreground hover:bg-gold-soft font-medium"
                >
                  <Download className="w-4.5 h-4.5" aria-hidden="true" />
                  Download PDF Tickets
                </a>

                {activeTicket.event?.branding?.displayName && (
                  <div className="mt-3 text-center">
                    <Link
                      href={`/o/${activeTicket.event.branding.slug || activeTicket.event.organizerSlug || activeTicket.event.branding.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      className="text-[11px] text-muted-ink hover:text-gold transition-colors inline-flex items-center gap-1"
                    >
                      <span>Explore more productions by {activeTicket.event.branding.displayName}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketCodes({ bookingId }: { bookingId: string }) {
  const { data: tickets, isLoading, isError } = useBookingTickets(bookingId);

  if (isLoading) {
    return (
      <div className="mt-5 bg-surface-2 border border-hairline rounded-md p-4">
        <p className="eyebrow">Ticket codes</p>
        <div className="mt-2 space-y-2">
          <div className="h-6 bg-surface rounded animate-pulse w-40 mx-auto" />
          <div className="h-6 bg-surface rounded animate-pulse w-32 mx-auto" />
        </div>
      </div>
    );
  }
  if (isError || !tickets || tickets.length === 0) {
    return (
      <div className="mt-5 bg-surface-2 border border-hairline rounded-md p-4 text-center">
        <p className="eyebrow">Ticket codes</p>
        <p className="mt-1.5 text-sm text-muted-ink">
          Codes appear here once payment confirms. Check back in a minute.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-2">
      {tickets.map((t) => (
        <div
          key={t.id}
          className="bg-surface-2 border border-hairline rounded-md p-4 flex items-center justify-between"
        >
          <div>
            <p className="font-mono text-lg font-bold text-ink tracking-wider">
              {t.code}
            </p>
            <p className="text-xs text-muted-ink mt-0.5">
              {t.tierName} · Seat {t.seat}
            </p>
          </div>
          <span
            className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
              t.status === "used"
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : t.status === "void"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-gold/10 text-gold border border-gold/20"
            }`}
          >
            {t.status === "used" ? "Checked in" : t.status === "void" ? "Void" : "Valid"}
          </span>
        </div>
      ))}
    </div>
  );
}
