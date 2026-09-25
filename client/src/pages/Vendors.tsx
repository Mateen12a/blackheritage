import type { ReactNode } from "react";
import { VendorCard } from "@/components/VendorCard";
import { CategoryIcon, categoryLabel } from "@/components/vendor-categories";
import { useVendors } from "@/hooks/use-vendors";
import { Reveal } from "@/components/motion";
import { vendorCategories } from "@shared/schema";
import { Search } from "lucide-react";
import { DirectorySkeleton } from "@/components/AsyncStates";
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
      <div className="container mx-auto px-4 pt-6 pb-24">
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
              className="w-full h-12 pl-12 bg-surface-2 border border-hairline rounded-full text-ink text-base placeholder:text-muted-ink focus-visible:border-gold focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Category filters — quiet pills, gold only when active */}
        <div
          className="flex gap-2 mb-12 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap max-w-3xl"
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
          <DirectorySkeleton count={6} label="Loading vendors" />
        ) : (
          <>
            {/* App-style rows on mobile, editorial grid from sm up */}
            <div className="divide-y divide-hairline md:hidden">
              {filteredVendors?.map((vendor) => {
                const gallery = (() => {
                  try {
                    const parsed = JSON.parse(vendor.gallery || "[]");
                    return Array.isArray(parsed) ? (parsed as string[]) : [];
                  } catch {
                    return [];
                  }
                })();
                return (
                  <Link key={vendor.id} href={"/vendors/" + vendor.id}>
                    <div className="flex items-center gap-4 py-4 active:bg-surface-2 -mx-3 px-3 rounded-md transition-colors">
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-surface-2 border border-hairline shrink-0 flex items-center justify-center">
                        {gallery[0] ? (
                          <img src={gallery[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <CategoryIcon category={vendor.category} className="w-6 h-6 text-gold/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-base font-bold text-ink truncate">{vendor.businessName}</h3>
                        <p className="text-xs text-muted-ink mt-0.5 truncate">
                          {categoryLabel(vendor.category)} · {vendor.city || vendor.serviceArea || "Nigeria"}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVendors?.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          </>
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
          <section className="border border-hairline rounded-md bg-surface p-10 md:p-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-ink max-w-lg tracking-tight">
              Your work deserves a front page
            </h2>
            <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
            <p className="mt-5 text-muted-ink max-w-xl leading-relaxed">
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
