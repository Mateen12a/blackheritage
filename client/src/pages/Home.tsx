import { Navbar } from "@/components/Navbar";
import { EventCard } from "@/components/EventCard";
import { useEvents } from "@/hooks/use-events";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Calendar } from "lucide-react";

export default function Home() {
  const { data: events, isLoading } = useEvents();
  
  // Filter for featured/upcoming events (just taking first 3 for demo)
  const featuredEvents = events?.filter(e => e.isFeatured).slice(0, 3) || events?.slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
        {/* Hero Background */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=2670&auto=format&fit=crop" 
            alt="Naija Party" 
            loading="eager"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/40 to-background" />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Content */}
        <div className="container relative z-10 px-4 text-center">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <span className="inline-block px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary font-bold tracking-widest text-sm uppercase mb-6 backdrop-blur-sm">
              Best Naija Parties & Shows
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-6 text-white leading-tight">
              Heritage <br/>
              <span className="gold-text-gradient">& Vibes</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
              Find and buy tickets for the best shows and parties in Nigeria. Simple, fast, and secure.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link href="/events">
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <Button className="w-full sm:w-auto h-16 px-10 rounded-2xl text-xl font-bold bg-primary text-background hover:bg-white transition-all duration-300">
                    See All Events
                  </Button>
                  <span className="text-xs text-white/60">Click to see what's happening</span>
                </div>
              </Link>
              <Link href="/calendar">
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto h-16 px-10 rounded-2xl text-lg font-bold border-white/20 text-white hover:bg-white/10 backdrop-blur-sm">
                    <Calendar className="mr-2 h-6 w-6" />
                    Event Calendar
                  </Button>
                  <span className="text-xs text-white/60">See events by date</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="py-24 container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Hot Events</h2>
            <p className="text-muted-foreground">The best events happening right now.</p>
          </div>
          <Link href="/events">
            <Button variant="ghost" className="text-primary hover:text-primary/80 p-0 group">
              See All Events <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredEvents?.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {!isLoading && (!featuredEvents || featuredEvents.length === 0) && (
          <div className="text-center py-20 bg-card rounded-2xl border border-white/5">
            <p className="text-muted-foreground">No upcoming featured events at the moment.</p>
          </div>
        )}
      </section>

      {/* Mission/Promo Section */}
      <section className="py-24 bg-card border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
        <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="order-2 lg:order-1">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
              Making Every Event <span className="text-primary">Special</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Black Heritage Events & Entertainment is the best place to find tickets for the coolest shows and parties. We bring you the fun you deserve without any stress.
            </p>
            <Link href="/events">
               <Button className="bg-white text-background hover:bg-gray-200 rounded-full px-8 py-6 font-bold">
                 Buy Your Ticket Now
               </Button>
            </Link>
          </div>
          <div className="order-1 lg:order-2 relative">
             <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 aspect-[4/5]">
               {/* unsplash jazz musician performing dark stage */}
               <img 
                 src="https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=2664&auto=format&fit=crop" 
                 alt="Performer"
                 className="w-full h-full object-cover"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
               <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                 <p className="text-white italic text-lg font-display">"An absolute triumph of culture and class. The best event I've attended all year."</p>
                 <p className="text-primary mt-2 text-sm font-bold">— Sarah J., Event Guest</p>
               </div>
             </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 bg-background border-t border-white/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold font-display mb-2 text-white uppercase">Black Heritage</h2>
          <p className="text-primary text-xs tracking-[0.3em] uppercase mb-8">Events & Entertainment</p>
          <div className="flex justify-center gap-6 mb-8 text-muted-foreground">
             <a href="#" className="hover:text-primary transition-colors">Instagram</a>
             <a href="#" className="hover:text-primary transition-colors">Twitter</a>
             <a href="#" className="hover:text-primary transition-colors">Facebook</a>
          </div>
          <p className="text-sm text-white/20">© {new Date().getFullYear()} Black Heritage. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
