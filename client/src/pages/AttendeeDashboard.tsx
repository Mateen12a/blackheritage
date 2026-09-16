import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { EventCard } from "@/components/EventCard";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Loader2,
  Ticket,
  CalendarDays,
  Store,
  ArrowRight,
  MapPin,
  Clock,
} from "lucide-react";

export default function AttendeeDashboard() {
  const { user } = useAuth();
  const { data: events, isLoading: eventsLoading } = useEvents();

  const { data: myBookings, isLoading: bookingsLoading } = useQuery<any[]>({
    queryKey: ["/api/bookings/search", user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const res = await fetch(
        `/api/bookings/search?email=${encodeURIComponent(user.email)}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.email,
  });

  const upcomingBookings =
    myBookings?.filter((b) => {
      if (!b.event?.date) return false;
      return new Date(b.event.date) > new Date();
    }) || [];

  const pastBookings =
    myBookings?.filter((b) => {
      if (!b.event?.date) return false;
      return new Date(b.event.date) <= new Date();
    }) || [];

  const recommendedEvents = events
    ?.filter((e) => !upcomingBookings.some((b) => b.eventId === e.id))
    .slice(0, 3);

  const isLoading = eventsLoading || bookingsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Welcome header */}
      <div className="mb-10 pt-2">
        <Reveal>
          <p className="eyebrow">Welcome back</p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
            {user?.username || "Guest"}
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-4 text-muted-ink max-w-xl">
            Your tickets, upcoming events, and what Lagos is doing next.
          </p>
        </Reveal>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <QuickStat
          icon={Ticket}
          label="Upcoming tickets"
          value={upcomingBookings.length}
        />
        <QuickStat
          icon={CalendarDays}
          label="Events attended"
          value={pastBookings.length}
        />
        <QuickStat
          icon={Store}
          label="Events on sale"
          value={events?.length || 0}
        />
        <QuickStat
          icon={Clock}
          label="Member since"
          value={
            user?.createdAt
              ? format(new Date(user.createdAt), "MMM yyyy")
              : "—"
          }
        />
      </div>

      {/* Upcoming tickets */}
      <section className="mb-14">
        <Reveal>
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="eyebrow">Your tickets</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink">
                Upcoming Events
              </h2>
            </div>
            {upcomingBookings.length > 0 && (
              <Link href="/my-tickets">
                <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                  View all tickets →
                </span>
              </Link>
            )}
          </div>
        </Reveal>

        {upcomingBookings.length === 0 ? (
          <div className="border border-hairline rounded-md bg-surface p-8 text-center">
            <Ticket className="w-10 h-10 text-muted-ink/30 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-ink mb-2">
              No upcoming tickets
            </h3>
            <p className="text-muted-ink text-sm mb-6 max-w-sm mx-auto">
              Grab your first ticket and see what Lagos has going on this
              weekend.
            </p>
            <Link href="/events">
              <Button className="press bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
                Browse Events
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingBookings.slice(0, 4).map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </section>

      {/* Recommended events */}
      <section className="mb-14">
        <Reveal>
          <div className="flex items-end justify-between mb-6 gap-4">
            <div>
              <p className="eyebrow">Don't miss out</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink">
                Happening Soon
              </h2>
            </div>
            <Link href="/events">
              <span className="text-sm font-medium text-gold hover:text-gold-soft transition-colors cursor-pointer">
                See every event →
              </span>
            </Link>
          </div>
        </Reveal>

        {recommendedEvents && recommendedEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="border border-hairline rounded-md bg-surface p-8 text-center">
            <CalendarDays className="w-10 h-10 text-muted-ink/30 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-ink mb-2">
              Nothing on the horizon
            </h3>
            <p className="text-muted-ink text-sm">
              New events drop regularly. Check back soon.
            </p>
          </div>
        )}
      </section>

      {/* Cross-sell vendors */}
      <section>
        <Reveal>
          <div className="border border-hairline rounded-md bg-surface p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="eyebrow">Planning a party?</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink">
                Hire a vendor
              </h2>
              <p className="mt-3 text-muted-ink max-w-lg leading-relaxed">
                DJs, MCs, caterers, decorators — Lagos's best talent, all in
                one directory. Browse portfolios, message straight on WhatsApp.
              </p>
            </div>
            <Link href="/vendors">
              <Button className="press shrink-0 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
                <Store className="w-4 h-4 mr-2" />
                Browse Vendors
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ticket;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-hairline rounded-md bg-surface p-4 md:p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gold" aria-hidden="true" />
        <span className="text-xs text-muted-ink">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function BookingCard({ booking }: { booking: any }) {
  if (!booking.event) return null;

  const ticketTypes = (() => {
    try {
      const types = JSON.parse(booking.event.ticketTypes || "[]");
      return types;
    } catch {
      return [];
    }
  })();

  return (
    <Link href={`/events/${booking.eventId}`}>
      <article className="group border border-hairline rounded-md bg-surface overflow-hidden hover:border-white/20 transition-colors cursor-pointer">
        <div className="flex gap-4 p-4">
          {/* Thumbnail */}
          <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-surface-2">
            <img
              src={booking.event.imageUrl}
              alt={booking.event.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-ink line-clamp-1 group-hover:text-gold transition-colors">
              {booking.event.title}
            </h3>

            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-ink">
              <span className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3 text-gold" />
                {format(new Date(booking.event.date), "EEE d MMM")}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gold" />
                <span className="truncate max-w-[120px]">
                  {booking.event.location}
                </span>
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    booking.isVerified
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-gold/10 text-gold border border-gold/20"
                  }`}
                >
                  {booking.isVerified ? "Used" : "Confirmed"}
                </span>
                <span className="text-[10px] text-muted-ink">
                  {booking.quantity}× {booking.ticketType}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-ink group-hover:text-gold transition-colors" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
