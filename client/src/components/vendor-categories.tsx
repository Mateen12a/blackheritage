import {
  Disc3,
  Mic,
  UtensilsCrossed,
  Flower2,
  Camera,
  Music,
  Shapes,
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
    Other: Shapes,
  };
  const Icon = icons[category] || Shapes;
  return <Icon className={className} />;
}

export function categoryLabel(category: string): string {
  return vendorCategories.includes(category as any) ? category : "Other";
}

/**
 * Public-facing label: the vendor's own description when they picked "Other"
 * and filled one in, otherwise the category name.
 */
export function vendorDisplayCategory(vendor: { category: string; categoryLabel?: string | null }): string {
  if (vendor.category === "Other" && vendor.categoryLabel?.trim()) {
    return vendor.categoryLabel.trim();
  }
  return categoryLabel(vendor.category);
}
