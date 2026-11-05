import type { Request, Response } from "express";

/**
 * AI event extraction: an organizer drops in a designed flyer or a document,
 * Gemini reads it, and the event form prefills. The human always reviews and
 * confirms; nothing is created or published by the model.
 *
 * One module owns the Gemini boundary: model choice, prompt, JSON schema,
 * and error handling. Routes call `extractEventFromFile` and nothing else.
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export function isAIConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** The shape the event form consumes. Every field optional: the form keeps whatever the model found. */
export interface ExtractedEvent {
  title?: string;
  description?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  location?: string;
  tiers?: { name: string; price: number }[];
  organizerName?: string;
  socials?: { instagram?: string; twitter?: string; whatsapp?: string; website?: string };
  notes?: string; // anything the model wants the human to double-check
}

const PROMPT = `You read event flyers, posters, and documents for a Nigerian event ticketing platform.
Extract every event detail you can find and return ONLY a JSON object with this exact shape (omit any field you cannot find, never invent values):

{
  "title": string,
  "description": string,          // 1-3 sentences, plain language, keep the original voice
  "date": "YYYY-MM-DD",
  "time": "HH:mm",               // 24-hour
  "location": string,            // venue name, include city
  "tiers": [{ "name": string, "price": number }],  // price in whole NAIRA (not kobo), 0 if free
  "organizerName": string,
  "socials": { "instagram": string, "twitter": string, "whatsapp": string, "website": string },
  "notes": string                // one short line: anything ambiguous the human should double-check
}

Rules:
- Nigerian naira amounts are often written as "5,000" or "5K" or "#5,000": convert to whole naira numbers.
- If the flyer shows a table/bottle-service price, include it as a tier named "Table Booking".
- Dates without a year mean the next occurrence of that date.
- If the image is not an event flyer or document, return {"notes": "not an event document"}.
- Never invent a value. Omit what you cannot read.`;

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(parts: GeminiPart[], tool: "reader" | "writer" = "reader"): Promise<ExtractedEvent> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI is not configured");

  // Status codes and vendor names stay in the logs. Organizers get a plain
  // sentence that says what to do next.
  const what = tool === "reader" ? "flyer reader" : "writing helper";
  const friendly = (status: number) => {
    if (status === 429) return new Error(`The ${what} has reached its limit for now. Try again a bit later.`);
    // 402: the AI account is out of credit; retrying will not help.
    if (status === 402 || status === 403) return new Error(`The ${what} is paused right now. Fill in the details below; your flyer is still used as the cover.`);
    if (status >= 500) return new Error(`The ${what} is unavailable right now. Try again in a few minutes.`);
    return new Error(`The ${what} could not finish that request. Try again in a moment.`);
  };

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    });
  } catch (e: any) {
    console.error("AI network error:", e?.message);
    throw new Error(`Could not reach the ${what}. Check the connection and try again.`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`AI request failed (${res.status}):`, body.slice(0, 200));
    throw friendly(res.status);
  }

  const json: any = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  if (!text.trim()) throw new Error("The flyer reader came back empty. Try again in a moment.");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Tolerate fences or stray prose around the JSON.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not read the flyer as event details");
    parsed = JSON.parse(match[0]);
  }

  if (parsed && typeof parsed === "object" && !parsed.title && !parsed.date && !parsed.location) {
    throw new Error(parsed.notes || "Could not find event details in that file");
  }
  return parsed as ExtractedEvent;
}

/** Accepts an already-validated upload (multer file) and extracts event details. */
export async function extractEventFromFile(file: Express.Multer.File): Promise<ExtractedEvent> {
  const mime = file.mimetype;
  const data = file.buffer.toString("base64");

  if (mime === "application/pdf") {
    return callGemini([
      { text: PROMPT },
      { inline_data: { mime_type: "application/pdf", data } },
    ]);
  }
  if (mime.startsWith("image/")) {
    return callGemini([
      { text: PROMPT },
      { inline_data: { mime_type: mime, data } },
    ]);
  }
  if (mime.startsWith("text/") || mime === "application/json") {
    const text = file.buffer.toString("utf8").slice(0, 40_000);
    return callGemini([{ text: PROMPT + "\n\nDocument contents:\n" + text }]);
  }
  throw new Error("Upload a flyer image, PDF, or text document");
}

/** Multer memory storage for the AI endpoint: files go straight to the model, never to disk. */
export const aiUploadLimiter = {
  limits: { fileSize: 15 * 1024 * 1024 },
  okMime: (m: string) =>
    m === "application/pdf" || m.startsWith("image/") || m.startsWith("text/") || m === "application/json",
};

// ── Copy suggestion ──
// Same boundary style as extraction: one prompt, strict JSON out, and the
// caller decides what to do with it. Text comes back as plain sentences with
// no marketing filler, no emoji, no hashtags unless the flyer had them.

export interface CopyRequest {
  kind: "description" | "announcement" | "bio";
  facts: {
    title?: string;
    date?: string;
    location?: string;
    eventType?: string;
    price?: number; // whole naira
    tiers?: { name: string; price: number }[]; // whole naira
    organizerName?: string;
    notes?: string; // extra context the organizer typed
  };
}

export interface CopyResult {
  variants: string[];
}

const COPY_PROMPT = (kind: string, factsJson: string) => `You write event copy for a Nigerian ticketing platform. The organizer will review and edit before anything is saved.

Write ${kind === "description"
  ? "3 description variants for the event page"
  : kind === "announcement"
    ? "2 announcement variants for a banner strip pinned across the organizer's pages"
    : "2 short bio variants for the organizer's public profile"} for this event:

${factsJson}

Rules for every variant:
- Plain, warm, specific sentences. Like a sharp promoter who writes well.
- No emoji, no hashtags, no exclamation-mark stacks, no em dashes.
- No "vibes", "unforgettable", "elevate", "experience like never before", "don't miss", or similar filler. State facts: what happens, who plays, what a ticket gets you, where and when.
- Vary the structure across variants: lead differently (lineup, venue, or what the night is). Never send three templates with one word swapped.
- Announcement variants: one short line each, under 90 characters, fits a thin banner.
- Bio variants: 1-2 sentences about the organizer, not about one event.
- If a fact is missing, work around it. Never invent headliners, dates, or prices.

Return ONLY JSON: { "variants": ["..."] }`;

export async function suggestEventCopy(req: CopyRequest): Promise<CopyResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI is not configured");

  const parts: GeminiPart[] = [
    { text: COPY_PROMPT(req.kind, JSON.stringify(req.facts, null, 2)) },
  ];

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
  });

  // The free tier intermittently answers with empty candidates, 429s, or
  // 503s. One quiet retry covers most of it; a failure on both passes
  // surfaces as a plain sentence, never a status code.
  const what = "writing helper";
  const friendly = (status: number) => {
    if (status === 429) return new Error("The writing helper has reached its limit for now. Try again a bit later.");
    if (status === 402 || status === 403) return new Error("The writing helper is paused right now. Write it yourself for now.");
    if (status >= 500) return new Error("The writing helper is unavailable right now. Try again in a few minutes.");
    return new Error("The writing helper could not finish that request. Try again in a moment.");
  };

  let lastError: Error = new Error("The writing helper came back empty. Try again in a moment.");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let res: Awaited<ReturnType<typeof fetch>>;
      try {
        res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } catch (e: any) {
        console.error("AI copy network error:", e?.message);
        lastError = new Error("Could not reach the writing helper. Check the connection and try again.");
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`AI copy request failed (${res.status}):`, errBody.slice(0, 200));
        lastError = friendly(res.status);
        continue;
      }

      const json: any = await res.json();
      const text: string = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
      if (!text.trim()) {
        // Empty candidates usually means a safety block or a stop without
        // content. Log the reason so the prompt can be fixed with evidence.
        const reason = json.candidates?.[0]?.finishReason || json.promptFeedback?.blockReason || "no candidates";
        console.error("AI copy empty text for", req.kind, "- reason:", reason);
        lastError = new Error("The writing helper came back empty. Try again in a moment.");
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) {
          lastError = new Error("The writing helper returned something unreadable. Try again in a moment.");
          console.error("AI copy unparsable response:", text.slice(0, 300));
          continue;
        }
        parsed = JSON.parse(match[0]);
      }

      // The model keeps inventing its own shape despite the prompt: renamed
      // keys ("description_variants"), arrays of objects with a text field.
      // Normalize any reasonable shape before giving up.
      const rawList: any[] = Array.isArray(parsed)
        ? parsed
        : (Object.values(parsed).find((v: any) => Array.isArray(v) && v.length > 0) as any[] | undefined) || [];
      const variants: string[] = rawList
        .map((v: any) => {
          if (typeof v === "string" && v.trim()) return v.trim();
          if (v && typeof v === "object") {
            const s = Object.values(v).find((x: any) => typeof x === "string" && x.trim().length > 20) as string | undefined;
            if (s) return s.trim();
          }
          return null;
        })
        .filter((v): v is string => !!v);
      if (variants.length === 0) {
        lastError = new Error("The writing helper came back empty. Try again in a moment.");
        console.error("AI copy empty variants, raw:", text.slice(0, 300));
        continue;
      }
      return { variants: variants.slice(0, 3) };
    } catch (e: any) {
      console.error("AI copy unexpected error:", e?.message || e);
      lastError = new Error("The writing helper hit a snag. Try again in a moment.");
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flyer Studio artwork. The model paints BACKGROUND ART only: no words, no
// faces. The studio typesets the real title/date/venue on top, so text is
// always spelled right and the layout is always a designed template. Art
// direction is ours (curated styles below), not "make it look cool", which is
// what keeps the result from reading as generic AI output.
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

export const FLYER_ART_STYLES = {
  film: "A real 35mm film photograph, shot on Portra 800 at night, heavy natural grain, slight motion blur, practical light sources only, shallow depth of field, honest and unretouched.",
  texture: "A tactile close-up still life: real materials (fabric, metal, glass, paper, smoke), macro lens, hard directional light, deep shadows, rich texture you could touch. No illustration.",
  ankara: "A bold flat composition inspired by West African wax-print textiles: large confident geometric and organic shapes, limited palette of 3 colours, crisp edges, printed-paper texture, like a screen-printed poster background.",
  abstract: "Abstract light and colour: soft out-of-focus bokeh shapes, long-exposure light trails and haze photographed in camera, no hard objects, like a background plate from a music video.",
  collage: "A hand-made paper collage background: torn paper edges, risograph print texture, halftone dots, misregistered colour layers, scanned on a flatbed, intentionally imperfect.",
  minimal: "A minimal architectural photograph: a single strong shape of light and shadow on a plain wall or floor, lots of empty negative space, calm and expensive-looking.",
} as const;
export type FlyerArtStyle = keyof typeof FLYER_ART_STYLES;

const ART_ASPECT: Record<string, string> = { post: "4:5", story: "9:16", square: "1:1" };

export async function generateFlyerArt(input: {
  vibe: string; style: FlyerArtStyle; format: "post" | "story" | "square"; calm?: "top" | "bottom" | "center"; colours?: string[];
}): Promise<{ mimeType: string; data: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI is not configured");

  const vibe = String(input.vibe || "").replace(/\s+/g, " ").trim().slice(0, 240);
  const calm = input.calm === "bottom" ? "the lower half" : input.calm === "center" ? "the centre" : "the upper half";
  const colours = (input.colours || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3);
  const prompt = [
    `Background artwork for a Nigerian event poster. The night: ${vibe || "a night out in Lagos"}.`,
    `Art direction: ${FLYER_ART_STYLES[input.style] || FLYER_ART_STYLES.film}`,
    colours.length ? `Colour palette built around ${colours.join(", ")}.` : "",
    `Composition: keep ${calm} quiet, dark and uncluttered, because the poster's title will be typeset there later.`,
    "Hard rules: absolutely no text, letters, numbers, logos, watermarks, signage or writing of any kind.",
    "No human faces or close-up people; silhouettes far in the distance at most.",
    "Avoid clichés: no neon city skyline, no lens flares, no glowing particles or sparkles, no fantasy, no 3D render look, no oversaturated HDR.",
  ].filter(Boolean).join("\n");

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ART_ASPECT[input.format] || "4:5" } },
  });

  let lastError = new Error("The artwork maker came back empty. Try again in a moment.");
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${BASE}/models/${IMAGE_MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      });
    } catch (e: any) {
      console.error("AI art network error:", e?.message);
      lastError = new Error("Could not reach the artwork maker. Check the connection and try again.");
      continue;
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`AI art request failed (${res.status}):`, errBody.slice(0, 300));
      if (res.status === 429) lastError = new Error("The artwork maker has reached its limit for now. Try again a bit later.");
      else if (res.status === 400 || res.status === 402 || res.status === 403) lastError = new Error("The artwork maker is paused right now. Use your event photo or a colour background for now.");
      else lastError = new Error("The artwork maker is unavailable right now. Try again in a few minutes.");
      if (res.status < 500 && res.status !== 429) break;
      continue;
    }
    const json: any = await res.json();
    const parts: any[] = json.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = img?.inlineData || img?.inline_data;
    if (inline?.data) return { mimeType: inline.mimeType || inline.mime_type || "image/png", data: inline.data };
    const reason = json.candidates?.[0]?.finishReason || json.promptFeedback?.blockReason || "no image";
    console.error("AI art empty - reason:", reason);
    lastError = new Error("That idea did not come out. Try describing the night differently.");
  }
  throw lastError;
}
