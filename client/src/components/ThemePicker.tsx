import { Check } from "lucide-react";
import { templatePresets, type TemplatePreset } from "@shared/themes";

export interface PickerBranding {
  displayName?: string;
  logoUrl?: string;
  accentHex?: string;
}

interface TemplateCardProps {
  preset: TemplatePreset;
  selected: boolean;
  branding: PickerBranding;
  onSelect: () => void;
}

/**
 * One template choice, rendered as a miniature of the organizer's actual
 * event page. The card's body is a wireframe of that template's real
 * structure: poster (hero then story), billboard (full-bleed art with the
 * ticket docked on it), editorial (story first, framed art mid-page), so
 * the organizer is choosing a layout and a motion, not a color chip.
 * Their logo, name, and accent are shown inside the wireframe.
 */
export function ThemePresetCard({ preset, selected, branding, onSelect }: TemplateCardProps) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding.accentHex || "")
    ? (branding.accentHex as string)
    : (preset.vars["--color-gold"] as string);
  const title = branding.displayName?.trim() || preset.name;
  const hairline = preset.vars["--color-hairline"] as string;
  const surface2 = preset.vars["--color-surface-2"] as string;
  const ink = preset.vars["--color-ink"] as string;
  const muted = preset.vars["--color-muted-ink"] as string;

  const wireframe = () => {
    switch (preset.layout) {
      case "billboard":
        return (
          <div className="p-3">
            {/* Full-bleed art with the ticket card docked bottom-right */}
            <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: hairline, height: 92 }}>
              <div className="absolute inset-0" style={{ background: surface2 }} />
              <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold" style={{ color: ink, opacity: 0.5 }}>
                Art
              </div>
              <div className="absolute bottom-2 right-2 rounded-md px-2.5 py-1.5 text-[8px] font-bold shadow" style={{ background: accent, color: preset.vars["--color-primary-foreground"] as string }}>
                Tickets
              </div>
            </div>
            <div className="mt-2 h-1.5 w-2/3 rounded-full" style={{ background: hairline }} />
          </div>
        );
      case "editorial":
        return (
          <div className="p-3 space-y-2">
            {/* Story first, framed art mid-page */}
            <div className="h-1.5 w-1/3 rounded-full" style={{ background: accent }} />
            <div className="h-2 w-3/4 rounded-full" style={{ background: ink, opacity: 0.85 }} />
            <div className="h-1.5 w-1/2 rounded-full" style={{ background: hairline }} />
            <div className="rounded-lg border flex items-center justify-center font-display text-sm font-bold" style={{ borderColor: hairline, background: surface2, height: 56, color: ink, opacity: 0.5 }}>
              Framed art
            </div>
          </div>
        );
      case "poster":
      default:
        return (
          <div className="p-3">
            {/* Hero art on top, editorial column under it */}
            <div className="rounded-lg flex items-center justify-center font-display text-sm font-bold" style={{ background: surface2, height: 52, color: ink, opacity: 0.5 }}>
              Flyer
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 w-1/4 rounded-full" style={{ background: accent }} />
              <div className="h-2 w-2/3 rounded-full" style={{ background: ink, opacity: 0.85 }} />
              <div className="h-1.5 w-1/2 rounded-full" style={{ background: hairline }} />
            </div>
          </div>
        );
    }
  };

  const motionLabel = preset.motion === "rise" ? "Rise in" : preset.motion === "bloom" ? "Bloom in" : "Slide in";

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
          style={{ borderColor: hairline }}
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
            <span className="block truncate text-[11px] font-bold leading-tight" style={{ color: ink }}>
              {title}
            </span>
            <span className="block text-[5.5px] font-bold uppercase tracking-[0.18em]" style={{ color: muted }}>
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
          <div className="mt-1 text-[11px] leading-snug" style={{ color: muted }}>
            {preset.tagline}
          </div>
          {/* The wireframe: this template's actual page structure */}
          <div className="mt-3 rounded-xl border" style={{ borderColor: hairline }}>
            {wireframe()}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-flex h-6 items-center rounded-full px-3 text-[10px] font-semibold" style={{ background: accent, color: preset.vars["--color-primary-foreground"] }}>
              {motionLabel}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-right" style={{ color: muted }}>
              {preset.layout} layout
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function themePresetList(): TemplatePreset[] {
  return Object.values(templatePresets);
}
