import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
  /** Compact face for badges: "2d 14h" / "5h 12m" / "38m". */
  short: string;
}

/**
 * Ticks once a minute toward a deadline. Deadlines live in the sale windows
 * the organizer already sets; this only makes them visible.
 */
export function useCountdown(target: number | null): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const t = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, [target]);

  if (!target) {
    return { days: 0, hours: 0, minutes: 0, expired: false, short: "" };
  }

  const ms = target - now;
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true, short: "" };
  }
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const short =
    days > 0
      ? days + "d " + hours + "h"
      : hours > 0
        ? hours + "h " + mins + "m"
        : mins + "m";
  return { days, hours, minutes: mins, expired: false, short };
}
