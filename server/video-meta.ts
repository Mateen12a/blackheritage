/**
 * Just enough MP4/MOV parsing to read a clip's length without ffmpeg.
 *
 * Phones save MP4 (Android) or MOV (iPhone); both are ISO base media files: a
 * list of boxes, each `[size:u32][type:4 chars][body]`. The length lives in
 * moov > mvhd as duration / timescale.
 */

/** First box types a real MP4 or MOV file starts with. Anything else is not a video we accept. */
const FIRST_BOX = new Set(["ftyp", "wide", "free", "skip", "mdat", "moov"]);

export function looksLikeMp4(buf: Buffer): boolean {
  return buf.length >= 12 && FIRST_BOX.has(buf.toString("latin1", 4, 8));
}

/** Body bounds of the first `type` box between start and end, or null. */
function findBox(buf: Buffer, start: number, end: number, type: string): [number, number] | null {
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) return null;
      const big = buf.readBigUInt64BE(p + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - p; // runs to the end of the file
    }
    if (size < header || p + size > end) return null;
    if (buf.toString("latin1", p + 4, p + 8) === type) return [p + header, p + size];
    p += size;
  }
  return null;
}

/** The clip's length in seconds, or null when the file doesn't say (we then don't block it). */
export function mp4DurationSeconds(buf: Buffer): number | null {
  try {
    const moov = findBox(buf, 0, buf.length, "moov");
    if (!moov) return null;
    const mvhd = findBox(buf, moov[0], moov[1], "mvhd");
    if (!mvhd) return null;
    const [s, e] = mvhd;
    let timescale: number;
    let duration: number;
    if (buf[s] === 1) {
      if (s + 32 > e) return null;
      timescale = buf.readUInt32BE(s + 20);
      duration = Number(buf.readBigUInt64BE(s + 24));
    } else {
      if (s + 20 > e) return null;
      timescale = buf.readUInt32BE(s + 12);
      duration = buf.readUInt32BE(s + 16);
    }
    // Fragmented files can carry 0 here, and all-ones also means "not set":
    // both are "unknown", not a real length.
    if (!timescale || !duration) return null;
    const seconds = duration / timescale;
    return Number.isFinite(seconds) && seconds < 24 * 3600 ? seconds : null;
  } catch {
    return null;
  }
}
