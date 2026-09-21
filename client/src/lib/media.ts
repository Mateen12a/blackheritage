/**
 * Vendor portfolio media parsing — the client-side twin of the API shape.
 * gallery/videos/socials arrive as JSON strings from the API columns.
 */

export type VendorSocials = Partial<Record<"instagram" | "x" | "tiktok" | "youtube", string>>;

export function parseGallery(json?: string | null): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function parseSocials(json?: string | null): VendorSocials {
  try {
    const parsed = JSON.parse(json || "{}");
    return typeof parsed === "object" && parsed ? (parsed as VendorSocials) : {};
  } catch {
    return {};
  }
}

export type VideoView =
  | { kind: "iframe"; src: string } // YouTube embed
  | { kind: "file"; src: string } // direct video file
  | { kind: "link"; src: string }; // anything else: open externally

/** Turn any video URL into something renderable: YouTube embed, video file, or plain link. */
export function videoView(url: string): VideoView {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/,
  );
  if (yt) {
    return { kind: "iframe", src: "https://www.youtube.com/embed/" + yt[1] };
  }
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) {
    return { kind: "file", src: url };
  }
  return { kind: "link", src: url };
}

export const socialMeta = {
  instagram: { label: "Instagram", baseUrl: "https://instagram.com/", placeholder: "instagram.com/yourbrand" },
  x: { label: "X", baseUrl: "https://x.com/", placeholder: "x.com/yourbrand" },
  tiktok: { label: "TikTok", baseUrl: "https://tiktok.com/@", placeholder: "tiktok.com/@yourbrand" },
  youtube: { label: "YouTube", baseUrl: "https://youtube.com/@", placeholder: "youtube.com/@yourbrand" },
} as const;

/** Accept a full URL or a bare handle; return a normalized https URL or null. */
export function normalizeSocialUrl(key: keyof typeof socialMeta, raw: string): string | null {
  const value = raw.trim().replace(/^@/, "");
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { baseUrl } = socialMeta[key];
  return baseUrl + value.replace(/^\/+/, "");
}
