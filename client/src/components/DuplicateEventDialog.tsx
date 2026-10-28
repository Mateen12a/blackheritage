import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { Loader2, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Repeat = "once" | "weekly" | "fortnightly" | "monthly";

const REPEATS: { value: Repeat; label: string }[] = [
  { value: "once", label: "Just once" },
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
];

// datetime-local wants "yyyy-MM-ddTHH:mm" in local time.
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/** Re-launch an event on new dates: same listing, tiers and settings, fresh sales. */
export function DuplicateEventDialog({ event, open, onClose }: { event: any; open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Default to the same weekday and time, one week after the original (or
  // after now, if the original is long past).
  const defaultStart = useMemo(() => {
    const src = event?.date ? new Date(event.date) : new Date();
    let next = addWeeks(src, 1);
    while (next.getTime() < Date.now()) next = addWeeks(next, 1);
    return next;
  }, [event?.date]);

  const [start, setStart] = useState(() => toLocalInput(defaultStart));
  const [repeat, setRepeat] = useState<Repeat>("once");
  const [count, setCount] = useState(4);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  const dates = useMemo(() => {
    const first = new Date(start);
    if (isNaN(first.getTime())) return [];
    const n = repeat === "once" ? 1 : Math.min(12, Math.max(2, count));
    return Array.from({ length: n }, (_, i) =>
      repeat === "weekly" ? addWeeks(first, i)
      : repeat === "fortnightly" ? addDays(first, i * 14)
      : repeat === "monthly" ? addMonths(first, i)
      : first,
    );
  }, [start, repeat, count]);

  const submit = async () => {
    if (dates.length === 0) return;
    setBusy(true);
    try {
      const res = await apiRequest("POST", `/api/events/${event.id}/duplicate`, {
        dates: dates.map((d) => d.toISOString()),
        publish,
      });
      const { events } = await res.json();
      await queryClient.invalidateQueries();
      onClose();
      toast({
        title: events.length === 1 ? "New date created" : `${events.length} dates created`,
        description: publish
          ? "They're live with fresh tickets. Sales from the original stay with the original."
          : "Saved as drafts with fresh tickets. Check the details, then publish.",
      });
      setLocation(events.length === 1 ? `/admin/events/${events[0].id}` : "/dashboard");
    } catch (err: any) {
      const msg = String(err?.message || "").replace(/^\d+:\s*/, "");
      let text = msg;
      try { text = JSON.parse(msg).message || msg; } catch { /* plain text */ }
      toast({ variant: "destructive", title: "Couldn't create the new dates", description: text || "Try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-surface border-hairline max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-ink">Run it again</DialogTitle>
          <DialogDescription className="text-muted-ink">
            Same flyer, tiers, venue and settings. Fresh tickets, and sales start from zero.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="dup-start" className="text-sm text-ink">
              {repeat === "once" ? "New date and time" : "First date and time"}
            </label>
            <Input
              id="dup-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-surface-2 border-hairline text-ink"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm text-ink">How often</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How often">
              {REPEATS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={repeat === r.value}
                  onClick={() => setRepeat(r.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm transition-colors",
                    repeat === r.value ? "border-gold/60 bg-gold/10 text-gold" : "border-hairline text-muted-ink hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {repeat !== "once" && (
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="dup-count" className="text-sm text-ink">Number of dates</label>
              <Input
                id="dup-count"
                type="number"
                min={2}
                max={12}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 2)}
                className="w-20 bg-surface-2 border-hairline text-ink text-center"
              />
            </div>
          )}

          {dates.length > 0 && (
            <div className="rounded-md border border-hairline bg-surface-2 px-3 py-2.5">
              <p className="text-xs text-muted-ink mb-1.5">
                {dates.length === 1 ? "Creates 1 event" : `Creates ${dates.length} events`}
              </p>
              <ul className="space-y-1 text-sm text-ink tabular-nums max-h-36 overflow-y-auto">
                {dates.map((d) => (
                  <li key={d.toISOString()}>{format(d, "EEE d MMM yyyy · h:mma")}</li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#E3B23C]"
            />
            <span className="text-sm text-ink">
              Publish straight away
              <span className="block text-xs text-muted-ink">Off saves them as drafts so you can tweak each one first.</span>
            </span>
          </label>

          <Button
            onClick={submit}
            disabled={busy || dates.length === 0}
            className="press w-full bg-primary text-primary-foreground hover:bg-gold-soft font-semibold"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                {dates.length > 1 ? `Create ${dates.length} dates` : "Create the new date"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
