import { useEvent } from "@/hooks/use-events";
import { Navbar } from "@/components/Navbar";
import { BookingModal } from "@/components/BookingModal";
import { Button } from "@/components/ui/button";
import { useRoute } from "wouter";
import { Loader2, Calendar, MapPin, Users, Share2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Link } from "wouter";
import { BusinessModal } from "@/components/BusinessModal";

export default function EventDetails() {
  const [, params] = useRoute("/events/:id");
  const id = params?.id;
  const { data: event, isLoading } = useEvent(id as any);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold text-white mb-4">Event not found</h2>
        <Link href="/events">
          <Button variant="outline">Back to Events</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      
      {/* Hero Image */}
      <div className="relative h-[50vh] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
        <img 
          src={event.imageUrl} 
          alt={event.title}
          className="w-full h-full object-cover"
        />
        
        {/* Back Button */}
        <Link href="/events">
          <Button 
            variant="outline" 
            size="icon" 
            className="absolute top-28 left-4 z-20 rounded-full bg-black/50 border-white/10 text-white hover:bg-primary hover:text-black hover:border-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      <div className="container mx-auto px-4 -mt-32 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-white/5 rounded-2xl p-8 shadow-xl">
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <span className="px-4 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-bold uppercase tracking-wider">
                  Upcoming Event
                </span>
                <span className="text-muted-foreground text-sm">
                  Posted on {format(new Date(), "MMM dd, yyyy")}
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 leading-tight">
                {event.title}
              </h1>

              <div className="flex flex-col gap-6 mb-8 p-6 bg-background/50 rounded-xl border border-white/5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Date & Time</h3>
                    <p className="text-muted-foreground">
                      {format(new Date(event.date), "EEEE, MMMM do, yyyy")}
                    </p>
                    <p className="text-muted-foreground">
                      {format(new Date(event.date), "h:mm a")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Location</h3>
                    <p className="text-muted-foreground">{event.location}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Tickets Available</h3>
                    <div className="flex flex-col gap-1 mt-1">
                      {(() => {
                        try {
                          const types = JSON.parse(event.ticketTypes || '[]');
                          if (types.length === 0) {
                            return <p className="text-muted-foreground">{event.capacity} Regular tickets remaining</p>;
                          }
                          return types.map((type: any) => (
                            <p key={type.name} className="text-muted-foreground">
                              <span className="text-primary font-bold">{type.capacity - (type.sold || 0)}</span> {type.name} tickets left
                            </p>
                          ));
                        } catch (e) {
                          return <p className="text-muted-foreground">{event.capacity} tickets remaining</p>;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <h3 className="text-2xl font-display text-white mb-4">About the Event</h3>
                <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-4">
              <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
                <h3 className="text-xl font-display font-bold text-white mb-2">Price</h3>
                <div className="flex items-end gap-2 mb-6">
                  <span className="text-4xl font-bold text-primary">₦{(event.price / 100).toLocaleString()}</span>
                  <span className="text-muted-foreground mb-1">/ person</span>
                </div>

                <Button 
                  onClick={() => setIsBookingOpen(true)}
                  className="w-full bg-primary text-background hover:bg-white font-bold py-6 text-lg mb-4 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                >
                  Get Tickets
                </Button>
                
                <p className="text-xs text-center text-muted-foreground mb-4">
                  Secure Paystack checkout: card, transfer, or USSD. Your
                  e-ticket arrives instantly.
                </p>

                <Button 
                  variant="outline" 
                  className="w-full border-white/10 hover:bg-white/5 text-muted-foreground hover:text-white"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: event.title,
                        text: `Check out this event: ${event.title}`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert("Link copied to clipboard!");
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share Event
                </Button>
              </div>

              {/* Sponsor & Vendor Section */}
              <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl space-y-4 text-center">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-base">Reach everyone at this event</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sponsors and vendors get direct visibility in front of the
                    whole crowd.
                  </p>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full border-primary/20 hover:bg-primary/10 text-primary font-bold text-sm h-12"
                  onClick={() => setIsBusinessModalOpen(true)}
                >
                  Apply as Sponsor or Vendor
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BookingModal 
        event={event} 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
      />

      <BusinessModal
        event={event}
        isOpen={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
      />
    </div>
  );
}
