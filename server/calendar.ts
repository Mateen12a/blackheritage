// Calendar files and links for events. The .ics format is the universal
// one: Apple Calendar, Outlook, Google, and Samsung all open it, so a
// single builder covers every calendar app a Nigerian ticket buyer uses.
// Events have no end time in the schema, so the block assumes a 3-hour
// window, which matches what the ticket screen already showed.

const EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

/** RFC 5545 TEXT escaping: backslash first, then semicolon, comma, newline. */
function icsEscape(value: string): string {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold content lines at 75 octets so strict parsers (Apple Calendar) accept long descriptions. */
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  return parts.join("\r\n");
}

/** YYYYMMDDTHHMMSSZ in UTC, the one timestamp format every parser agrees on. */
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

export interface IcsEventInput {
  id: string;
  title: string;
  date: string | Date;
  location: string;
  description?: string;
  slug?: string | null;
}

export function buildEventIcs(event: IcsEventInput, appUrl: string): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + EVENT_DURATION_MS);
  const pageUrl = event.slug ? `${appUrl}/e/${event.slug}` : `${appUrl}/events/${event.id}`;
  const description = `${event.description || ""}\n\nTickets and details: ${pageUrl}`.trim();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Black Heritage Events//Ticket//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@blackhevents.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(event.location || "Lagos, Nigeria")}`,
    `URL:${pageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // CRLF line endings are part of the RFC; some parsers reject bare LF.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Google Calendar prefilled event. */
export function googleCalendarUrl(event: IcsEventInput): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + EVENT_DURATION_MS);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    location: event.location || "Lagos, Nigeria",
    details: event.slug ? `Tickets: https://blackhevents.com/e/${event.slug}` : "",
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

/** Outlook.com (also works for Microsoft 365 web calendars). */
export function outlookCalendarUrl(event: IcsEventInput): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + EVENT_DURATION_MS);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    location: event.location || "Lagos, Nigeria",
    body: event.slug ? `Tickets: https://blackhevents.com/e/${event.slug}` : "",
  });
  return "https://outlook.live.com/calendar/0/deeplink/compose?" + params.toString();
}
