import { MotionConfig, motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

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
  /** Vertical offset in px. Keep it small — 14 or less. */
  y?: number;
  duration?: number;
}

/** Quiet scroll-in reveal: fades and rises once, then never animates again. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
  duration = 0.5,
}: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
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
 * Images fade in when they enter the viewport (no scale, no slide).
 * The hover zoom stays a CSS transform on the same element
 * (`data-motion="scale-on-hover"` pattern in the cards).
 */
export function FadeImg({ src, alt, ...rest }: FadeImgProps) {
  return (
    <motion.img
      src={src}
      alt={alt}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.6, ease: "linear" }}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
}
