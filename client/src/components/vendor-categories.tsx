import {
  Disc3,
  Mic,
  UtensilsCrossed,
  Flower2,
  Camera,
  Music,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { vendorCategories } from "@shared/schema";

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const icons: Record<string, LucideIcon> = {
    DJ: Disc3,
    MC: Mic,
    Caterer: UtensilsCrossed,
    Decorator: Flower2,
    Photographer: Camera,
    "Live Band": Music,
    Other: Sparkles,
  };
  const Icon = icons[category] || Sparkles;
  return <Icon className={className} />;
}

export function categoryLabel(category: string): string {
  return vendorCategories.includes(category as any) ? category : "Other";
}
