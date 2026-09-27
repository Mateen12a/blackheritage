// Client-side calendar deep links. The .ics file itself comes from the
// server (/api/events/:id/calendar.ics, see server/calendar.ts); these
// helpers build the two hosted-calendar prefilled links.

export interface CalendarLinkEvent {
  title: string;
  date: string | Date;
  location: string;
  slug?: string | null;
}

// Events have no end time in the schema; 3 hours matches the .ics block.
const EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

export function buildGoogleCalendarUrl(event: CalendarLinkEvent): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + EVENT_DURATION_MS);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    location: event.location || "Lagos, Nigeria",
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

export function buildOutlookCalendarUrl(event: CalendarLinkEvent): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + EVENT_DURATION_MS);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    location: event.location || "Lagos, Nigeria",
  });
  return "https://outlook.live.com/calendar/0/deeplink/compose?" + params.toString();
}
