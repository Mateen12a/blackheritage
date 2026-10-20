import { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { FileUp, Loader2, Check, AlertTriangle, RotateCcw } from "lucide-react";
import type { InsertEvent } from "@shared/schema";

/**
 * Flyer extraction: the organizer drops a designed flyer or document, the
 * server reads it with Gemini, and the form prefills. Everything lands in the
 * normal fields for review; nothing is created until the organizer saves.
 *
 * Tier prices come back in whole naira and are stored in kobo here, matching
 * the form's own convention.
 */

interface ExtractResponse {
  details?: {
    title?: string;
    description?: string;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm
    location?: string;
    tiers?: { name: string; price: number }[];
    organizerName?: string;
    notes?: string;
  };
  message?: string;
}

const nairaToKobo = (n: number) => Math.round(n * 100);

/**
 * The flyer's signature colour: the most common vivid hue, ignoring near-black,
 * near-white and greys so the dark background of a party flyer does not win.
 * Returns #RRGGBB or null when nothing vivid enough exists.
 */
async function flyerAccent(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<number, { w: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const val = max / 255;
      if (sat < 0.5 || val < 0.6) continue;
      let h = 0;
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      const key = Math.floor((((h * 60) + 360) % 360) / 20);
      const w = sat * val * val * val; // bright, saturated hues win over a dark wash
      const cur = buckets.get(key) || { w: 0, r: 0, g: 0, b: 0 };
      buckets.set(key, { w: cur.w + w, r: cur.r + r * w, g: cur.g + g * w, b: cur.b + b * w });
    }
    let best: { w: number; r: number; g: number; b: number } | null = null;
    buckets.forEach((v) => { if (!best || v.w > best.w) best = v; });
    if (!best || (best as any).w < 20) return null;
    const pick = best as { w: number; r: number; g: number; b: number };
    const hex = (n: number) => Math.round(n / pick.w).toString(16).padStart(2, "0");
    return ("#" + hex(pick.r) + hex(pick.g) + hex(pick.b)).toUpperCase();
  } catch {
    return null;
  }
}

async function uploadCover(file: File): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads/portfolio", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.url === "string" ? data.url : null;
  } catch {
    return null;
  }
}

export function FlyerExtractPanel() {
  const form = useFormContext<InsertEvent>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [filledCount, setFilledCount] = useState(0);

  async function handleFile(file: File) {
    setState("working");
    setMessage("Reading your flyer. This takes a few seconds.");
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // An image flyer is also the event cover: upload it alongside the read
      // so the organizer does not have to pick the same file twice.
      const coverUpload = file.type.startsWith("image/") ? uploadCover(file) : Promise.resolve(null);
      const res = await fetch("/api/ai/extract-event", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const coverUrl = await coverUpload;
      if (coverUrl && !form.getValues("imageUrl")) {
        form.setValue("imageUrl", coverUrl, { shouldDirty: true, shouldValidate: true });
      }
      const json: ExtractResponse = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Could not read that file");

      const d = json.details || {};
      let count = 0;

      // Branding from the flyer: who presents it and its signature colour.
      // Only fills what the organizer has not already set.
      const branding = ((form.getValues() as any).branding || {}) as Record<string, any>;
      const accent = file.type.startsWith("image/") && !branding.accentHex ? await flyerAccent(file) : null;
      const brandPatch: Record<string, any> = {};
      if (d.organizerName && !branding.displayName) brandPatch.displayName = d.organizerName;
      if (accent) brandPatch.accentHex = accent;
      if (Object.keys(brandPatch).length > 0) {
        form.setValue("branding" as any, { ...branding, ...brandPatch } as any, { shouldDirty: true });
        count++;
      }

      if (d.title) { form.setValue("title", d.title, { shouldValidate: true }); count++; }
      if (d.description) { form.setValue("description", d.description, { shouldValidate: true }); count++; }
      if (d.location) { form.setValue("location", d.location, { shouldValidate: true }); count++; }
      if (d.date) {
        const parsed = new Date(d.date + (d.time ? "T" + d.time : "T18:00:00"));
        if (!isNaN(parsed.getTime())) { form.setValue("date", parsed, { shouldValidate: true }); count++; }
      }
      if (Array.isArray(d.tiers) && d.tiers.length > 0) {
        // The form's ticket-type editor holds tiers in local state; the same
        // fields the organizer would fill by hand, just pre-filled.
        const event: any = form.getValues();
        const setTypes = (form as any)._ticketTypesSetter as ((t: any[]) => void) | undefined;
        if (setTypes) {
          setTypes(d.tiers.map((t) => ({
            name: t.name || "General Admission",
            price: nairaToKobo(Number(t.price) || 0),
            capacity: 100, // a sellable starting point; the organizer adjusts it

            sold: 0,
          })));
          count++;
        }
      }

      setFilledCount(count);
      setState("done");
      setMessage(
        d.notes
          ? d.notes
          : count > 0
            ? "Fields filled below. Read them back before you publish."
            : "Nothing usable found in that file. Fill the form manually.",
      );
    } catch (e: any) {
      setState("error");
      setMessage(e.message || "Extraction failed. Fill the form manually.");
    }
  }

  const working = state === "working";

  return (
    <div className="rounded-2xl ring-1 ring-gold/25 bg-gold/[0.05] p-1.5">
      <div className="rounded-[calc(1rem-0.375rem)] bg-surface/80 p-5">
        <div className="flex items-start gap-4">
          <span className="w-10 h-10 rounded-full bg-gold/10 ring-1 ring-gold/30 flex items-center justify-center shrink-0">
            {working ? (
              <Loader2 className="w-5 h-5 text-gold animate-spin" aria-hidden="true" />
            ) : state === "done" ? (
              <Check className="w-5 h-5 text-gold" aria-hidden="true" />
            ) : state === "error" ? (
              <AlertTriangle className="w-5 h-5 text-gold" aria-hidden="true" />
            ) : (
              <FileUp className="w-5 h-5 text-gold" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold text-ink">
              Already have a flyer?
            </p>
            <p className="mt-1 text-xs text-muted-ink leading-relaxed">
              Drop it here and the details fill themselves in. You review
              everything before anything is saved.
            </p>
          </div>
          {state === "done" && (
            <button
              type="button"
              onClick={() => { setState("idle"); setMessage(""); }}
              className="text-xs text-muted-ink hover:text-gold transition-colors shrink-0 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Again
            </button>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a flyer or document to extract event details"
          onClick={() => !working && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !working) inputRef.current?.click(); }}
          className={
            "mt-4 rounded-xl border border-dashed transition-colors cursor-pointer text-center py-6 px-4 " +
            (working
              ? "border-gold/40 bg-gold/[0.06]"
              : "border-hairline hover:border-gold/50 hover:bg-gold/[0.04]")
          }
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          {working ? (
            <p className="text-sm text-gold font-medium">{message}</p>
          ) : (
            <>
              <p className="text-sm text-ink font-medium">
                {state === "done" ? "Extracted from " + fileName : "Flyer image, PDF, or text document"}
              </p>
              <p className="text-xs text-muted-ink mt-1">
                {state === "done"
                  ? filledCount + " field groups filled below"
                  : "Up to 15MB. PNG, JPG, PDF, or plain text."}
              </p>
            </>
          )}
        </div>

        {state === "error" && (
          <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
