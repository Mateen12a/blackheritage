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

/**
 * The vendor's profile-link studio: their share address, theme, logo, and
 * accent, edited in one place with a live preview. Same infrastructure
 * organizers get for booking links, pointed at the vendor profile.
 */
export function VendorLinkPanel({ vendor }: { vendor: any }) {
  const vendorId = String(vendor.id);
  const { toast } = useToast();

  const [slug, setSlug] = useState<string>((vendor as any).slug || "");
  const [slugDirty, setSlugDirty] = useState(false);
  const [theme, setTheme] = useState<string | null>((vendor as any).theme || null);
  const [branding, setBranding] = useState<PickerBranding>((vendor as any).branding || {});
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const s = slug || slugify(vendor.businessName || "vendor");
    return `${location.origin}/v/${s}`;
  }, [slug, vendor.businessName]);

  const saveSlug = useMutation({
    mutationFn: async (next: string) => {
      const res = await fetch(`/api/vendors/${vendorId}/link`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${vendorId}`] });
      toast({ title: "Link saved", description: "The old link redirects to the new one automatically." });
    },
    onError: (e: Error) => toast({ title: "Could not save link", description: e.message, variant: "destructive" }),
  });

  const saveLook = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vendors/${vendorId}/look`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          branding: {
            displayName: branding.displayName || "",
            logoUrl: branding.logoUrl || "",
            accentHex: branding.accentHex || "",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Could not save the look");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${vendorId}`] });
      toast({ title: "Look saved", description: "Your public profile updates right away." });
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
  const previewName = branding.displayName?.trim() || vendor.businessName;

  return (
    <div className="space-y-6">
      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink">Profile link</CardTitle>
          <CardDescription>
            The address clients open to see your work and book you. One link for Instagram, WhatsApp status, and flyers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SlugField
            prefix="/v/"
            value={slug}
            placeholder={slugify(vendor.businessName || "your-business")}
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
                Open profile
              </Button>
            </a>
            <span className="text-xs text-muted-ink truncate max-w-full sm:max-w-[280px]">{shareUrl}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Changed your link? Every old link still works. They redirect to the new address.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-surface border-hairline">
        <CardHeader>
          <CardTitle className="text-ink">Profile look</CardTitle>
          <CardDescription>
            Pick a theme, then make it yours with a logo and accent color. The preview shows your actual profile.
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

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase font-bold">Preview</Label>
            <PreviewFrame vars={previewVars} logoUrl={branding.logoUrl} name={previewName}>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: previewAccent }}>
                {vendor.category}
              </div>
              <div className="mt-1 font-display text-xl font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                {vendor.businessName}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold"
                  style={{ background: previewAccent, color: previewVars["--color-primary-foreground"] }}
                >
                  Book Now
                </span>
                <span className="text-[11px]" style={{ color: previewVars["--color-muted-ink"] }}>
                  {vendor.city || vendor.serviceArea || "Lagos"}
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
