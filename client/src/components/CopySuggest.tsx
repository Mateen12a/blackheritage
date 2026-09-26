import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Copy suggestion control. Asks the server for plain-text variants built from
 * the event's own facts, shows them as pickable options, and writes the
 * chosen one into the field. The organizer can edit before or after applying;
 * nothing saves on its own.
 *
 * The options panel is fixed-position and clamped to the viewport, so it
 * behaves on a phone: it never hangs off the right edge and never pushes the
 * form around. It tracks the trigger button across scrolls while open.
 */

interface CopySuggestProps {
  kind: "description" | "announcement" | "bio";
  facts: Record<string, unknown>;
  onApply: (text: string) => void;
  /** Button label, e.g. "Draft it for me". */
  label: string;
  className?: string;
}

export function CopySuggest({ kind, facts, onApply, label, className }: CopySuggestProps) {
  const [state, setState] = useState<"idle" | "working" | "pick" | "error">("idle");
  const [variants, setVariants] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const placePanel = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const margin = 12;
    // Wide screens: a card anchored under the button. Narrow screens: the
    // panel spans the viewport so long option text stays readable.
    const width = Math.min(400, vw - margin * 2);
    const left = Math.max(margin, Math.min(r.left, vw - width - margin));
    const top = r.bottom + 8;
    setPanel({ top, left, width });
  }, []);

  // Keep the open panel glued to the button while the page scrolls or the
  // window changes size.
  useEffect(() => {
    if (state !== "pick" && state !== "error") return;
    const onMove = () => placePanel();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [state, placePanel]);

  // Close on Escape like any other popover.
  useEffect(() => {
    if (state !== "pick") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVariants([]);
        setState("idle");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  async function fetchVariants() {
    setState("working");
    setError("");
    placePanel();
    try {
      const res = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kind, facts }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Could not get suggestions right now.");
      const list: string[] = Array.isArray(j.variants) ? j.variants : [];
      if (list.length === 0) throw new Error("The writing helper came back empty. Try again in a moment.");
      setVariants(list);
      setState("pick");
      // Re-measure after the state settles so the panel sits under the button.
      requestAnimationFrame(placePanel);
    } catch (e: any) {
      setError(e.message || "Could not get suggestions right now. Try again in a moment.");
      setState("error");
    }
  }

  function apply(text: string) {
    onApply(text);
    setState("idle");
    setVariants([]);
  }

  function toggle() {
    if (state === "pick" || state === "error") {
      setVariants([]);
      setError("");
      setState("idle");
      return;
    }
    placePanel();
    if (state === "idle") fetchVariants();
  }

  return (
    <div className={cn(className)}>
      <Button
        ref={btnRef}
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={state === "pick"}
        disabled={state === "working"}
        onClick={toggle}
        className="h-8 shrink-0 border-hairline text-xs text-muted-ink hover:text-gold hover:border-gold/40 press"
      >
        {state === "working" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
        ) : (
          <PenLine className="w-3.5 h-3.5 mr-1.5 text-gold" />
        )}
        {state === "working" ? "Writing..." : state === "pick" ? "Hide options" : label}
      </Button>

      {state === "pick" && panel && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label="Suggested copy options"
          style={{ position: "fixed", top: panel.top, left: panel.left, width: panel.width }}
          className="z-50 max-h-[min(55vh,420px)] overflow-y-auto rounded-md border border-hairline bg-surface shadow-xl p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between px-1 pb-1 sticky -top-2 -mt-2 pt-2 bg-surface rounded-t-md">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-ink">
              Pick one, then edit
            </span>
            <button
              type="button"
              aria-label="Close suggestions"
              onClick={() => { setVariants([]); setState("idle"); }}
              className="text-muted-ink hover:text-ink"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => apply(v)}
              className="w-full text-left text-xs text-ink leading-relaxed rounded border border-hairline bg-surface-2/60 hover:border-gold/50 hover:bg-surface-2 px-3 py-2.5 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {state === "error" && panel && (
        <div
          role="alert"
          style={{ position: "fixed", top: panel.top, left: panel.left, width: panel.width }}
          className="z-50 rounded-md border border-hairline bg-surface shadow-xl p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-red-400">{error}</p>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => { setError(""); setState("idle"); }}
              className="text-muted-ink hover:text-ink shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
