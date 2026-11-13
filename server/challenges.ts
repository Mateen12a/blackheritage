import type { Express, NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { z } from "zod";
import { ChallengeEntryModel, VendorModel, User } from "./models";
import { rateLimit } from "./auth";
import { saveUpload, deleteUpload } from "./media-storage";
import { looksLikeMp4, mp4DurationSeconds } from "./video-meta";
import {
  TALENT_HUNT,
  CHALLENGE_CATEGORY_LABEL,
  CLIP_LENGTH_GRACE_SECONDS,
  challengeEntrySchema,
  challengeJudgeSchema,
  challengePhase,
  cleanHandle,
  formatClipLength,
  type ChallengeCategory,
} from "@shared/challenge";

const MB = 1024 * 1024;
const UPLOAD_BUDGET_BYTES = TALENT_HUNT.uploadBudgetGB * 1024 * MB;
const SITE_ORIGIN = "https://blackhevents.com";

// One clip per request, held in memory only until it is checked and stored.
// Phones record MP4 (Android) or MOV (iPhone); nothing else is accepted.
const entryVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TALENT_HUNT.maxUploadMB * MB, files: 1, fields: 20 },
  fileFilter: (_req, file, cb) => {
    if (!videoMime(file)) return cb(new Error("NOT_VIDEO"));
    cb(null, true);
  },
}).single("video");

/**
 * The type to store a clip as. Some phones send a blank or generic type, so the
 * extension decides then; the bytes themselves are checked after (looksLikeMp4).
 */
function videoMime(file: { mimetype: string; originalname: string }): "video/mp4" | "video/quicktime" | null {
  if (file.mimetype === "video/mp4" || file.mimetype === "video/quicktime") return file.mimetype;
  if (!file.mimetype || file.mimetype === "application/octet-stream") {
    if (/\.mp4$/i.test(file.originalname)) return "video/mp4";
    if (/\.mov$/i.test(file.originalname)) return "video/quicktime";
  }
  return null;
}

function receiveEntryVideo(req: Request, res: Response, next: NextFunction) {
  entryVideo(req, res, (err: any) => {
    if (!err) return next();
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: `That video is over ${TALENT_HUNT.maxUploadMB} MB. Send it to yourself on WhatsApp, save the copy WhatsApp makes (it's much smaller) and upload that.`,
      });
    }
    if (err?.message === "NOT_VIDEO") {
      return res.status(400).json({ message: "Upload an MP4 or MOV video, the kind your phone camera records." });
    }
    return res.status(400).json({ message: "The upload didn't come through. Try again." });
  });
}

/** Bytes the contest's uploads already use, leaving out the entry being replaced. */
async function uploadBytesInUse(excludeId?: unknown): Promise<number> {
  const match: any = { challengeKey: TALENT_HUNT.key, videoSource: "upload" };
  if (excludeId) match._id = { $ne: excludeId };
  const rows: any[] = await ChallengeEntryModel.aggregate([
    { $match: match },
    { $group: { _id: null, bytes: { $sum: "$videoBytes" } } },
  ]);
  return Number(rows[0]?.bytes || 0);
}

/** Absolute link for spreadsheets and messages; stored uploads are site-relative. */
function absoluteVideoUrl(url: string): string {
  return url.startsWith("/") ? `${SITE_ORIGIN}${url}` : url;
}

// Entering lists the entrant in the talent directory. Music maps onto an
// existing directory category; dance and comedy use "Other" with a label.
const TALENT_CATEGORY: Record<ChallengeCategory, { category: string; categoryLabel: string }> = {
  music: { category: "Solo Artist", categoryLabel: "Musician" },
  dance: { category: "Other", categoryLabel: "Dancer" },
  comedy: { category: "Other", categoryLabel: "Comedian" },
};

function parseJson<T>(raw: unknown, fallback: T): T {
  try {
    const value = JSON.parse(String(raw || ""));
    return (value ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function isAdmin(req: Request): boolean {
  return req.isAuthenticated() && (req.user as any)?.role === "admin";
}

function friendlyZod(err: z.ZodError) {
  return { message: err.errors[0]?.message || "Check the form and try again", field: err.errors[0]?.path.join(".") };
}

/**
 * Create the entrant's talent profile, or add this video to the one they have.
 * `replacedUrl` is the entry's previous video: it comes off the profile so a
 * deleted upload never shows as a broken player.
 */
async function attachTalentProfile(
  userId: string,
  input: z.infer<typeof challengeEntrySchema>,
  videoUrl: string,
  replacedUrl?: string,
): Promise<string | null> {
  const instagram = cleanHandle(input.instagram);
  const tiktok = cleanHandle(input.tiktok);
  const existing: any = await VendorModel.findOne({ ownerId: userId }).sort({ createdAt: 1 });
  if (existing) {
    let videos: string[] = parseJson(existing.videos, []);
    if (replacedUrl && replacedUrl !== videoUrl) videos = videos.filter((v) => v !== replacedUrl);
    if (!videos.includes(videoUrl)) videos.push(videoUrl);
    const socials: Record<string, string> = parseJson(existing.socials, {});
    if (instagram && !socials.instagram) socials.instagram = `https://instagram.com/${instagram}`;
    if (tiktok && !socials.tiktok) socials.tiktok = `https://www.tiktok.com/@${tiktok}`;
    existing.videos = JSON.stringify(videos);
    existing.socials = JSON.stringify(socials);
    if (!existing.whatsapp) existing.whatsapp = input.whatsapp;
    existing.updatedAt = new Date();
    await existing.save();
    return String(existing._id);
  }
  const map = TALENT_CATEGORY[input.category];
  const socials: Record<string, string> = {};
  if (instagram) socials.instagram = `https://instagram.com/${instagram}`;
  if (tiktok) socials.tiktok = `https://www.tiktok.com/@${tiktok}`;
  const doc: any = await VendorModel.create({
    businessName: input.stageName,
    category: map.category,
    categoryLabel: map.categoryLabel,
    bio: input.about,
    city: input.city || undefined,
    whatsapp: input.whatsapp,
    videos: JSON.stringify([videoUrl]),
    socials: JSON.stringify(socials),
    status: "published",
    ownerId: userId,
  });
  return String(doc._id);
}

function publicEntry(e: any) {
  return {
    id: String(e._id),
    category: e.category,
    stageName: e.stageName,
    videoUrl: e.videoUrl,
    videoSource: e.videoSource || "link",
    status: e.status,
    vendorId: e.vendorId || null,
    createdAt: e.createdAt,
  };
}

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  // Leading =,+,-,@ would run as a formula when the sheet is opened.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function registerChallengeRoutes(app: Express) {
  const entryLimiter = rateLimit(20, 60 * 60 * 1000);

  // Public: the contest, its phase, entry counts, and the viewer's own entries.
  app.get("/api/challenges/talent-hunt", async (req: Request, res: Response) => {
    const phase = challengePhase();
    let counts: Record<string, number> = { music: 0, dance: 0, comedy: 0 };
    let mine: any[] = [];
    if (mongoose.connection.readyState === 1) {
      const rows = await ChallengeEntryModel.aggregate([
        { $match: { challengeKey: TALENT_HUNT.key, status: { $ne: "disqualified" } } },
        { $group: { _id: "$category", n: { $sum: 1 } } },
      ]);
      for (const r of rows as any[]) counts[r._id] = r.n;
      if (req.isAuthenticated()) {
        const userId = String((req.user as any)._id);
        mine = (await ChallengeEntryModel.find({ challengeKey: TALENT_HUNT.key, userId }).sort({ createdAt: 1 }).lean()).map(publicEntry);
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    // Admins see how much of the upload budget is gone, so the disk never surprises us.
    const storage = isAdmin(req) && mongoose.connection.readyState === 1
      ? { usedBytes: await uploadBytesInUse(), budgetBytes: UPLOAD_BUDGET_BYTES }
      : undefined;
    res.json({ key: TALENT_HUNT.key, phase, counts, total, mine, storage });
  });

  // Who may send an entry, checked before any upload is read, so a signed-out
  // visitor or a closed contest never makes the server hold a 50 MB body.
  const entryGate = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Create a free account or sign in to enter." });
    }
    const phase = challengePhase();
    if (phase !== "open" && !isAdmin(req)) {
      const message = phase === "upcoming"
        ? "Entries open on Monday 16 November. Record your video now so it's ready."
        : "Entries closed on Sunday 22 November.";
      return res.status(400).json({ message });
    }
    next();
  };

  // Signed-in entrants submit (or update) one entry per category while entries
  // are open. The video is an uploaded file (multipart) or an Instagram/TikTok
  // link (JSON or multipart); on an update, sending neither keeps the old one.
  app.post("/api/challenges/talent-hunt/entries", entryLimiter, entryGate, receiveEntryVideo, async (req: Request, res: Response) => {
    const body: Record<string, unknown> = { ...(req.body || {}) };
    // Multipart sends every field as text.
    for (const key of ["followsConfirmed", "acceptsRules"]) {
      if (body[key] === "true") body[key] = true;
    }
    let input: z.infer<typeof challengeEntrySchema>;
    try {
      input = challengeEntrySchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json(friendlyZod(err));
      throw err;
    }
    const userId = String((req.user as any)._id);
    const file = req.file;
    const link = input.videoUrl || "";
    let storedUrl = "";
    try {
      const existing: any = await ChallengeEntryModel.findOne({ challengeKey: TALENT_HUNT.key, userId, category: input.category });
      if (existing?.status === "disqualified") {
        return res.status(400).json({ message: `Your ${CHALLENGE_CATEGORY_LABEL[input.category]} entry was marked not eligible. Message us on WhatsApp if you think that's wrong.` });
      }

      let videoUrl: string;
      let videoSource: "link" | "upload";
      let videoBytes = 0;
      if (file) {
        if (!looksLikeMp4(file.buffer)) {
          return res.status(400).json({ message: "That file isn't a video we can play. Upload the MP4 or MOV your phone camera saved." });
        }
        const seconds = mp4DurationSeconds(file.buffer);
        if (seconds !== null && seconds > TALENT_HUNT.maxVideoSeconds + CLIP_LENGTH_GRACE_SECONDS) {
          return res.status(400).json({
            message: `Your video is ${formatClipLength(seconds)}. Trim it to ${formatClipLength(TALENT_HUNT.maxVideoSeconds)} or less and upload it again.`,
          });
        }
        const inUse = await uploadBytesInUse(existing?._id);
        if (inUse + file.size > UPLOAD_BUDGET_BYTES) {
          console.warn(`[challenges] upload budget reached: ${(inUse / 1024 / MB).toFixed(2)} GB in use`);
          return res.status(400).json({
            message: `Uploads are full. Post your video on Instagram or TikTok with ${TALENT_HUNT.hashtag}, then paste the link here instead.`,
          });
        }
        storedUrl = (await saveUpload(file.buffer, file.originalname, videoMime(file) || "video/mp4")).url;
        videoUrl = storedUrl;
        videoSource = "upload";
        videoBytes = file.size;
      } else if (link) {
        videoUrl = link;
        videoSource = "link";
      } else if (existing?.videoUrl) {
        videoUrl = existing.videoUrl;
        videoSource = existing.videoSource || "link";
        videoBytes = existing.videoBytes || 0;
      } else {
        return res.status(400).json({ message: "Upload your video, or paste the link to your Instagram or TikTok post." });
      }

      // Read before `existing` is overwritten below.
      const previousUrl: string | undefined = existing?.videoUrl;
      const previousWasUpload = existing?.videoSource === "upload";
      const vendorId = await attachTalentProfile(userId, input, videoUrl, previousUrl);
      const now = new Date();
      const fields = {
        stageName: input.stageName,
        videoUrl,
        videoSource,
        videoBytes,
        about: input.about,
        whatsapp: input.whatsapp,
        instagram: cleanHandle(input.instagram),
        tiktok: cleanHandle(input.tiktok),
        city: input.city || "",
        followsConfirmed: true,
        acceptedRulesAt: now,
        vendorId,
        updatedAt: now,
      };
      let entry: any;
      if (existing) {
        Object.assign(existing, fields);
        entry = await existing.save();
      } else {
        entry = await ChallengeEntryModel.create({ challengeKey: TALENT_HUNT.key, userId, category: input.category, ...fields });
      }
      // The entry now points at the new video; the old uploaded file is dead weight.
      if (previousWasUpload && previousUrl && previousUrl !== videoUrl) {
        await deleteUpload(previousUrl);
      }
      res.status(existing ? 200 : 201).json({ updated: Boolean(existing), entry: publicEntry(entry) });
    } catch (err: any) {
      console.error("[challenges] entry failed:", err?.message);
      // Don't leave an orphaned file behind a failed save.
      if (storedUrl) await deleteUpload(storedUrl);
      res.status(500).json({ message: "Your entry didn't save. Try again in a moment." });
    }
  });

  // Admin: every entry for judging, as JSON or a CSV for a spreadsheet.
  app.get("/api/admin/challenges/talent-hunt/entries", async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Only admins can see contest entries." });
    const filter: any = { challengeKey: TALENT_HUNT.key };
    const category = String(req.query.category || "");
    if (category && category in CHALLENGE_CATEGORY_LABEL) filter.category = category;
    const entries: any[] = await ChallengeEntryModel.find(filter).sort({ category: 1, createdAt: 1 }).lean();
    const users: any[] = await User.find({ _id: { $in: entries.map((e) => e.userId).filter((id) => mongoose.isValidObjectId(id)) } })
      .select("email username")
      .lean();
    const emailOf = new Map(users.map((u) => [String(u._id), u.email || ""]));
    const rows = entries.map((e) => ({
      id: String(e._id),
      category: e.category,
      stageName: e.stageName,
      videoUrl: e.videoUrl,
      videoSource: e.videoSource || "link",
      about: e.about,
      whatsapp: e.whatsapp,
      instagram: e.instagram || "",
      tiktok: e.tiktok || "",
      city: e.city || "",
      email: emailOf.get(String(e.userId)) || "",
      status: e.status,
      score: e.score ?? null,
      judgeNote: e.judgeNote || "",
      vendorId: e.vendorId || null,
      createdAt: e.createdAt,
    }));
    if (req.query.format === "csv") {
      const header = ["Category", "Stage name", "Video", "Video type", "About", "WhatsApp", "Instagram", "TikTok", "City", "Email", "Status", "Score", "Judge note", "Profile", "Entered"];
      const lines = rows.map((r) => [
        CHALLENGE_CATEGORY_LABEL[r.category as ChallengeCategory], r.stageName, absoluteVideoUrl(r.videoUrl),
        r.videoSource === "upload" ? "Uploaded" : "Link", r.about, r.whatsapp,
        r.instagram ? `@${r.instagram}` : "", r.tiktok ? `@${r.tiktok}` : "", r.city, r.email, r.status, r.score ?? "", r.judgeNote,
        r.vendorId ? `https://blackhevents.com/talent/${r.vendorId}` : "", new Date(r.createdAt).toISOString(),
      ].map(csvCell).join(","));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="bh-talent-hunt-entries.csv"`);
      return res.send([header.join(","), ...lines].join("\n"));
    }
    res.json(rows);
  });

  // Admin: shortlist, pick a winner, mark not eligible, score, note.
  app.patch("/api/admin/challenges/talent-hunt/entries/:id", async (req: Request, res: Response) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Only admins can judge entries." });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "That entry doesn't exist." });
    try {
      const input = challengeJudgeSchema.parse(req.body);
      const entry: any = await ChallengeEntryModel.findOneAndUpdate(
        { _id: req.params.id, challengeKey: TALENT_HUNT.key },
        { $set: { ...input, updatedAt: new Date() } },
        { new: true },
      ).lean();
      if (!entry) return res.status(404).json({ message: "That entry doesn't exist." });
      res.json({ id: String(entry._id), status: entry.status, score: entry.score ?? null, judgeNote: entry.judgeNote || "" });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json(friendlyZod(err));
      throw err;
    }
  });
}
