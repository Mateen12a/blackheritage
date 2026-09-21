import { Vendor } from "@shared/schema";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { FadeImg } from "@/components/motion";
import { CategoryIcon, vendorDisplayCategory } from "./vendor-categories";

interface VendorCardProps {
  vendor: Vendor;
}

/**
 * Editorial vendor card matching EventCard: portfolio photo is the hero,
 * hairline border, no lift animation, hover = photo scale + title color.
 * See DESIGN.md.
 */
export function VendorCard({ vendor }: VendorCardProps) {
  const gallery = (() => {
    try {
      const parsed = JSON.parse(vendor.gallery || "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  })();

  const cover = gallery[0] || null;
  const photoCount = gallery.length;

  return (
    <Link href={"/vendors/" + vendor.id}>
      <article className="group relative overflow-hidden rounded-md bg-surface border border-hairline hover:border-white/20 transition-colors duration-200 h-full flex flex-col cursor-pointer">
        {/* Portfolio photo is the hero */}
        <div className="relative aspect-[3/4] overflow-hidden bg-surface-2">
          {cover ? (
            <FadeImg
              src={cover}
              alt={vendor.businessName}
              data-motion="scale-on-hover"
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CategoryIcon
                category={vendor.category}
                className="w-14 h-14 text-gold/30"
              />
            </div>
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent"
          />
          <span className="absolute bottom-3 left-4 text-[11px] font-bold tracking-[0.18em] uppercase text-ink/80">
            {vendorDisplayCategory(vendor)}
          </span>
          {photoCount > 1 && (
            <span className="absolute bottom-3 right-4 text-xs font-medium text-ink/80">
              {photoCount} photos
              <span aria-hidden="true"> ›</span>
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-grow p-5">
          <h3 className="font-display text-xl font-bold leading-snug text-ink line-clamp-2 transition-colors duration-200 group-hover:text-gold">
            {vendor.businessName}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-ink">
            <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="truncate">
              {vendor.city || vendor.serviceArea || "Nigeria"}
            </span>
          </div>

          <div className="mt-auto pt-4 border-t border-hairline flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-ink line-clamp-1">{vendor.bio}</span>
            <span className="eyebrow shrink-0 transition-colors duration-200 group-hover:text-gold">
              View
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
