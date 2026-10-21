import { Building2, Store, Mic2 } from "lucide-react";
import type { Event, PartnerSettings, PartnerType } from "@shared/schema";

// Shared by the event page card and the application modal. Lives apart from
// the modal so the event page can render its card without downloading it.
export const PARTNER_COPY: Record<PartnerType, { label: string; hint: string; icon: typeof Store; nameLabel: string; namePlaceholder: string; aboutLabel: string }> = {
  sponsor: { label: "Sponsor", hint: "Put your brand in front of the crowd", icon: Building2, nameLabel: "Brand or business name", namePlaceholder: "e.g. Zenith Bank", aboutLabel: "What would you like to promote?" },
  vendor: { label: "Vendor", hint: "Sell food, drinks or products at the event", icon: Store, nameLabel: "Business name", namePlaceholder: "e.g. Kola's Kitchen", aboutLabel: "What do you sell?" },
  talent: { label: "Talent", hint: "DJ, MC, host, performer or crew", icon: Mic2, nameLabel: "Stage or business name", namePlaceholder: "e.g. DJ Zoro", aboutLabel: "What do you do? Add a link to your work" },
};

export function partnerSettingsOf(event: Event): PartnerSettings {
  const raw: any = (event as any).partnerSettings || {};
  return {
    types: Array.isArray(raw.types) ? raw.types : [],
    headline: raw.headline || "",
    blurb: raw.blurb || "",
    packages: Array.isArray(raw.packages) ? raw.packages : [],
    whatsapp: raw.whatsapp || "",
    closesAt: raw.closesAt || null,
  };
}
