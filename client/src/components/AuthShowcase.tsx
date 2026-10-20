import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Check, Landmark, MessageCircle, Ticket } from "lucide-react";
import { drawQRCode } from "@/lib/qr";
import type { Event } from "@shared/schema";

type Variant = "attendee" | "organizer" | "vendor";

/**
 * The auth page's brand panel: one product object per role, so the left side
 * answers "what do I get" for whoever is signing up. Static composition; the
 * only motion is a short crossfade when the role changes.
 */
export function AuthShowcase({
  audience,
  isRegister,
  event,
}: {
  audience: Variant;
  isRegister: boolean;
  event?: Event | null;
}) {
  const variant: Variant = isRegister ? audience : "attendee";
  const copy = !isRegister
    ? { title: ["Welcome", "back."], line: "Your tickets, sales and bookings are where you left them." }
    : COPY[variant];

  return (
    <div className="relative">
      <h2 className="font-display text-4xl xl:text-5xl font-bold text-ink leading-[1.05] tracking-tight">
        {copy.title[0]} <span className="italic text-gold">{copy.title[1]}</span>
      </h2>
      <div className="mt-4 h-0.5 w-12 bg-gold" aria-hidden="true" />
      <p className="mt-4 text-sm text-muted-ink leading-relaxed max-w-sm">{copy.line}</p>

      <motion.div
        key={variant}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10"
        aria-hidden="true"
      >
        {variant === "attendee" && <TicketObject event={event} />}
        {variant === "organizer" && <SalesObject />}
        {variant === "vendor" && <BookingObject />}
      </motion.div>
    </div>
  );
}

const COPY: Record<Variant, { title: [string, string]; line: string }> = {
  attendee: { title: ["Your night,", "in your pocket."], line: "Pay by card, transfer or USSD. Your ticket lands on screen and in your inbox, and the gate scans it from your phone." },
  organizer: { title: ["Sell out.", "Get paid."], line: "Share one link. Every sale lands on your dashboard, and the money goes to your Nigerian bank the next business day." },
  vendor: { title: ["Get booked", "on your work."], line: "A profile planners can trust: your photos, your services, your area. They message you directly." },
};

function TicketObject({ event }: { event?: Event | null }) {
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const url = event ? `https://blackhevents.com/e/${(event as any).slug || event.id}` : "https://blackhevents.com";
  useEffect(() => {
    const c = qrRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawQRCode(ctx, url, 0, 0, c.width, { darkColor: "#0F0F14", lightColor: "#FFFFFF", margin: 2, rounded: false });
  }, [url]);

  const title = event?.title || "Your next night out";
  const when = event?.date ? format(new Date(event.date), "EEE d MMM · h:mm a") : "Sat · 9:00 PM";
  const where = event?.location?.split(",")[0] || "Lagos";

  return (
    <div className="relative max-w-sm -rotate-2">
      {/* The stub behind: a second ticket, so the object reads as "tickets", plural */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-md border border-hairline bg-surface-2/60" />
      <div className="relative rounded-md border border-hairline bg-surface-2 overflow-hidden">
        <div className="h-28 relative bg-background">
          {event?.imageUrl ? (
            <img src={event.imageUrl} alt="" className="w-full h-full object-cover opacity-90" />
          ) : (
            <div className="w-full h-full bg-[radial-gradient(120%_120%_at_20%_0%,rgba(227,178,60,0.28),transparent_60%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-2 via-surface-2/20 to-transparent" />
          <span className="absolute left-4 bottom-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-ink">
            <Ticket className="w-3.5 h-3.5 text-gold" /> Admit one
          </span>
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="font-display text-xl font-bold text-ink leading-tight line-clamp-2">{title}</p>
          <p className="mt-1 text-xs text-muted-ink truncate">{when} · {where}</p>
        </div>
        {/* Perforation: dashed rule with notches cut in the panel colour */}
        <div className="relative h-0 border-t border-dashed border-hairline">
          <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-surface border-r border-hairline" />
          <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-surface border-l border-hairline" />
        </div>
        <div className="flex items-center gap-4 p-4">
          <div className="rounded bg-white p-1.5 shrink-0">
            <canvas ref={qrRef} width={168} height={168} className="w-[84px] h-[84px] block" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-ink">Ticket code</p>
            <p className="font-mono text-sm text-ink tracking-wider">BH-7KQ2M4XA</p>
            <p className="mt-2 text-[11px] text-muted-ink">Scan at the gate. Works offline.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const BARS = [28, 42, 35, 58, 49, 71, 94];

function SalesObject() {
  return (
    <div className="relative max-w-sm">
      <div className="rounded-md border border-hairline bg-surface-2 p-5">
        <p className="text-[11px] text-muted-ink">This week</p>
        <p className="font-display text-3xl font-bold text-ink tabular-nums">₦1,248,000</p>
        <div className="mt-5 flex items-end gap-2 h-20">
          {BARS.map((h, i) => (
            <div
              key={i}
              className={i === BARS.length - 1 ? "flex-1 rounded-sm bg-gold" : "flex-1 rounded-sm bg-hairline"}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-ink">
          <span>Mon</span><span>Sun</span>
        </div>
        <div className="mt-5 pt-4 border-t border-hairline flex items-center gap-2 text-xs text-muted-ink">
          <Landmark className="w-3.5 h-3.5 text-gold" />
          Paid to your bank the next business day
        </div>
      </div>
      {/* A sale arriving, pinned over the corner of the card */}
      <div className="absolute -right-6 -top-6 w-60 rotate-2 rounded-md border border-hairline bg-background p-3 flex items-start gap-3">
        <span className="h-8 w-8 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
          <Ticket className="w-4 h-4 text-gold" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink">New ticket sold</p>
          <p className="text-[11px] text-muted-ink truncate">General Admission · ₦6,000</p>
        </div>
      </div>
    </div>
  );
}

function BookingObject() {
  return (
    <div className="relative max-w-sm">
      <div className="rounded-md border border-hairline bg-surface-2 p-5">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-full border border-gold/50 bg-background flex items-center justify-center font-display text-lg font-bold text-gold">
            DZ
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ink leading-tight">DJ Zoro</p>
            <p className="text-xs text-muted-ink">DJ · Lekki, Lagos</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["Afrobeats", "Amapiano", "Weddings"].map((t) => (
            <span key={t} className="text-[11px] text-muted-ink border border-hairline rounded px-2 py-0.5">{t}</span>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          <div className="max-w-[85%] rounded-md bg-background border border-hairline px-3 py-2 text-xs text-ink">
            Are you free on Saturday 31st? Rooftop party, 300 guests.
          </div>
          <div className="ml-auto max-w-[70%] rounded-md bg-gold px-3 py-2 text-xs text-background font-medium">
            Yes, I'm free. Sending my rate now.
          </div>
        </div>
      </div>
      <div className="absolute -right-5 -bottom-5 rotate-2 rounded-md border border-hairline bg-background px-3 py-2 flex items-center gap-2 text-xs text-ink">
        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
        Booked on WhatsApp
        <Check className="w-3.5 h-3.5 text-gold" />
      </div>
    </div>
  );
}
