import { Check } from "lucide-react";
import { themePresets, type ThemePreset } from "@shared/themes";

export interface PickerBranding {
  displayName?: string;
  logoUrl?: string;
  accentHex?: string;
}

interface ThemePresetCardProps {
  preset: ThemePreset;
  selected: boolean;
  branding: PickerBranding;
  onSelect: () => void;
}

/**
 * One theme choice, rendered as a miniature of the organizer's actual event
 * page: their logo, their name, their accent inside the preset's palette.
 * Double-bezel shell (hairline ring + padded core) so the card reads as a
 * physical preview, not a flat swatch.
 */
export function ThemePresetCard({ preset, selected, branding, onSelect }: ThemePresetCardProps) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentHex || "")
    ? (branding.accentHex as string)
    : (preset.vars["--color-gold"] as string);
  const title = branding.displayName?.trim() || preset.name;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative rounded-2xl p-1.5 text-left ring-1 transition-all duration-200 press ${
        selected ? "ring-2 ring-primary" : "ring-white/10 hover:ring-white/25"
      }`}
    >
      {/* Double bezel: shell + concentric inner core */}
      <div
        className="rounded-[calc(1rem-0.125rem)] overflow-hidden border border-white/5"
        style={{ background: preset.vars.background, color: preset.vars.color }}
      >
        {/* Mini branded header: what their page's capsule will show */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b"
          style={{ borderColor: preset.vars["--color-hairline"] }}
        >
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt=""
              className="h-6 w-6 rounded-md object-cover"
              onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.25")}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
              style={{ background: accent, color: preset.vars["--color-primary-foreground"] }}
            >
              {title.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-bold leading-tight" style={{ color: preset.vars["--color-ink"] }}>
              {title}
            </span>
            <span className="block text-[5.5px] font-bold uppercase tracking-[0.18em]" style={{ color: preset.vars["--color-muted-ink"] }}>
              on BlackHeritage
            </span>
          </span>
          {selected && (
            <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: accent }}>
              <Check className="h-3 w-3" style={{ color: preset.vars["--color-primary-foreground"] }} strokeWidth={2.5} />
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="font-display text-lg font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {preset.name}
          </div>
          <div className="mt-1 text-[11px] leading-snug" style={{ color: preset.vars["--color-muted-ink"] }}>
            {preset.tagline}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full px-3 text-[10px] font-semibold" style={{ background: accent, color: preset.vars["--color-primary-foreground"] }}>
              Get Tickets
            </span>
            <div className="ml-auto flex gap-1.5">
              {["--color-background", "--color-surface-2", "--color-gold", "--color-ink"].map((k) => (
                <span
                  key={k}
                  className="h-4 w-4 rounded-full"
                  style={{ background: preset.vars[k], outline: "1px solid " + preset.vars["--color-hairline"], outlineOffset: "1px" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function themePresetList(): ThemePreset[] {
  return Object.values(themePresets);
}
