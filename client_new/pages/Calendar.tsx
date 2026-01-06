import { Navbar } from "@/components/Navbar";
import { useEvents } from "@/hooks/use-events";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { enUS } from "date-fns/locale";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function CalendarPage() {
  const { data: events, isLoading } = useEvents();
  const [, setLocation] = useLocation();

  const calendarEvents =
    events?.map((event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.date),
      end: new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000), // assume 2 hours
      resource: event,
    })) || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="pt-22 pb-16 container mx-auto px-4">
        <h1 className="text-4xl font-display font-bold mb-8 text-white">
          Event Calendar
        </h1>

        <div className="bg-card border border-white/5 p-6 rounded-2xl h-[700px] shadow-xl">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : (
            <style>
              {`
                .rbc-calendar { color: #a3a3a3; }
                .rbc-off-range-bg { background: #1a1a1a; }
                .rbc-today { background: rgba(255, 215, 0, 0.05); }
                .rbc-event {
                  background-color: hsl(48, 100%, 50%);
                  color: black;
                  border: none;
                  border-radius: 4px;
                  font-weight: 600;
                  font-size: 0.85rem;
                }
                .rbc-event.rbc-selected {
                   background-color: #fff;
                }
                .rbc-toolbar button {
                  color: white;
                  border-color: rgba(255,255,255,0.1);
                }
                .rbc-toolbar button:hover, .rbc-toolbar button.rbc-active {
                  background-color: rgba(255,255,255,0.1);
                  color: #FFD700;
                }
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
                  border-color: rgba(255,255,255,0.1);
                }
                .rbc-month-row, .rbc-day-bg, .rbc-time-header-content, .rbc-header {
                   border-color: rgba(255,255,255,0.1) !important;
                }
              `}
            </style>
          )}

          {!isLoading && (
            <BigCalendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              onSelectEvent={(event) => setLocation(`/events/${event.id}`)}
              style={{ height: "100%" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
