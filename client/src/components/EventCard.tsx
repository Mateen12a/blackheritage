import { Event } from "@shared/schema";
import { Link } from "wouter";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Link href={`/events/${event.id}`}>
      <motion.div 
        whileHover={{ y: -5 }}
        className="group relative overflow-hidden rounded-2xl bg-card border border-white/5 hover:border-primary/50 transition-all duration-300 cursor-pointer h-full flex flex-col shadow-lg hover:shadow-primary/10"
      >
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
          <img 
            src={event.imageUrl} 
            alt={event.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          
          {/* Price Tag */}
          <div className="absolute top-4 right-4 z-20 bg-primary text-black font-black px-4 py-2 rounded-xl text-lg shadow-2xl border border-white/20">
            ₦{(event.price / 100).toLocaleString()}
          </div>

          {/* Date Badge */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col items-center bg-white/20 backdrop-blur-md border border-white/30 rounded-xl px-4 py-2 text-white shadow-xl">
            <span className="text-sm font-bold uppercase tracking-widest">
              {format(new Date(event.date), "MMM")}
            </span>
            <span className="text-3xl font-black font-display leading-none">
              {format(new Date(event.date), "dd")}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-2xl font-bold font-display mb-3 text-white group-hover:text-primary transition-colors line-clamp-2 leading-tight">
            {event.title}
          </h3>
          
          <div className="flex items-center gap-2 text-white/80 text-lg mb-6">
            <MapPin className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate font-medium">{event.location}</span>
          </div>

          <div className="mt-auto flex flex-col pt-5 border-t border-white/10">
            <div className="flex flex-wrap gap-2 mb-3">
              {(() => {
                try {
                  const types = JSON.parse(event.ticketTypes || '[]');
                  if (types.length === 0) {
                    return (
                      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
                          {event.capacity} Regular Left
                        </span>
                      </div>
                    );
                  }
                  return types.slice(0, 3).map((type: any) => (
                    <div key={type.name} className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
                        {type.capacity - (type.sold || 0)} {type.name} Left
                      </span>
                    </div>
                  ));
                } catch (e) {
                  return null;
                }
              })()}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/60">
                <Users className="w-5 h-5" />
                <span className="font-medium text-base">{event.capacity} Total</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-primary font-black text-lg group-hover:translate-x-1 transition-transform">
                  Get Ticket →
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
