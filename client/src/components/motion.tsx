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
