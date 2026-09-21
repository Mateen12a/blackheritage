import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ThemePresetCard, themePresetList, type PickerBranding } from "@/components/ThemePicker";
import { accentOverrides, getPreset } from "@shared/themes";
import { SlugField, BrandingInputs, PreviewFrame, slugify } from "@/components/LinkStudio";

interface BookingLinkPanelProps {
  event: any;
}

/**
 * The organizer's booking link studio: everything the share link carries
 * (slug, theme, logo, accent) edited in one place with a live preview.
 * Saves through the two narrow PATCH endpoints the API already owns.
 */
export function BookingLinkPanel({ event }: BookingLinkPanelProps) {
  const eventId = String(event.id);
  const { toast } = useToast();

  const [slug, setSlug] = useState<string>((event as any).slug || "");
  const [slugDirty, setSlugDirty] = useState(false);
  const [theme, setTheme] = useState<string | null>((event as any).theme || null);
  const [branding, setBranding] = useState<PickerBranding>((event as any).branding || {});
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const s = slug || slugify(event.title || "event");
    return `${location.origin}/e/${s}`;
  }, [slug, event.title]);

  const saveSlug = useMutation({
    mutationFn: async (next: string) => {
      const res = await fetch(`/api/events/${eventId}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: next || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Could not save the link");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      toast({ title: "Link saved", description: "The old link redirects to the new one automatically." });
    },
    onError: (e: Error) => toast({ title: "Could not save link", description: e.message, variant: "destructive" }),
  });

  const saveLook = useMutation({
    mutationFn: async () => {
      const results = await Promise.all([
        fetch(`/api/events/${eventId}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme }),
        }),
        fetch(`/api/events/${eventId}/branding`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: branding.displayName || "",
            logoUrl: branding.logoUrl || "",
            accentHex: branding.accentHex || "",
          }),
        }),
      ]);
      if (!results[0].ok) throw new Error("Could not save the theme");
      if (!results[1].ok) throw new Error("Could not save the branding");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      toast({ title: "Look saved", description: "Your page, ticket PDF, and emails all update." });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Copy failed", description: shareUrl, variant: "destructive" });
    }
  };

  const slugValid = slug === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const previewVars = {
    ...((getPreset(theme) || themePresetList()[0]).vars),
    ...accentOverrides(theme, branding.accentHex || null),
  };
  const previewAccent = previewVars["--color-gold"] as string;
  const previewName = branding.displayName?.trim() || event.title;

  return (
    <div className="space-y-6">
      {/* The link itself */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink">Booking link</CardTitle>
          <CardDescription>
            The address guests open to buy tickets. Share it on WhatsApp, flyers, or Instagram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SlugField
            prefix="/e/"
            value={slug}
            placeholder={slugify(event.title || "your-event")}
            valid={slugValid}
            dirty={slugDirty}
            saving={saveSlug.isPending}
            onChange={(next) => {
              setSlug(slugify(next));
              setSlugDirty(true);
            }}
            onSave={() => saveSlug.mutate(slug)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="press border-hairline text-ink" onClick={copy}>
              {copied ? <Check className="w-4 h-4 mr-2 text-gold" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={shareUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="press border-hairline text-ink">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open page
              </Button>
            </a>
            <span className="text-xs text-muted-ink truncate max-w-full sm:max-w-[280px]">{shareUrl}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Changed your link? Every old link and QR code still works. They redirect to the new address.
          </p>
        </CardContent>
      </Card>

      {/* Look: theme + branding with a live preview */}
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink">Page look</CardTitle>
          <CardDescription>
            Pick a theme, then make it yours with a logo and accent color. The preview shows your actual page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themePresetList().map((preset) => (
              <ThemePresetCard
                key={preset.key}
                preset={preset}
                selected={theme === preset.key}
                branding={branding}
                onSelect={() => setTheme(theme === preset.key ? null : preset.key)}
              />
            ))}
          </div>

          <BrandingInputs branding={branding} onChange={setBranding} />

          {/* Live preview: the top of their page, rendered with current settings */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase font-bold">Preview</Label>
            <PreviewFrame vars={previewVars} logoUrl={branding.logoUrl} name={previewName}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: previewAccent }}>
                Upcoming event
              </div>
              <div className="mt-1 font-display text-xl font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                {event.title}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold"
                  style={{ background: previewAccent, color: previewVars["--color-primary-foreground"] }}
                >
                  Get Tickets
                </span>
                <span className="text-[11px]" style={{ color: previewVars["--color-muted-ink"] }}>
                  {event.location}
                </span>
              </div>
            </PreviewFrame>
          </div>

          <Button
            className="press w-full sm:w-auto h-11 bg-primary text-primary-foreground hover:bg-gold-soft"
            onClick={() => saveLook.mutate()}
            disabled={saveLook.isPending}
          >
            {saveLook.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Save look
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
