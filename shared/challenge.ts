import { z } from "zod";

/**
 * BH Talent Hunt: the online round that feeds the NANS National Talent Hunt.
 * One contest is live at a time; its dates and copy live here so the page,
 * the server's entry window and the admin judging list never disagree.
 * All times are Lagos (WAT, UTC+1).
 */
export const TALENT_HUNT = {
  key: "bh-talent-hunt-2026",
  title: "BH Talent Hunt",
  hashtag: "#BHTalentHunt",
  opensAt: "2026-11-16T00:00:00+01:00",
  closesAt: "2026-11-22T23:59:59+01:00",
  shortlistOn: "Wed 25 Nov",
  winnersAt: "2026-11-30T00:00:00+01:00",
  winnersOn: "Mon 30 Nov",
  prizeNaira: 50_000,
  maxVideoSeconds: 60,
  /** Per uploaded file. Matches the site-wide upload limit (Nginx allows 60 MB). */
  maxUploadMB: 50,
  /**
   * Total disk the contest's uploads may use. The VM's one 100 GB volume also
   * holds MongoDB and the backups, so once this fills, entrants are asked to
   * paste an Instagram or TikTok link instead of uploading.
   */
  uploadBudgetGB: 10,
  stage: {
    title: "NANS National Talent Hunt",
    path: "/e/nans-national-talent-hunt",
    venue: "Amphitheatre, Oduduwa Hall, OAU Ile-Ife",
    date: "Thu 3 Dec",
  },
  instagram: "https://www.instagram.com/blackhevents",
  tiktok: "https://www.tiktok.com/@blackhevents",
} as const;

export const challengeCategories = ["music", "dance", "comedy"] as const;
export type ChallengeCategory = (typeof challengeCategories)[number];

export const CHALLENGE_CATEGORY_LABEL: Record<ChallengeCategory, string> = {
  music: "Music",
  dance: "Dance",
  comedy: "Comedy",
};

export const challengeEntryStatuses = ["submitted", "shortlisted", "winner", "disqualified"] as const;
export type ChallengeEntryStatus = (typeof challengeEntryStatuses)[number];

export const CHALLENGE_STATUS_LABEL: Record<ChallengeEntryStatus, string> = {
  submitted: "Received",
  shortlisted: "Top 10",
  winner: "Winner",
  disqualified: "Not eligible",
};

export type ChallengePhase = "upcoming" | "open" | "judging" | "winners";

export function challengePhase(now: number = Date.now()): ChallengePhase {
  if (now < Date.parse(TALENT_HUNT.opensAt)) return "upcoming";
  if (now <= Date.parse(TALENT_HUNT.closesAt)) return "open";
  if (now < Date.parse(TALENT_HUNT.winnersAt)) return "judging";
  return "winners";
}

/** Entries must point at a public Instagram or TikTok post. */
export function isEntryVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return /(^|\.)instagram\.com$/.test(host) || /(^|\.)tiktok\.com$/.test(host);
  } catch {
    return false;
  }
}

/** 84 -> "1:24" */
export function formatClipLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Phone trims land a fraction over a round number; don't reject 1:00.4. */
export const CLIP_LENGTH_GRACE_SECONDS = 1.5;

/** "@ada_sings", "ada_sings" or a profile URL all become a bare handle. */
export function cleanHandle(value: string | undefined | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._]+)/i);
  const handle = (fromUrl ? fromUrl[1] : raw).replace(/^@+/, "");
  return /^[A-Za-z0-9._]{1,40}$/.test(handle) ? handle : "";
}

const handleField = z
  .string()
  .trim()
  .max(80)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || cleanHandle(v) !== "", "Use your handle, like @yourname");

export const challengeEntrySchema = z.object({
  category: z.enum(challengeCategories, { errorMap: () => ({ message: "Pick Music, Dance or Comedy" }) }),
  stageName: z.string().trim().min(2, "Add your stage name").max(60, "Keep your stage name under 60 characters"),
  // Empty when the entrant uploads the file instead, or keeps the video they
  // already uploaded. The server requires one of the three.
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isEntryVideoUrl(v), "Paste the link to your Instagram or TikTok post"),
  about: z
    .string()
    .trim()
    .min(10, "Tell the judges a line or two about you")
    .max(300, "Keep it under 300 characters"),
  whatsapp: z
    .string()
    .trim()
    .min(7, "Add a WhatsApp number we can reach you on")
    .max(20)
    .regex(/^[+\d][\d\s-]{6,19}$/, "Use digits only, like 0803 123 4567"),
  instagram: handleField,
  tiktok: handleField,
  city: z.string().trim().max(60).optional().or(z.literal("")),
  followsConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Follow @blackhevents on Instagram and TikTok, then tick the box" }),
  }),
  acceptsRules: z.literal(true, {
    errorMap: () => ({ message: "Tick the box to accept the rules and the winner's agreement" }),
  }),
});
export type ChallengeEntryInput = z.infer<typeof challengeEntrySchema>;

export const challengeJudgeSchema = z.object({
  status: z.enum(challengeEntryStatuses).optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  judgeNote: z.string().trim().max(500).optional(),
});
