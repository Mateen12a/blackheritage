import { motion } from "framer-motion";
import { EASE_OUT, prefersReducedMotion } from "@/components/motion";

/**
 * Cumulative paid revenue over time, drawn left to right once when it
 * appears. Built only from real paid bookings; with fewer than two sales
 * there is no line to draw, so it renders nothing.
 */
export function SalesLine({ bookings, className }: { bookings: any[]; className?: string }) {
  const paid = bookings
    .filter((b) => b.status === "paid")
    .map((b) => ({ t: new Date(b.paidAt || b.createdAt).getTime(), v: Number(b.totalAmount || 0) }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (paid.length < 2) return null;

  let run = 0;
  const pts = paid.map((p) => ({ t: p.t, v: (run += p.v) }));
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const W = 200, H = 44, max = run || 1;
  const xy = pts.map((p) => [((p.t - t0) / Math.max(1, t1 - t0)) * W, H - 3 - (p.v / max) * (H - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const calm = prefersReducedMotion();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bh-sales-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-gold)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--color-gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#bh-sales-fill)"
        initial={calm ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={calm ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: EASE_OUT }}
      />
    </svg>
  );
}
