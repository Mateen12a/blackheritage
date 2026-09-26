import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { AwsClient } from "aws4fetch";

/**
 * Uploaded media storage.
 *
 * Production uses Cloudflare R2. The disk backend stays for local dev and for
 * the test suite, which should not need cloud credentials to pass.
 *
 * A server filesystem is a bad place for user media: Render wipes it on every
 * deploy and every new instance, while the database keeps the old path. That is
 * how covers and vendor photos end up as broken images a week after upload.
 */

const LOCAL_DIR = path.resolve(process.cwd(), "uploads", "portfolio");
fs.mkdirSync(LOCAL_DIR, { recursive: true });

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const bucket = process.env.R2_BUCKET?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const publicBase = (process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");

/** Both are required: a bucket we cannot sign for, or a bucket nothing can read, is not configured. */
const r2Ready = Boolean(accountId && bucket && accessKeyId && secretAccessKey && publicBase);

export const mediaBackend: "r2" | "disk" = r2Ready ? "r2" : "disk";

/** Surfaces in /api/health so a misconfigured deploy is visible instead of silent. */
export function mediaStorageStatus() {
  return {
    backend: mediaBackend,
    durable: r2Ready,
    note: r2Ready
      ? "Uploads go to R2 and survive deploys."
      : "Uploads land on local disk and are lost on the next deploy. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_BASE_URL.",
  };
}

const client = r2Ready
  ? new AwsClient({
      accessKeyId: accessKeyId as string,
      secretAccessKey: secretAccessKey as string,
      service: "s3",
      region: "auto",
    })
  : null;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Random, unguessable object name. The original filename never reaches storage. */
export function mediaKey(originalName: string, mime: string): string {
  const fromMime = EXT_BY_MIME[mime.toLowerCase()];
  const fromName = path.extname(originalName || "").toLowerCase();
  const ext = fromMime || (/^\.[a-z0-9]{2,5}$/.test(fromName) ? fromName : ".bin");
  return `portfolio/${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
}

async function putToR2(key: string, body: Buffer, mime: string): Promise<void> {
  const res = await (client as AwsClient).fetch(
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`,
    {
      method: "PUT",
      body,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`R2 upload failed (${res.status}) ${detail.slice(0, 200)}`);
  }
}

/**
 * Store one upload and return the URL to persist.
 *
 * R2 returns an absolute URL. Disk returns the /uploads/portfolio path the app
 * has always used, so local dev and the existing rows keep working.
 */
export async function saveUpload(
  buffer: Buffer,
  originalName: string,
  mime: string,
): Promise<{ url: string; backend: "r2" | "disk" }> {
  const key = mediaKey(originalName, mime);

  if (r2Ready) {
    await putToR2(key, buffer, mime);
    return { url: `${publicBase}/${key}`, backend: "r2" };
  }

  const filename = path.basename(key);
  await fs.promises.writeFile(path.join(LOCAL_DIR, filename), buffer);
  return { url: `/uploads/portfolio/${filename}`, backend: "disk" };
}
