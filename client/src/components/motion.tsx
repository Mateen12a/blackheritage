import { MotionConfig, motion, type HTMLMotionProps } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TemplateMotion } from "@shared/themes";

/**
 * Motion system (see DESIGN.md → "Motion").
 *
 * There are exactly TWO signature moments in the product:
 *  1. The sliding gold nav underline (Navbar.tsx).
 *  2. The staggered hero reveal + slow ken-burns push-in (Home.tsx).
 *
 * Everything else uses the quiet helpers below: `Reveal` for scroll-in
 * sections (small 14px rise, once), `FadeImg` for images fading in, and
 * the `press` utility for button feedback. Nothing bounces, nothing lifts.
 * `MotionProvider` maps `prefers-reduced-motion` to instant states.
 *
 * Beyond those, "moments" (DESIGN.md → "Moments") answer an action or a real
 * number changing: ticket issued, gate scan, organiser counts. They use the
 * helpers at the bottom of this file: `CountUp`, `buzz`, `prefersReducedMotion`.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before starting (for small stagger chains). */
  delay?: number;
  /** Vertical offset in px. Keep it small: 14 or less. */
  y?: number;
  duration?: number;
  /** Event-page templates can drive the entrance style. Default is the
   *  platform's quiet rise; "bloom" scales in softly, "slide" enters
   *  from the left. Reduced-motion users always get instant states. */
  variant?: TemplateMotion;
}

/** Quiet scroll-in reveal: fades and rises once, then never animates again. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
  duration = 0.5,
  variant = "rise",
}: RevealProps) {
  const styles =
    variant === "bloom"
      ? { hidden: { opacity: 0, scale: 0.975 }, shown: { opacity: 1, scale: 1 } }
      : variant === "slide"
        ? { hidden: { opacity: 0, x: -22 }, shown: { opacity: 1, x: 0 } }
        : { hidden: { opacity: 0, y }, shown: { opacity: 1, y: 0 } };
  return (
    <motion.div
      className={className}
      initial={styles.hidden}
      whileInView={styles.shown}
      // Reveal when the block's top edge enters the screen. A fraction-of-
      // height threshold (was 0.25) can never be met by a block taller than
      // ~4 screens, so long panels (Brand & Custom Link, Settings) sat
      // invisible until the user scrolled.
      viewport={{ once: true, amount: 0, margin: "0px 0px -8% 0px" }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

type FadeImgProps = HTMLMotionProps<"img"> & {
  src: string;
  alt: string;
};

/**
 * Images fade in once they have actually loaded, not merely scrolled into
 * view: on a slow network the box pulses until the pixels arrive, instead of
 * fading into an empty frame and popping later. No scale, no slide; the hover
 * zoom stays a CSS transform on the same element.
 */
export function FadeImg({ src, alt, className, onLoad, onError, ...rest }: FadeImgProps) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    setReady(Boolean(ref.current?.complete && ref.current.naturalWidth));
  }, [src]);
  return (
    <motion.img
      ref={ref}
      src={src}
      alt={alt}
      initial={false}
      animate={{ opacity: ready ? 1 : 0.55 }}
      transition={{ duration: 0.5, ease: "linear" }}
      loading="lazy"
      decoding="async"
      onLoad={(e) => {
        setReady(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setReady(true);
        onError?.(e);
      }}
      className={[className, ready ? "" : "bg-surface-2 animate-pulse"].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

// ── Moments: motion that answers something the user just did ──
// See DESIGN.md → "Motion: moments, not decoration". These are for real
// state changes only (a ticket issued, a scan, a number that changed).

/** True when the visitor asked the OS for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/**
 * A real number rolling up to its value: on first view from 0, and from
 * the previous value whenever it changes (a new sale, a new check-in).
 * Only for true counts; never animate a number that is not real.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 0.9,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  const from = useRef(prefersReducedMotion() ? value : 0);
  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    if (prefersReducedMotion() || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (target - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [value, duration]);
  return <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>{format(shown)}</span>;
}

/** A short vibration on phones that support it (gate scans, ticket issued). */
export function buzz(pattern: number | number[]) {
  try {
    if (!prefersReducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked: the visual feedback carries it.
  }
}
