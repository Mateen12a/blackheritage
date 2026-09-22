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

async function callGemini(parts: GeminiPart[]): Promise<ExtractedEvent> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI is not configured");

  const res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status})`);
  }

  const json: any = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  if (!text.trim()) throw new Error("The model returned nothing readable");

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
