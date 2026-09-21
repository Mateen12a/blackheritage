import { useEvents } from "@/hooks/use-events";
import { Reveal } from "@/components/motion";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { enUS } from "date-fns/locale";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export default function CalendarPage() {
  const { data: events, isLoading } = useEvents();
  const [, setLocation] = useLocation();

  const calendarEvents =
    events?.map((event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.date),
      end: new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000),
      resource: event,
    })) || [];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pt-6 pb-24">
        {/* Editorial header */}
        <Reveal className="max-w-3xl mb-10">
          <p className="eyebrow">Lagos &amp; beyond</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink tracking-tight">
            Event Calendar
          </h1>
          <div className="mt-5 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-5 text-lg text-muted-ink max-w-xl leading-relaxed">
            Every event on sale this month, laid out by date. Tap any event
            to see details and grab your ticket.
          </p>
        </Reveal>

        {/* Calendar — responsive height, design-token styling */}
        <div className="border border-hairline rounded-md bg-surface overflow-hidden">
          {isLoading ? (
            <div className="h-[400px] md:h-[600px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gold" />
            </div>
          ) : (
            <>
              <style>{`
                .rbc-calendar { color: var(--color-muted-ink); }
                .rbc-off-range-bg { background: transparent; }
                .rbc-today { background: rgba(227,178,60,0.06); }
                .rbc-event {
                  background-color: var(--color-gold);
                  color: var(--color-gold-well);
                  border: none;
                  border-radius: 4px;
                  font-weight: 600;
                  font-size: 0.8rem;
                  padding: 2px 6px;
                }
                .rbc-event.rbc-selected { background-color: var(--color-gold-soft); }
                .rbc-toolbar button {
                  color: var(--color-ink);
                  border-color: var(--color-hairline);
                  border-radius: 4px;
                  font-size: 0.8rem;
                  padding: 4px 10px;
                }
                .rbc-toolbar button:hover,
                .rbc-toolbar button.rbc-active {
                  background: var(--color-surface-2);
                  color: var(--color-gold);
                }
                .rbc-toolbar-label {
                  color: var(--color-ink);
                  font-family: var(--font-display);
                  font-weight: 700;
                  font-size: 1rem;
                }
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
                  border-color: var(--color-hairline);
                }
                .rbc-month-row, .rbc-day-bg, .rbc-time-header-content, .rbc-header {
                  border-color: var(--color-hairline) !important;
                }
                .rbc-header { padding: 8px 0; }
                .rbc-day-bg { min-height: 60px; }
                @media (max-width: 640px) {
                  .rbc-day-bg { min-height: 44px; }
                  .rbc-header { padding: 6px 0; }
                  .rbc-toolbar { flex-wrap: wrap; gap: 4px; }
                  .rbc-toolbar button { padding: 3px 6px; font-size: 0.7rem; }
                  .rbc-toolbar-label { font-size: 0.85rem; }
                  .rbc-month-view .rbc-row { min-height: auto; }
                  .rbc-button-group { gap: 2px; }
                }
              `}</style>
              <BigCalendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                onSelectEvent={(event) => setLocation(`/events/${event.id}`)}
                style={{ height: "clamp(400px, 70vh, 640px)" }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
