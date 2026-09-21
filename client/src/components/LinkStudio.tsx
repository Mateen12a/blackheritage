import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PickerBranding } from "@/components/ThemePicker";

/**
 * Shared pieces of the two link studios (events and vendor profiles).
 * Each piece owns its rendering; the panels own state and saving.
 */

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** The /prefix/slug input with its save button and validation note. */
export function SlugField({
  prefix,
  value,
  placeholder,
  valid,
  dirty,
  saving,
  onChange,
  onSave,
}: {
  prefix: string;
  value: string;
  placeholder: string;
  valid: boolean;
  dirty: boolean;
  saving: boolean;
  onChange: (next: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center h-11 rounded-lg border border-hairline bg-surface-2 overflow-hidden">
            <span className="px-3 text-sm text-muted-ink shrink-0 select-none" aria-hidden="true">
              {prefix}
            </span>
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              aria-label="Profile link slug"
              className="h-11 border-0 bg-transparent focus-visible:ring-0 font-mono text-sm rounded-none"
              maxLength={60}
            />
          </div>
        </div>
        {dirty && (
          <Button
            className="press h-11 bg-primary text-primary-foreground hover:bg-gold-soft"
            onClick={onSave}
            disabled={saving || !valid}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Save link
          </Button>
        )}
      </div>
      {!valid && (
        <p className="text-xs text-red-400">Lowercase letters, numbers, and dashes only.</p>
      )}
    </div>
  );
}

/** Display name, accent color, and logo inputs. Controlled by the panel. */
export function BrandingInputs({
  branding,
  onChange,
}: {
  branding: PickerBranding;
  onChange: (next: PickerBranding) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-bold">Display name</Label>
          <Input
            value={branding.displayName || ""}
            onChange={(e) => onChange({ ...branding, displayName: e.target.value })}
            className="h-11 bg-white/5 border-white/10 text-ink rounded-xl focus:border-primary"
            placeholder="e.g. Tunde Live Concepts"
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-bold">Accent color</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(branding.accentHex || "") ? branding.accentHex : "#E3B23C"}
              onChange={(e) => onChange({ ...branding, accentHex: e.target.value.toUpperCase() })}
              aria-label="Pick accent color"
              className="h-11 w-14 rounded-lg bg-transparent border border-white/10 cursor-pointer p-1"
            />
            <Input
              value={branding.accentHex || ""}
              onChange={(e) => onChange({ ...branding, accentHex: e.target.value.toUpperCase().replace(/[^#0-9a-fA-F]/g, "").slice(0, 7) })}
              className="h-11 bg-white/5 border-white/10 text-ink rounded-xl focus:border-primary font-mono"
              placeholder="#E3B23C"
              maxLength={7}
            />
          </div>
          {branding.accentHex && !/^#[0-9a-fA-F]{6}$/.test(branding.accentHex) && (
            <p className="text-xs text-red-400">Use a 6-digit hex color, like #E3B23C.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase font-bold">Logo URL (optional)</Label>
        <Input
          value={branding.logoUrl || ""}
          onChange={(e) => onChange({ ...branding, logoUrl: e.target.value })}
          className="h-11 bg-white/5 border-white/10 text-ink rounded-xl focus:border-primary"
          placeholder="https://... your logo image"
        />
        {branding.logoUrl && (
          <button
            type="button"
            onClick={() => onChange({ ...branding, logoUrl: "" })}
            className="press text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Remove logo
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The double-bezel preview chrome: outer shell, inner screen carrying the
 * theme palette, and a header row with the brand. `children` is the page
 * body, different per studio.
 */
export function PreviewFrame({
  vars,
  logoUrl,
  name,
  children,
}: {
  vars: Record<string, string>;
  logoUrl?: string;
  name: string;
  children: React.ReactNode;
}) {
  const accent = vars["--color-gold"] as string;
  return (
    <div className="rounded-2xl p-1.5 ring-1 ring-white/10 bg-white/[0.03]">
      <div
        className="rounded-[calc(1rem-0.125rem)] overflow-hidden border border-white/5"
        style={{ background: vars["--color-background"], color: vars["--color-ink"] }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b"
          style={{ borderColor: vars["--color-hairline"] }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-7 w-7 rounded-md object-cover"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.25")}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold"
              style={{ background: accent, color: vars["--color-primary-foreground"] }}
            >
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold leading-tight">{name}</span>
            <span className="block text-[6px] font-bold uppercase tracking-[0.18em]" style={{ color: vars["--color-muted-ink"] }}>
              on BlackHeritage
            </span>
          </span>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
