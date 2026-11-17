import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Placement = "home_spotlight" | "explore_feed" | "events_sidebar";
interface SponsorSpot {
  id: string;
  title: string;
  sponsorName: string;
  tagline: string;
  badgeText: string;
  imageUrl: string;
  targetUrl: string;
  placement: Placement;
  active: boolean;
  clicks: number;
  impressions: number;
  createdAt: string;
}

const PLACEMENT_LABEL: Record<Placement, string> = {
  home_spotlight: "Homepage",
  explore_feed: "Explore",
  events_sidebar: "Events sidebar",
};
const KEY = ["/api/sponsors"];
const EMPTY = { sponsorName: "", title: "", tagline: "", badgeText: "Featured partner", targetUrl: "", imageUrl: "", placement: "home_spotlight" as Placement };

const n = (x: number) => x.toLocaleString("en-NG");
const rate = (s: SponsorSpot) => (s.impressions ? ((s.clicks / s.impressions) * 100).toFixed(1) + "%" : "–");
const since = (d: string) => new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

/**
 * Paid sponsor spots on the homepage and Explore. Each placement shows its
 * newest live spot. Views and clicks are counted by the site, so the report a
 * sponsor gets is the same number we see.
 */
export function AdminSponsorSpotsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: spots = [], isLoading } = useQuery<SponsorSpot[]>({ queryKey: KEY });
  const [draft, setDraft] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const fail = (title: string) => (e: any) => toast({ title, description: e?.message?.replace(/^\d+:\s*/, "") || "Try again in a moment.", variant: "destructive" });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sponsors", { ...draft, active: true }),
    onSuccess: () => { setDraft(EMPTY); refresh(); toast({ title: "Sponsor spot is live" }); },
    onError: fail("That spot didn't save"),
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SponsorSpot> }) => apiRequest("PATCH", `/api/sponsors/${id}`, patch),
    onSuccess: refresh,
    onError: fail("That change didn't save"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sponsors/${id}`),
    onSuccess: () => { setConfirmId(null); refresh(); },
    onError: fail("That spot wasn't removed"),
  });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ title: "Choose an image file (PNG, JPG or WEBP)", variant: "destructive" });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/portfolio", { method: "POST", credentials: "include", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.message || "The image didn't upload.");
      setDraft((d) => ({ ...d, imageUrl: data.url }));
    } catch (e: any) {
      fail("The image didn't upload")(e);
    } finally {
      setUploading(false);
    }
  };

  const copyReport = async (s: SponsorSpot) => {
    const text = `${s.sponsorName} on Black Heritage (${PLACEMENT_LABEL[s.placement]}), since ${since(s.createdAt)}: ${n(s.impressions)} views, ${n(s.clicks)} clicks (${rate(s)} click rate).`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Report copied", description: text });
    } catch {
      toast({ title: "Copy this report", description: text });
    }
  };

  const linkOk = /^(https:\/\/|\/)/.test(draft.targetUrl.trim());
  const canCreate = draft.sponsorName.trim() && draft.title.trim() && draft.tagline.trim() && draft.imageUrl && linkOk && !create.isPending;
  const live = spots.filter((s) => s.active).length;
  const field = "h-11 bg-background border-hairline text-ink";

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-hairline bg-surface p-4 sm:p-6">
        <h2 className="font-display text-lg sm:text-xl font-bold text-ink">Sponsor spots · {live} live</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-ink">
          Paid placements on the homepage and Explore. Each page shows its newest live spot. Views and clicks are counted from the moment a spot goes live; copy the report and send it to the sponsor.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink">Sponsor name</Label>
            <Input value={draft.sponsorName} maxLength={60} placeholder="e.g. Zenith Bank" onChange={(e) => setDraft({ ...draft, sponsorName: e.target.value })} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink">Headline</Label>
            <Input value={draft.title} maxLength={80} placeholder="e.g. Open a student account in 5 minutes" onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={field} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-ink">One line about it</Label>
            <Input value={draft.tagline} maxLength={180} placeholder="e.g. Free transfers for the first 3 months. Proud partner of the NANS National Talent Hunt." onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-ink">Link (https://… or a page on our site, like /e/your-event)</Label>
            <Input value={draft.targetUrl} placeholder="https://" onChange={(e) => setDraft({ ...draft, targetUrl: e.target.value })} className={field} />
            {draft.targetUrl && !linkOk && <p className="text-xs text-gold">Start the link with https:// or /</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-ink">Where it shows</Label>
              <select value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value as Placement })} className="h-11 w-full rounded-md border border-hairline bg-background px-2 text-sm text-ink">
                <option value="home_spotlight">Homepage</option>
                <option value="explore_feed">Explore</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-ink">Badge</Label>
              <Input value={draft.badgeText} maxLength={30} onChange={(e) => setDraft({ ...draft, badgeText: e.target.value })} className={field} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="press h-11 border-hairline text-ink">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {draft.imageUrl ? "Change image" : "Add image (16:9 works best)"}
          </Button>
          {draft.imageUrl && <img src={draft.imageUrl} alt="" className="h-11 w-20 rounded border border-hairline object-cover" />}
          <Button type="button" onClick={() => create.mutate()} disabled={!canCreate} className="press ml-auto h-11 bg-primary text-primary-foreground hover:bg-gold-soft">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Put it live
          </Button>
        </div>
      </section>

      <section className="rounded-md border border-hairline bg-surface">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-ink">Loading sponsor spots…</p>
        ) : spots.length === 0 ? (
          <p className="p-6 text-sm text-muted-ink">No sponsor spots yet. When a brand pays for homepage or Explore placement, add it above and it goes live straight away.</p>
        ) : (
          <ul>
            {spots.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-b border-hairline p-4 last:border-0 sm:p-5">
                <img src={s.imageUrl} alt="" className="h-12 w-20 shrink-0 rounded border border-hairline object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{s.sponsorName} · {s.title}</p>
                  <p className="text-xs text-muted-ink">
                    {PLACEMENT_LABEL[s.placement]} · since {since(s.createdAt)} · {n(s.impressions)} views · {n(s.clicks)} clicks · {rate(s)}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-ink">
                  <Switch checked={s.active} onCheckedChange={(v) => update.mutate({ id: s.id, patch: { active: v } })} aria-label={s.active ? "Pause this spot" : "Put this spot live"} />
                  {s.active ? "Live" : "Paused"}
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={() => copyReport(s)} className="text-ink">
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Report
                </Button>
                {confirmId === s.id ? (
                  <Button type="button" variant="destructive" size="sm" onClick={() => remove.mutate(s.id)} disabled={remove.isPending}>
                    Remove for good
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove this spot" onClick={() => setConfirmId(s.id)} className="text-muted-ink hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
