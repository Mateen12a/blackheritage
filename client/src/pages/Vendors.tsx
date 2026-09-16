import type { ReactNode } from "react";
import { VendorCard } from "@/components/VendorCard";
import { CategoryIcon } from "@/components/vendor-categories";
import { useVendors } from "@/hooks/use-vendors";
import { Reveal } from "@/components/motion";
import { vendorCategories } from "@shared/schema";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export default function Vendors() {
  const { data: vendors, isLoading } = useVendors();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const filteredVendors = vendors?.filter((vendor) => {
    const matchesCategory = !category || vendor.category === category;
    const term = search.toLowerCase();
    const matchesSearch =
      vendor.businessName.toLowerCase().includes(term) ||
      vendor.bio.toLowerCase().includes(term) ||
      (vendor.city || "").toLowerCase().includes(term) ||
      (vendor.serviceArea || "").toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pt-16 pb-24">
        {/* Editorial header — same grammar as Events */}
        <Reveal className="max-w-3xl mb-12">
          <p className="eyebrow">Lagos &amp; beyond</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink tracking-tight">
            Vendor Directory
          </h1>
          <div className="mt-5 h-0.5 w-16 bg-gold" aria-hidden="true" />
          <p className="mt-5 text-lg text-muted-ink max-w-xl leading-relaxed">
            {vendors?.length ?? 0}
            {vendors?.length === 1 ? " vendor" : " vendors"} across Lagos: DJs,
            MCs, caterers, decorators, photographers, and live bands. Browse
            portfolios, then message them straight on WhatsApp.
          </p>
        </Reveal>

        {/* Quiet search well */}
        <div className="max-w-2xl mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-ink w-5 h-5 pointer-events-none" />
            <Input
              placeholder="Try “DJ”, “caterer”, or “Lekki”..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search vendors"
              className="w-full h-14 pl-12 bg-surface-2 border border-hairline rounded-md text-ink text-base placeholder:text-muted-ink focus-visible:border-gold focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Category filters — quiet pills, gold only when active */}
        <div
          className="flex flex-wrap gap-2 mb-12 max-w-3xl"
          role="group"
          aria-label="Filter vendors by category"
        >
          <CategoryFilter
            label="All"
            active={category === null}
            onClick={() => setCategory(null)}
          />
          {vendorCategories.map((cat) => (
            <CategoryFilter
              key={cat}
              label={cat}
              icon={<CategoryIcon category={cat} className="w-3.5 h-3.5" />}
              active={category === cat}
              onClick={() => setCategory(category === cat ? null : cat)}
            />
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
            <p className="eyebrow">Loading vendors</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors?.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        )}

        {!isLoading && filteredVendors?.length === 0 && (
          <div className="text-center py-16 border border-hairline rounded-md bg-surface">
            <h2 className="font-display text-xl font-bold text-ink mb-2">
              Nothing matches that yet
            </h2>
            <p className="text-muted-ink mb-6">
              Try “DJ” or “caterer”, or clear the filters to see the full
              directory.
            </p>
            <Link href="/vendor-signup">
              <span className="text-gold underline-offset-4 hover:underline cursor-pointer">
                Are you a DJ or vendor? List your business, it's free →
              </span>
            </Link>
          </div>
        )}

        {/* Vendor CTA — flat panel, hairline, single gold button */}
        <Reveal className="mt-24">
          <section className="border border-hairline rounded-md bg-surface p-10 md:p-14 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ink">
              Your work deserves a front page
            </h2>
            <p className="mt-4 text-muted-ink max-w-xl mx-auto leading-relaxed">
              A standing profile with your portfolio, service area, and a
              direct WhatsApp line. Free to list. When Lagos plans a party,
              this is where they'll find you.
            </p>
            <Link href="/vendor-signup">
              <span className="press mt-8 inline-flex items-center justify-center h-12 px-8 rounded-md bg-primary text-primary-foreground font-medium hover:bg-gold-soft transition-colors cursor-pointer">
                List Your Business: It's Free
              </span>
            </Link>
          </section>
        </Reveal>
      </div>
    </div>
  );
}

function CategoryFilter({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-colors duration-200",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-transparent text-muted-ink border-hairline hover:border-white/30 hover:text-ink"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
