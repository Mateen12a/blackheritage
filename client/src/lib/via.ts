/**
 * Sales attribution. A promoter or page shares a link ending in
 * `?via=<name>`; the name is remembered on this device for 7 days and sent
 * with the booking, so the organizer sees who sold each ticket without a
 * promo code. The newest link wins.
 */
const KEY = "bh_via";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function cleanVia(raw: string | null | undefined): string | null {
  const v = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
  return v || null;
}

/** Call once on load: stores ?via= when the visitor arrived through one. */
export function captureVia(): void {
  try {
    const v = cleanVia(new URLSearchParams(window.location.search).get("via"));
    if (v) localStorage.setItem(KEY, JSON.stringify({ v, at: Date.now() }));
  } catch {
    // storage blocked: attribution is best-effort
  }
}

export function currentVia(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { v, at } = JSON.parse(raw);
    return Date.now() - Number(at) < TTL_MS ? cleanVia(v) : null;
  } catch {
    return null;
  }
}
