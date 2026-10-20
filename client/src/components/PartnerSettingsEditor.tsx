import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { partnerTypes, type PartnerPackage, type PartnerSettings, type PartnerType } from "@shared/schema";
import { PARTNER_COPY, partnerSettingsOf } from "@/components/BusinessModal";

/**
 * Organizer controls for the public partner card: whether it shows, who it
 * invites, their own words, their own packages and prices (or "price on
 * request"), a direct WhatsApp line and a closing date. Saved in one go.
 */
export function PartnerSettingsEditor({
  event,
  saving,
  onSave,
}: {
  event: any;
  saving: boolean;
  onSave: (patch: { businessApplicationsEnabled: boolean; partnerSettings: PartnerSettings }) => void;
}) {
  const [enabled, setEnabled] = useState<boolean>(event.businessApplicationsEnabled === true);
  const [draft, setDraft] = useState<PartnerSettings>(() => partnerSettingsOf(event));

  useEffect(() => {
    setEnabled(event.businessApplicationsEnabled === true);
    setDraft(partnerSettingsOf(event));
  }, [event.id]);

  const set = (patch: Partial<PartnerSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleType = (t: PartnerType, on: boolean) =>
    set({ types: on ? Array.from(new Set([...draft.types, t])) : draft.types.filter((x) => x !== t) });
  const setPkg = (i: number, patch: Partial<PartnerPackage>) =>
    set({ packages: draft.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const addPkg = () =>
    set({ packages: [...draft.packages, { type: draft.types[0] || "vendor", name: "", priceKobo: null, details: "" }] });

  const usable = draft.packages.filter((p) => p.name.trim() && draft.types.includes(p.type));
  const canSave = !enabled || draft.types.length > 0;

  const save = () =>
    onSave({
      businessApplicationsEnabled: enabled && draft.types.length > 0,
      partnerSettings: { ...draft, packages: usable, whatsapp: draft.whatsapp.replace(/[^\d+]/g, "") },
    });

  const field = "h-11 bg-background border-hairline text-ink";

  return (
    <div className="p-4 bg-surface-2 rounded-md border border-hairline space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="partner-on" className="font-medium text-ink">Sponsors, vendors &amp; talent</Label>
          <p className="text-sm text-muted-ink mt-0.5">
            Show a card on your event page inviting the partners you want. Applications land in the Partners tab and in your email.
          </p>
        </div>
        <Switch id="partner-on" checked={enabled} onCheckedChange={setEnabled} className="shrink-0 mt-1" />
      </div>

      {enabled && (
        <>
          <div>
            <p className="text-sm font-medium text-ink">Who are you looking for?</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {partnerTypes.map((t) => (
                <label key={t} className="flex items-center gap-2.5 rounded-md border border-hairline bg-background px-3 py-2.5 cursor-pointer">
                  <Checkbox checked={draft.types.includes(t)} onCheckedChange={(v) => toggleType(t, v === true)} />
                  <span className="text-sm text-ink">{PARTNER_COPY[t].label}{t === "talent" ? "" : "s"}</span>
                </label>
              ))}
            </div>
            {draft.types.length === 0 && <p className="mt-1.5 text-xs text-gold">Pick at least one, or switch the card off.</p>}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-ink">Headline</Label>
              <Input value={draft.headline} maxLength={80} placeholder="e.g. Food vendors wanted: 5 spots" onChange={(e) => set({ headline: e.target.value })} className={field} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-ink">One line about it</Label>
              <Input value={draft.blurb} maxLength={220} placeholder="e.g. 300 guests, 6pm till dawn. Bring your own gas and table." onChange={(e) => set({ blurb: e.target.value })} className={field} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">Packages and prices</p>
                <p className="text-xs text-muted-ink">Optional. Without packages, people just tell you what they offer and you quote.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPkg} disabled={draft.types.length === 0} className="press shrink-0 border-hairline text-ink">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            <div className="mt-3 space-y-3">
              {draft.packages.map((pk, i) => {
                const onRequest = pk.priceKobo === null;
                return (
                  <div key={i} className="rounded-md border border-hairline bg-background p-3 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_auto] gap-2">
                      <select
                        value={pk.type}
                        onChange={(e) => setPkg(i, { type: e.target.value as PartnerType })}
                        className="h-11 rounded-md bg-surface-2 border border-hairline text-ink text-sm px-2"
                        aria-label="Package for"
                      >
                        {draft.types.map((t) => <option key={t} value={t}>{PARTNER_COPY[t].label}</option>)}
                      </select>
                      <Input value={pk.name} maxLength={60} placeholder="e.g. Food spot" onChange={(e) => setPkg(i, { name: e.target.value })} className={field} />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove package" onClick={() => set({ packages: draft.packages.filter((_, j) => j !== i) })} className="h-11 w-11 text-muted-ink hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2 items-center">
                      <Input
                        inputMode="numeric"
                        disabled={onRequest}
                        placeholder="Price in ₦"
                        value={onRequest ? "" : pk.priceKobo ? String(Math.round(pk.priceKobo / 100)) : ""}
                        onChange={(e) => setPkg(i, { priceKobo: Math.max(0, parseInt(e.target.value, 10) || 0) * 100 })}
                        className={field}
                      />
                      <label className="flex items-center gap-2 text-sm text-muted-ink cursor-pointer">
                        <Checkbox checked={onRequest} onCheckedChange={(v) => setPkg(i, { priceKobo: v === true ? null : 0 })} />
                        Price on request
                      </label>
                    </div>
                    <Input value={pk.details} maxLength={160} placeholder="What's included, e.g. 3x3m space, 2 passes" onChange={(e) => setPkg(i, { details: e.target.value })} className={field} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-ink">WhatsApp for enquiries (optional)</Label>
              <Input inputMode="tel" value={draft.whatsapp} placeholder="0803 123 4567" onChange={(e) => set({ whatsapp: e.target.value })} className={field} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-ink">Applications close (optional)</Label>
              <Input type="date" value={draft.closesAt ? String(draft.closesAt).slice(0, 10) : ""} onChange={(e) => set({ closesAt: e.target.value ? new Date(e.target.value + "T23:59:00").toISOString() : null })} className={field} />
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving || !canSave} className="press bg-primary text-primary-foreground hover:bg-gold-soft h-10">
          {saving ? "Saving…" : "Save partner settings"}
        </Button>
      </div>
    </div>
  );
}
