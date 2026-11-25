import { useEffect, useState } from "react";
import { tierSaleState } from "@shared/tiers";
import { cn } from "@/lib/utils";

/**
 * The event page sells the night, not the ticket. Everything here is driven
 * by the event's own data: the flyer's colours light the page, the clock
 * counts down to the real start time, and the tiers read as real tickets
 * with real sale windows. Nothing is invented to look busy (DESIGN.md,
 * "Event page: the night, not the ticket").
 */

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

/**
 * The flyer's most vivid colour, read once from a 24x24 sample. Only
 * same-origin flyers can be read (a cross-origin one taints the canvas), so
 * anything else returns null and the page keeps its default accent.
 */
export function useFlyerColor(src: string | null | undefined): string | null {
  const [hex, setHex] = useState<string | null>(null);
  useEffect(() => {
    setHex(null);
    if (!src || typeof window === "undefined") return;
    let alive = true;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 24;
        c.height = 24;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        // Bucket vivid pixels by hue and keep the strongest family: averaging
        // a blue sea with an orange sunset would give mud.
        const buckets = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const max = Math.max(R, G, B), min = Math.min(R, G, B);
          const sat = max === 0 ? 0 : (max - min) / max;
          const light = max / 255;
          // Vivid, mid-bright pixels carry the flyer's mood; greys, near-black
          // and blown-out white carry none.
          const weight = sat * sat * (light > 0.15 && light < 0.97 ? 1 : 0.05);
          if (weight <= 0 || max === min) continue;
          let hue = max === R ? ((G - B) / (max - min)) % 6 : max === G ? (B - R) / (max - min) + 2 : (R - G) / (max - min) + 4;
          if (hue < 0) hue += 6;
          const k = buckets[Math.floor(hue * 2) % 12];
          k.r += R * weight; k.g += G * weight; k.b += B * weight; k.w += weight;
        }
        const top = buckets.reduce((best, k) => (k.w > best.w ? k : best));
        const r = top.r, g = top.g, b = top.b, w = top.w;
        if (w < 1) return;
        let R = r / w, G = g / w, B = b / w;
        // Lift dark averages so the glow reads on the dark page.
        const peak = Math.max(R, G, B);
        if (peak < 170) { const k = 170 / Math.max(peak, 1); R *= k; G *= k; B *= k; }
        const h = (n: number) => Math.round(Math.min(255, n)).toString(16).padStart(2, "0");
        if (alive) setHex(`#${h(R)}${h(G)}${h(B)}`);
      } catch {
        /* cross-origin or decode failure: keep the default accent */
      }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return hex;
}

/** Ticks every second while mounted and the target is ahead. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span
        className="font-display text-3xl min-[380px]:text-4xl font-bold text-ink tabular-nums leading-none"
        aria-hidden="true"
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-ink">{label}</span>
    </div>
  );
}

/**
 * "The night starts in 12 : 04 : 31 : 08". Real start time only; switches to
 * a live state while the event runs and disappears once it has ended.
 */
export function NightCountdown({
  startsAt,
  endsAt,
  accent,
  earlyBird,
}: {
  startsAt: number;
  endsAt: number | null;
  accent: string;
  earlyBird?: { name: string; price: number; closesAt: number; nextPrice: number | null } | null;
}) {
  const end = endsAt ?? startsAt + 6 * 3600_000;
  const now = useNow(Date.now() < end);
  if (now >= end) return null;
  const live = now >= startsAt;
  const ms = Math.max(0, startsAt - now);
  const days = Math.floor(ms / 86400_000);
  const hours = Math.floor((ms % 86400_000) / 3600_000);
  const mins = Math.floor((ms % 3600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const today = !live && new Date(startsAt).toDateString() === new Date(now).toDateString();

  const ebLeft = earlyBird ? earlyBird.closesAt - now : 0;
  const ebText = earlyBird && ebLeft > 0
    ? (() => {
        const d = Math.floor(ebLeft / 86400_000);
        const h = Math.floor((ebLeft % 86400_000) / 3600_000);
        const m = Math.floor((ebLeft % 3600_000) / 60_000);
        return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
      })()
    : null;

  return (
    <div
      className="relative mt-6 overflow-hidden rounded-md border border-white/10 bg-surface/70 backdrop-blur-md"
      style={{ boxShadow: `inset 0 1px 0 ${accent}33, 0 24px 60px -30px ${accent}88` }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(90% 120% at 0% 0%, ${accent}26 0%, transparent 60%)` }}
      />
      <div className="relative px-4 py-4 sm:px-5">
        {live ? (
          <p className="flex items-center gap-2.5 font-display text-xl font-bold text-ink">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: accent }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: accent }} />
            </span>
            Happening now
          </p>
        ) : (
          <>
            <p className="eyebrow" style={{ color: accent }}>
              {today ? "Tonight. Doors in" : "The night starts in"}
            </p>
            <div
              className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-x-1.5"
              role="timer"
              aria-label={`${days} days ${hours} hours ${mins} minutes until the event starts`}
            >
              <Unit value={days} label={days === 1 ? "day" : "days"} />
              <span className="font-display text-2xl text-muted-ink/60 leading-none pt-1" aria-hidden="true">:</span>
              <Unit value={hours} label="hrs" />
              <span className="font-display text-2xl text-muted-ink/60 leading-none pt-1" aria-hidden="true">:</span>
              <Unit value={mins} label="min" />
              <span className="font-display text-2xl text-muted-ink/60 leading-none pt-1" aria-hidden="true">:</span>
              <Unit value={secs} label="sec" />
            </div>
          </>
        )}
        {earlyBird && ebText && !live && (
          <p className="mt-4 pt-3 border-t border-white/10 text-xs sm:text-sm text-muted-ink">
            <span className="font-semibold text-ink">{earlyBird.name} {naira(earlyBird.price)}</span>
            {" "}ends in <span className="font-semibold" style={{ color: accent }}>{ebText}</span>
            {earlyBird.nextPrice ? <>, then from {naira(earlyBird.nextPrice)}</> : null}.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The tier that closes soonest while still on sale, with the next price up.
 * Only a real early window counts: a tier that simply sells until the night
 * (closing within a day of the start) is not an early bird.
 */
export function earlyBirdOf(tiers: any[], startsAt: number, now = Date.now()) {
  const onSale = tiers.filter((t) => tierSaleState(t, now) === "on" && Number(t.price) > 0);
  const closing = onSale
    .filter((t) => t.saleClose && Date.parse(t.saleClose) > now && Date.parse(t.saleClose) < startsAt - 86400_000)
    .sort((a, b) => Date.parse(a.saleClose) - Date.parse(b.saleClose))[0];
  if (!closing) return null;
  const left = Math.max(0, Number(closing.capacity || 0) - Number(closing.sold || 0));
  if (left <= 0) return null;
  const higher = tiers
    .map((t) => Number(t.price))
    .filter((p) => p > Number(closing.price))
    .sort((a, b) => a - b)[0];
  return {
    name: String(closing.name || "Early Bird").trim(),
    price: Number(closing.price),
    closesAt: Date.parse(closing.saleClose),
    nextPrice: higher ?? null,
  };
}

/**
 * Tiers as ticket stubs: name, what it gets you, price, and a perforated
 * tear line. Counts show only when the organizer allows it, and the fill bar
 * only once a tier is genuinely running low.
 */
export function TicketStubs({
  tiers,
  showCounts,
  accent,
  onPick,
  disabled,
}: {
  tiers: any[];
  showCounts: boolean;
  accent: string;
  onPick: (tierName: string) => void;
  disabled?: boolean;
}) {
  if (tiers.length === 0) return null;
  const now = Date.now();
  return (
    <div className="mt-3 flex flex-col gap-3">
      {tiers.map((t, i) => {
        const cap = Math.max(0, Number(t.capacity || 0));
        const left = Math.max(0, cap - Number(t.sold || 0));
        const state = tierSaleState(t, now);
        const gone = left <= 0;
        const unavailable = gone || state !== "on";
        const low = showCounts && !gone && cap > 0 && (left <= 20 || left / cap <= 0.15);
        const status = gone
          ? "Sold out"
          : state === "closed"
            ? "Sales ended"
            : state === "upcoming"
              ? `On sale ${new Date(String(t.saleOpen)).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}`
              : state === "off"
                ? "Not on sale"
                : null;
        return (
          <button
            key={`${t.name}-${i}`}
            type="button"
            onClick={() => onPick(String(t.name))}
            disabled={disabled || unavailable}
            className={cn(
              "press group relative flex w-full items-stretch overflow-hidden rounded-md border text-left transition-colors",
              unavailable || disabled
                ? "border-hairline bg-surface/60 opacity-60 cursor-not-allowed"
                : "border-white/10 bg-surface/80 hover:border-[var(--stub-accent)] cursor-pointer",
            )}
            style={{ ["--stub-accent" as any]: `${accent}99` }}
          >
            <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1" style={{ background: unavailable ? "transparent" : accent }} />
            <span className="min-w-0 flex-1 px-4 py-3.5 pl-5">
              <span className="block font-display text-base sm:text-lg font-bold text-ink leading-tight truncate">
                {String(t.name || "Ticket").trim()}
              </span>
              {t.description && (
                <span className="mt-1 block text-xs text-muted-ink leading-snug line-clamp-2">{String(t.description).trim()}</span>
              )}
              {status ? (
                <span className="mt-2 inline-block text-[11px] font-medium uppercase tracking-wider text-muted-ink">{status}</span>
              ) : low ? (
                <span className="mt-2.5 block">
                  <span className="block h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(6, Math.round(((cap - left) / cap) * 100))}%`, background: accent }}
                    />
                  </span>
                  <span className="mt-1 block text-[11px] font-medium" style={{ color: accent }}>Only {left} left</span>
                </span>
              ) : null}
            </span>
            {/* Perforated tear line between the ticket and its stub */}
            <span aria-hidden="true" className="w-0 border-l-2 border-dashed border-white/15 my-3" />
            <span className="flex w-[104px] sm:w-[116px] shrink-0 flex-col items-center justify-center px-2 py-3 text-center">
              <span className="font-display text-lg sm:text-xl font-bold text-ink leading-none">
                {Number(t.price) > 0 ? naira(Number(t.price)) : "Free"}
              </span>
              {!unavailable && !disabled && (
                <span className="mt-1.5 text-[11px] font-semibold" style={{ color: accent }}>Get it →</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
