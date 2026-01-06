import { Navbar } from "@/components/Navbar";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Ticket, Calendar, MapPin, Search } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

export default function MyTickets() {
  const [email, setEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  const { data: bookings, isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/bookings/search", searchEmail],
    queryFn: async () => {
      if (!searchEmail) return [];
      const res = await fetch(`/api/bookings/search?email=${encodeURIComponent(searchEmail)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!searchEmail
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchEmail(email);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <div className="pt-32 pb-16 container mx-auto px-4">
        <h1 className="text-4xl font-display font-bold mb-2 text-white uppercase tracking-tight">Track My Tickets</h1>
        <p className="text-muted-foreground mb-12 uppercase text-xs tracking-[0.2em] font-bold">Enter your email to see your event bookings.</p>

        <div className="max-w-md mb-16">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
              type="email" 
              placeholder="your@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 bg-card border-white/10 text-white rounded-xl"
              required
            />
            <Button type="submit" className="h-14 bg-primary text-background px-8 rounded-xl font-bold">
              <Search className="w-5 h-5" />
            </Button>
          </form>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : bookings && bookings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookings.map((booking) => (
              <div 
                key={booking.id} 
                className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-lg group hover:border-primary/30 transition-colors"
              >
                <div className="h-2 bg-gradient-to-r from-primary to-yellow-200" />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-full uppercase tracking-wide border border-green-500/20 w-fit">
                        Confirmed
                      </span>
                      <span className="text-[10px] text-primary font-bold uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded border border-primary/10 w-fit">
                        Ticket ID: {booking.id.toString().slice(-8).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-white/40 text-[10px] font-mono">REF: {booking.paymentReference?.slice(0, 10)}...</span>
                  </div>

                  <h3 className="text-xl font-bold font-display text-white mb-2">{booking.event.title}</h3>
                  
                  <div className="space-y-2 text-sm text-muted-foreground mb-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>{format(new Date(booking.event.date), "EEE, MMM do • h:mm a")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{booking.event.location}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{booking.ticketType}</p>
                      <p className="text-lg font-bold text-white">{booking.quantity} Tickets</p>
                    </div>
                    {booking.isVerified ? (
                      <div className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold uppercase">
                        Used
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="border-white/10 hover:bg-white/5 hover:text-white"
                        onClick={() => {
                          const ticketInfo = `TICKET: ${booking.id}\nEVENT: ${booking.event.title}\nTYPE: ${booking.ticketType}\nNAME: ${booking.name}`;
                          alert(`Show this to the event organizer:\n\n${ticketInfo}`);
                        }}
                      >
                        <Ticket className="w-4 h-4 mr-2" /> View Ticket
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-card rounded-2xl border border-white/5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-6">
              <Ticket className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No bookings yet</h3>
            <p className="text-muted-foreground mb-6">You haven't booked any events yet.</p>
            <Link href="/events">
              <Button className="bg-primary text-background font-bold">Browse Events</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
