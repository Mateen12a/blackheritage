import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarPlus, Check, Copy, MessageCircle, PartyPopper, Image as ImageIcon } from "lucide-react";
import { buildOutlookCalendarUrl } from "@/lib/calendar-links";
import { blackHeritageCommunityWhatsAppLink } from "@/lib/contact";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion";
import { ShareFlyerModal } from "@/components/ShareFlyerModal";

export interface RevealTicket {
  code: string;
  tierName: string;
  attendeeName: string;
}

interface TicketRevealProps {
  open: boolean;
  onClose: () => void;
  eventTitle: string;
  eventDate: string | Date;
  location: string;
  email: string;
  tickets: RevealTicket[];
  accentHex?: string | null;
  logoUrl?: string | null;
  event?: any;
}

const nairaDate = (d: string | Date) =>
  new Date(d).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** Google Calendar template: universal UTC window, 3 hours long. */
export function buildCalendarUrl(
  title: string,
  date: string | Date,
  location: string,
): string {
  const start = new Date(date);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: stamp(start) + "/" + stamp(end),
    location: location,
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

export function buildWhatsAppShare(
  title: string,
  date: string | Date,
  location: string,
  url: string,
): string {
  const text =
    "I just got my ticket for " + title +
    " \u{1F39F}\u{FE0F} " + nairaDate(date) + ", " + location +
    ". Get yours: " + url;
  return "https://wa.me/?text=" + encodeURIComponent(text);
}

/**
 * The confirmation moment. Payment success usually lands on a gateway
 * spinner and dies; this gives the guest the peak instead: the code in
 * hand, the date in their calendar, and one tap to share while they
 * still feel it.
 */
export function TicketReveal({
  open,
  onClose,
  eventTitle,
  eventDate,
  location,
  email,
  tickets,
  accentHex,
  logoUrl,
  event,
}: TicketRevealProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
  const accent = accentHex || "#E3B23C";
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  // The universal calendar file. The event prop carries the id when the
  // reveal is opened from a real booking; the fallback keeps the preview
  // flow working when only title/date/location are known.
  const icsHref =
    (event as any)?.id
      ? `/api/events/${(event as any).id}/calendar.ics`
      : buildCalendarUrl(eventTitle, eventDate, location);

  const resolvedEvent = event || {
    title: eventTitle,
    date: eventDate,
    location: location,
    branding: {
      accentHex,
      logoUrl,
    },
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard can be denied; the code is visible either way.
    }
    setCopied(code);
    window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 1600);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className="bg-surface border-hairline text-ink w-[95vw] sm:max-w-md p-0 overflow-hidden z-[60]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="p-7 space-y-6">
            <div className="flex items-start gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.25 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="w-14 h-14 shrink-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: accent + "1f", color: accent }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                    style={{ outline: "1px solid rgba(255,255,255,0.1)" }}
                  />
                ) : (
                  <PartyPopper className="w-6 h-6" aria-hidden="true" />
                )}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: EASE_OUT }}
                className="min-w-0"
              >
                <p className="eyebrow" style={{ color: accent }}>
                  You&apos;re in
                </p>
                <h2 className="font-display text-2xl font-bold text-ink leading-tight mt-1">
                  {eventTitle}
                </h2>
                <p className="text-sm text-muted-ink mt-1">
                  {nairaDate(eventDate)} &middot; {location}
                </p>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.22, ease: EASE_OUT }}
              className="space-y-2"
            >
              {tickets.map((t, i) => (
                <motion.div
                  key={t.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.3 + i * 0.08, ease: EASE_OUT }}
                  className="flex items-center gap-3 rounded-md border border-hairline bg-surface-2/60 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{t.attendeeName}</p>
                    <p className="text-xs text-muted-ink">{t.tierName}</p>
                    <p className="text-xs font-mono text-muted-ink mt-1 tracking-wide">{t.code}</p>
                  </div>
                  <button
                    onClick={() => copyCode(t.code)}
                    aria-label={"Copy code " + t.code}
                    className="press w-9 h-9 shrink-0 rounded-full border border-hairline flex items-center justify-center text-muted-ink hover:text-ink transition-colors"
                  >
                    {copied === t.code ? (
                      <Check className="w-4 h-4" style={{ color: accent }} aria-hidden="true" />
                    ) : (
                      <Copy className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </motion.div>
              ))}
            </motion.div>

            {/* Action Buttons: Viral Story Pass & Quick Share */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.45, ease: EASE_OUT }}
              className="space-y-3"
            >
              <Button
                onClick={() => setIsFlyerModalOpen(true)}
                className="press w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold rounded-md flex items-center justify-center gap-2 shadow-lg shadow-gold/10"
              >
                <ImageIcon className="w-4 h-4" />
                Share Story Card
              </Button>

              {/* WhatsApp Community / Attendee Group Join */}
              {resolvedEvent?.whatsappGroupUrl ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        Attendee WhatsApp Group
                      </p>
                      <p className="text-xs font-medium text-ink mt-0.5 leading-snug">
                        Join fellow guests &amp; get live venue updates for {eventTitle}
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    className="press w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-md flex items-center justify-center gap-2 text-xs shadow-md shadow-emerald-500/10"
                  >
                    <a
                      href={resolvedEvent.whatsappGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>Join Event WhatsApp Group</span>
                    </a>
                  </Button>
                  <div className="text-center pt-0.5">
                    <a
                      href={blackHeritageCommunityWhatsAppLink(eventTitle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-ink hover:text-gold transition-colors inline-flex items-center gap-1"
                    >
                      <span>Also join Black Heritage Community WhatsApp</span>
                      <span aria-hidden="true">&rarr;</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-hairline bg-surface-2/70 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gold/15 text-gold flex items-center justify-center shrink-0 mt-0.5">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gold">
                        Black Heritage Community
                      </p>
                      <p className="text-xs font-medium text-ink mt-0.5 leading-snug">
                        Connect with fellow guests &amp; get insider access to upcoming events
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="press w-full h-11 border-gold/40 text-gold hover:bg-gold/10 font-semibold rounded-md flex items-center justify-center gap-2 text-xs"
                  >
                    <a
                      href={blackHeritageCommunityWhatsAppLink(eventTitle)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      <span>Join Black Heritage WhatsApp Community</span>
                    </a>
                  </Button>
                </div>
              )}

              {/* Calendar: every major app. Google and Outlook open prefilled
                  events; the .ics download covers Apple, Samsung, and the
                  rest, straight from the server. */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  asChild
                  variant="outline"
                  className="press h-11 border-hairline text-ink hover:bg-surface-2 font-medium rounded-md text-xs px-2"
                >
                  <a
                    href={buildCalendarUrl(eventTitle, eventDate, location)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <CalendarPlus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Google
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="press h-11 border-hairline text-ink hover:bg-surface-2 font-medium rounded-md text-xs px-2"
                >
                  <a
                    href={buildOutlookCalendarUrl({ title: eventTitle, date: eventDate, location })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <CalendarPlus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Outlook
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="press h-11 border-hairline text-ink hover:bg-surface-2 font-medium rounded-md text-xs px-2"
                >
                  <a href={icsHref} download="event-calendar.ics">
                    <CalendarPlus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Apple
                  </a>
                </Button>
              </div>

              <Button
                asChild
                variant="outline"
                className="press h-11 border-hairline text-ink hover:bg-surface-2 font-medium rounded-md"
              >
                <a
                  href={buildWhatsAppShare(eventTitle, eventDate, location, shareUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                  Share on WhatsApp
                </a>
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.55, ease: EASE_OUT }}
              className="text-xs text-muted-ink text-center leading-relaxed"
            >
              PDF tickets are on their way to {email}. Your codes also live in
              My Tickets, and the gate scans them straight from there.
            </motion.p>
          </div>
        </DialogContent>
      </Dialog>

      <ShareFlyerModal
        open={isFlyerModalOpen}
        onClose={() => setIsFlyerModalOpen(false)}
        event={resolvedEvent}
        isAttendee={true}
        attendeeName={tickets[0]?.attendeeName || ""}
        ticketTier={tickets[0]?.tierName || ""}
      />
    </>
  );
}
